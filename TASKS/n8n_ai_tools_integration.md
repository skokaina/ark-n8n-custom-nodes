# Request for Change: n8n Native AI Tools Integration with ARK Agent Advanced

## Overview

Enable ARK Agent Advanced node to accept and utilize n8n's native AI tool sub-nodes (e.g., Calculator, Web Search, Code Execution, HTTP Request, etc.) alongside or instead of ARK-native tools. This creates a hybrid approach where ARK agents can leverage the rich ecosystem of n8n AI tools while maintaining ARK's advanced features like memory management and dynamic configuration.

## Motivation

**Current Limitation**: ARK Agent Advanced only supports ARK-native tools configured in the ARK API (via agent CRD spec). Users cannot leverage n8n's extensive AI tool ecosystem without duplicating tool definitions in ARK.

**Business Value**:
- **Unified Tooling**: Use n8n's 400+ integration nodes as AI tools without ARK API configuration
- **Rapid Prototyping**: Connect tools visually in n8n without editing Kubernetes CRDs
- **Hybrid Workflows**: Combine ARK's enterprise features (K8s-native, RBAC, resource management) with n8n's rich tool library
- **Lower Barrier to Entry**: Users familiar with n8n AI workflows can easily adopt ARK

**Use Cases**:
1. **Quick Experimentation**: Connect n8n Calculator, Web Search, or HTTP Request tools to ARK agents for immediate testing
2. **Multi-Agent Orchestration**: ARK agent delegates to n8n AI Agent Tool sub-nodes for specialized tasks
3. **Gradual Migration**: Start with n8n tools, gradually migrate critical tools to ARK CRDs for production
4. **Custom Workflows**: Build complex workflows mixing ARK agents with n8n-specific integrations (Gmail, Slack, Notion, etc.)

## Background: n8n AI Agent Architecture

### Sub-Node Connection System

n8n AI Agent nodes use a hierarchical architecture where sub-nodes connect to root AI Agent nodes:

**Connection Types**:
- `ai_languageModel`: Chat Model nodes (OpenAI, Anthropic, etc.)
- `ai_tool`: Tool nodes providing functions the agent can invoke
- `ai_memory`: Memory nodes for conversation history
- `ai_outputParser`: Output parsing and structured data extraction

**Sub-Node Characteristics** ([source](https://docs.n8n.io/integrations/builtin/cluster-nodes/root-nodes/n8n-nodes-langchain.agent/)):
- Connect exclusively to root AI Agent nodes
- Support dynamic parameters filled at runtime by LLM
- Provide clear descriptions for each field to guide LLM parameter selection
- Can be simple tools (Calculator) or complex sub-agents (AI Agent Tool)

### Tool Execution Flow

```
User Input → AI Agent (root)
                ↓
         [Connected Sub-Nodes]
         • Chat Model (GPT-4)
         • Memory (Buffer/Window)
         • Tool: Calculator
         • Tool: Web Search
         • Tool: HTTP Request
                ↓
         Agent decides which tool to call
                ↓
         Tool executes with dynamic parameters
                ↓
         Result returned to agent
                ↓
         Agent generates response
```

### AI Agent Tool Node Pattern

The AI Agent Tool node ([docs](https://docs.n8n.io/integrations/builtin/cluster-nodes/sub-nodes/n8n-nodes-langchain.toolaiagent/)) allows multi-agent orchestration:

> "The primary agent can supervise and delegate work to AI Agent Tool nodes that specialize in different tasks and knowledge."

This is n8n's native multi-agent system, similar to ARK Teams but implemented as sub-nodes.

## Proposed Solution

### Architecture Overview

Add support for n8n AI tool sub-nodes to ARK Agent Advanced via two connection modes:

**Mode 1: ARK-Only (Current)**
```
ARK Agent Advanced → ARK API → Agent CRD with ARK tools
```

**Mode 2: n8n Tools (New)**
```
ARK Agent Advanced ← [n8n Tool Sub-Nodes]
  ↓
Converts n8n tools to ARK tool format
  ↓
ARK API → Query execution with hybrid tools
```

**Mode 3: Hybrid (Recommended)**
```
ARK Agent Advanced ← [n8n Tool Sub-Nodes]
  +
  ARK Agent CRD with ARK tools
  ↓
Merged tool list sent to ARK API
```

### Technical Design

#### 1. Sub-Node Connection Support

Add new input connection type to ARK Agent Advanced node:

```typescript
// In ArkAgentAdvanced.node.ts
inputs: [
  'main', // Existing main input
  {
    displayName: 'Tools',
    type: 'ai_tool', // n8n's AI tool connection type
    maxConnections: -1, // Unlimited tool connections
    required: false
  }
]
```

#### 2. Tool Conversion Layer

Implement converter to translate n8n tools to ARK tool format:

**n8n Tool Interface** (from LangChain):
```typescript
interface N8nTool {
  name: string;
  description: string;
  schema: JSONSchema; // Parameters schema
  call(input: string): Promise<string>; // Execution function
}
```

**ARK Tool Format** (for Query spec):
```yaml
tools:
  - type: custom
    name: "web_search"
    description: "Search the web for information"
    parameters:
      type: object
      properties:
        query:
          type: string
          description: "Search query"
```

**Conversion Logic**:
```typescript
async function convertN8nToolsToArk(
  n8nTools: INodeExecutionData[][]
): Promise<ArkToolSpec[]> {
  const arkTools: ArkToolSpec[] = [];

  for (const toolConnection of n8nTools) {
    const tool = toolConnection[0].json as N8nTool;

    arkTools.push({
      type: 'custom',
      name: tool.name,
      description: tool.description,
      parameters: tool.schema,
      // Store execution callback for later
      _n8nCallback: tool.call
    });
  }

  return arkTools;
}
```

#### 3. Execution Strategy

**Challenge**: ARK API executes tools on its side (in K8s), but n8n tools must execute in n8n runtime.

**Solution: Proxy Tool Pattern**

1. **Tool Registration**: Convert n8n tools to ARK format, register as "proxy tools"
2. **Execution Callback**: When ARK agent calls a proxy tool:
   - ARK API returns a "tool_call_required" status
   - n8n node intercepts this, executes the n8n tool locally
   - n8n sends tool result back to ARK API via follow-up query
3. **Streaming Results**: Use ARK's streaming API for interactive tool execution

**Implementation**:

```typescript
async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
  // Get connected n8n tools
  const n8nTools = await this.getInputConnectionData('ai_tool', 0);

  // Convert to ARK format
  const arkTools = await convertN8nToolsToArk(n8nTools);

  // Get ARK agent's native tools
  const agentTools = await getAgentTools(agentName);

  // Merge tool lists
  const allTools = [...agentTools, ...arkTools];

  // Create query with merged tools
  const query = {
    spec: {
      input: userInput,
      targets: [{ type: 'agent', name: agentName }],
      tools: allTools, // Pass merged tools
      memory: memoryRef,
      sessionId: sessionId,
      wait: true
    }
  };

  // Execute query
  let result = await arkApi.createQuery(query);

  // Handle tool calls from n8n tools
  while (result.status === 'tool_call_required') {
    const toolName = result.toolCall.name;
    const toolArgs = result.toolCall.arguments;

    // Find n8n tool callback
    const n8nTool = arkTools.find(t => t.name === toolName);
    if (n8nTool?._n8nCallback) {
      // Execute n8n tool locally
      const toolResult = await n8nTool._n8nCallback(toolArgs);

      // Send result back to ARK
      result = await arkApi.continueQuery(query.name, {
        toolName: toolName,
        toolResult: toolResult
      });
    } else {
      // ARK-native tool, already executed
      break;
    }
  }

  return [[{ json: result }]];
}
```

#### 4. Configuration Mode Enhancement

Add new configuration option:

```typescript
{
  displayName: 'Tool Source',
  name: 'toolSource',
  type: 'options',
  options: [
    {
      name: 'ARK Tools Only',
      value: 'ark',
      description: 'Use tools configured in ARK agent CRD'
    },
    {
      name: 'n8n Tools Only',
      value: 'n8n',
      description: 'Use tools connected as sub-nodes'
    },
    {
      name: 'Hybrid (ARK + n8n)',
      value: 'hybrid',
      description: 'Merge ARK and n8n tools (recommended)'
    }
  ],
  default: 'hybrid'
}
```

### ARK API Changes Required

To support this integration, ARK API needs:

#### 1. Proxy Tool Support

**New Query Spec Field**:
```yaml
apiVersion: ark.mckinsey.com/v1alpha1
kind: Query
spec:
  # ... existing fields
  externalTools:
    - name: "web_search"
      description: "Search the web"
      parameters: { ... }
      executionMode: "external" # ARK pauses, waits for external execution
```

#### 2. Tool Call Callback API

**New Endpoint**: `POST /v1/namespaces/{ns}/queries/{name}/tool-result`

```json
{
  "toolName": "web_search",
  "toolResult": "Found 10 results for 'kubernetes best practices'...",
  "continueExecution": true
}
```

**Response**: Updated query status with agent's next action (tool call or final response)

#### 3. Streaming Tool Execution

Use Server-Sent Events (SSE) for real-time tool execution:

```
Client: POST /v1/namespaces/{ns}/queries (with stream=true)

Server: (SSE stream)
event: agent_thinking
data: {"status": "reasoning"}

event: tool_call
data: {"name": "web_search", "args": {"query": "n8n vs zapier"}}

Client: POST /v1/namespaces/{ns}/queries/{name}/tool-result
data: {"toolName": "web_search", "toolResult": "..."}

Server: (SSE continues)
event: tool_result_received
data: {"status": "processing"}

event: agent_response
data: {"response": "Based on the search results..."}

event: complete
data: {"status": "completed"}
```

## Implementation Plan

### Phase 1: Foundation (Week 1-2)

**Tasks**:
1. Add `ai_tool` input connection to ARK Agent Advanced node
2. Implement n8n tool → ARK tool format converter
3. Update node UI to show connected tools count
4. Write unit tests for tool conversion logic

**Deliverables**:
- ARK Agent Advanced accepts tool sub-nodes
- Tools are converted and logged (no execution yet)

### Phase 2: ARK API Enhancement (Week 3-4)

**Tasks**:
1. Design and implement ARK API proxy tool spec
2. Add `/tool-result` callback endpoint to ARK API
3. Update Query controller to pause on external tool calls
4. Implement SSE streaming for tool execution

**Deliverables**:
- ARK API supports external tool execution
- Queries can pause, receive tool results, and continue

**ARK API Team Coordination**: Requires collaboration with ARK backend team

### Phase 3: Integration (Week 5-6)

**Tasks**:
1. Implement tool execution callback in ARK Agent Advanced
2. Add tool source configuration (ark/n8n/hybrid)
3. Handle streaming responses from ARK API
4. Error handling for tool execution failures

**Deliverables**:
- End-to-end tool execution working
- Users can connect n8n Calculator, Web Search, etc.

### Phase 4: Testing & Documentation (Week 7-8)

**Tasks**:
1. E2E tests with common n8n tools (Calculator, HTTP Request, Code)
2. Multi-agent orchestration test (ARK agent → n8n AI Agent Tool)
3. Update ARCHITECTURE.md with hybrid tool flow
4. Create tutorial workflow demonstrating n8n tools + ARK

**Deliverables**:
- Comprehensive test coverage
- User-facing documentation and examples

### Phase 5: Advanced Features (Future)

**Optional Enhancements**:
1. **Tool Caching**: Cache n8n tool results to avoid re-execution
2. **Tool Marketplace**: Share n8n tool configurations as reusable components
3. **Visual Tool Builder**: UI for creating custom n8n tools without code
4. **Tool Analytics**: Track which tools are most used, execution times, success rates

## Example Workflows

### Example 1: ARK Agent with n8n Calculator

```
[Manual Trigger] → [ARK Agent Advanced]
                        ↑
                  [Calculator Tool]
```

**Configuration**:
- ARK Agent: "math-assistant" (configured with GPT-4)
- Tool Source: "n8n Tools Only"
- Input: "What is 25% of 8,432?"

**Execution Flow**:
1. ARK Agent Advanced converts Calculator to ARK tool format
2. Sends query to ARK API with tool spec
3. ARK agent decides to call "calculator" tool
4. ARK API returns `tool_call_required` status
5. n8n executes Calculator tool: `0.25 * 8432 = 2108`
6. n8n sends result back via `/tool-result` endpoint
7. ARK agent generates response: "25% of 8,432 is 2,108"

### Example 2: Hybrid Tools (ARK + n8n)

```
[Webhook] → [ARK Agent Advanced]
                 ↑
           [Web Search Tool (n8n)]
           [HTTP Request Tool (n8n)]
```

**Configuration**:
- ARK Agent: "research-assistant" (with ARK-native "database_query" tool)
- Tool Source: "Hybrid (ARK + n8n)"
- Input: "Research competitors for our CRM product"

**Available Tools**:
- ARK-native: `database_query` (queries internal customer data)
- n8n: `web_search` (searches web for competitors)
- n8n: `http_request` (fetches competitor websites)

**Execution Flow**:
1. Agent calls `web_search` (n8n tool) → finds 5 competitors
2. Agent calls `http_request` (n8n tool) → fetches competitor pricing pages
3. Agent calls `database_query` (ARK tool) → queries our customer feedback
4. Agent synthesizes all data into comprehensive report

### Example 3: Multi-Agent with n8n AI Agent Tool

```
[Manual Trigger] → [ARK Agent Advanced: Manager]
                        ↑
                  [AI Agent Tool: Researcher]
                  [AI Agent Tool: Writer]
```

**Configuration**:
- Manager (ARK): Orchestrates research and writing tasks
- Researcher (n8n): Specialized agent with Web Search + Scraper tools
- Writer (n8n): Specialized agent with Grammar Check + Style tools

**Use Case**: Manager agent delegates "research topic X" to Researcher sub-agent, then delegates "write article" to Writer sub-agent. Combines ARK's enterprise orchestration with n8n's rich AI agent ecosystem.

## Technical Considerations

### Performance

**Latency Impact**:
- **n8n Tool Execution**: +100-500ms per tool call (local execution, no network overhead)
- **Callback Round-Trip**: +50-150ms (n8n → ARK API → n8n)
- **Total Overhead**: ~150-650ms per n8n tool call vs 0ms for ARK-native tools

**Mitigation**:
- Use SSE streaming to hide latency (show progress to user)
- Cache tool results when possible
- Batch multiple tool calls in single callback

### Security

**Risks**:
1. **Tool Injection**: Malicious user provides crafted input causing unintended tool execution
2. **Data Leakage**: n8n tool accesses sensitive data not authorized for ARK agent
3. **Resource Exhaustion**: Infinite tool call loop (agent keeps calling same tool)

**Mitigations**:
1. **Input Validation**: Sanitize tool parameters before execution
2. **RBAC Integration**: Check n8n tool permissions against ARK agent's service account
3. **Rate Limiting**: Max 10 tool calls per query, configurable timeout
4. **Audit Logging**: Log all tool calls with user, agent, tool name, parameters

### Scalability

**Challenges**:
- **Stateful Execution**: Node must maintain state during tool callback loop
- **Concurrent Queries**: Multiple queries calling n8n tools simultaneously
- **Memory Usage**: Large tool results stored in memory during execution

**Solutions**:
- **Redis Session Store**: Persist query state between callbacks
- **Worker Pool**: Dedicated n8n workers for tool execution
- **Streaming Results**: Stream large tool outputs instead of buffering

## Alternatives Considered

### Alternative 1: MCP (Model Context Protocol) Integration

**Approach**: Use n8n's MCP server support to expose n8n tools to ARK agents.

**Pros**:
- Standards-based (MCP is gaining adoption)
- No custom ARK API changes needed
- Tools run in separate process (better isolation)

**Cons**:
- More complex setup (MCP server + ARK MCP client)
- Higher latency (additional network hop)
- Less visual (tools not shown in n8n workflow canvas)

**Decision**: Postpone until MCP adoption grows. Pursue native integration first for better UX.

### Alternative 2: Workflow Sub-Nodes

**Approach**: Execute n8n sub-workflows as tools instead of individual tool nodes.

**Pros**:
- More powerful (entire workflow as tool)
- Reusable across multiple agents

**Cons**:
- Heavier weight (full workflow execution per tool call)
- Harder to debug (nested workflow execution)
- More complex parameter mapping

**Decision**: Consider for Phase 5 as "Advanced Tools" feature.

### Alternative 3: Code Node Only

**Approach**: Users write custom JavaScript/Python in n8n Code node, register as tools.

**Pros**:
- Maximum flexibility
- No sub-node complexity

**Cons**:
- Poor UX (writing code instead of visual connections)
- No access to n8n's rich integration library
- Defeats purpose of low-code platform

**Decision**: Not viable. Defeats core value proposition.

## Success Metrics

### User Adoption

- **Target**: 30% of ARK Agent Advanced users connect at least 1 n8n tool within 3 months
- **Measure**: Telemetry on nodes with `ai_tool` connections

### Tool Usage

- **Target**: Top 10 most-used n8n tools identified, 80% usage coverage
- **Measure**: Tool execution analytics (tool name, frequency, success rate)

### Performance

- **Target**: <500ms average overhead per n8n tool call
- **Measure**: Latency metrics from tool call → result

### Workflow Complexity

- **Target**: Users create workflows with 5+ mixed tools (ARK + n8n)
- **Measure**: Average tools per workflow, ARK vs n8n tool ratio

## Documentation Requirements

### User Documentation

1. **Tutorial**: "Using n8n Tools with ARK Agents"
   - Step-by-step guide connecting Calculator, Web Search, HTTP Request
   - Screenshots of node connections
   - Common troubleshooting tips

2. **Reference**: "n8n Tool Integration"
   - Supported tool types
   - Tool source modes (ARK/n8n/hybrid)
   - Performance characteristics

3. **Examples**: 5 sample workflows demonstrating hybrid tools

### Developer Documentation

1. **Architecture**: Update ARCHITECTURE.md with n8n tool flow diagrams
2. **API**: Document ARK API `/tool-result` endpoint, streaming format
3. **Testing**: Guide for testing custom n8n tools with ARK agents

## Open Questions

1. **Q**: Should ARK API validate n8n tool schemas before execution?
   **A**: Yes, basic schema validation (required fields, types) but not deep semantic validation.

2. **Q**: How to handle n8n tools that require credentials (API keys, OAuth)?
   **A**: Use n8n's existing credential system. ARK node has access to n8n credentials via `IExecuteFunctions`.

3. **Q**: Can ARK agents call other ARK agents as tools via n8n AI Agent Tool?
   **A**: Yes! This creates a hybrid multi-agent system. ARK orchestrates, n8n provides specialized sub-agents.

4. **Q**: What happens if n8n tool execution fails?
   **A**: Return error to ARK agent as tool result. Agent can retry, ask for clarification, or abort.

5. **Q**: Should we support LangChain tools directly?
   **A**: n8n's AI tools are LangChain-based, so implicit support. Explicit LangChain integration can be Phase 5.

## References

- [n8n Multi-Agent Systems Blog](https://blog.n8n.io/multi-agent-systems/)
- [n8n AI Agent Documentation](https://docs.n8n.io/integrations/builtin/cluster-nodes/root-nodes/n8n-nodes-langchain.agent/)
- [n8n AI Agent Tool Documentation](https://docs.n8n.io/integrations/builtin/cluster-nodes/sub-nodes/n8n-nodes-langchain.toolaiagent/)
- [How to Build AI Agents with n8n: Complete 2026 Guide](https://strapi.io/blog/build-ai-agents-n8n)
- [Multi Agent Solutions in n8n](https://hatchworks.com/blog/ai-agents/multi-agent-solutions-in-n8n/)

## Appendix: Tool Conversion Examples

### Example: n8n Calculator Tool → ARK Format

**n8n Tool**:
```typescript
{
  name: 'calculator',
  description: 'Perform mathematical calculations',
  schema: {
    type: 'object',
    properties: {
      expression: {
        type: 'string',
        description: 'Mathematical expression to evaluate (e.g., "2 + 2")'
      }
    },
    required: ['expression']
  },
  call: async (input: string) => {
    return eval(input); // Simplified
  }
}
```

**ARK Tool Spec**:
```yaml
- type: custom
  name: calculator
  description: Perform mathematical calculations
  parameters:
    type: object
    properties:
      expression:
        type: string
        description: Mathematical expression to evaluate (e.g., "2 + 2")
    required:
      - expression
  executionMode: external # Signals n8n execution
```

### Example: n8n HTTP Request Tool → ARK Format

**n8n Tool**:
```typescript
{
  name: 'http_request',
  description: 'Make HTTP requests to external APIs',
  schema: {
    type: 'object',
    properties: {
      url: { type: 'string', description: 'URL to request' },
      method: { type: 'string', enum: ['GET', 'POST', 'PUT', 'DELETE'] },
      body: { type: 'object', description: 'Request body (for POST/PUT)' }
    },
    required: ['url', 'method']
  },
  call: async (input: { url: string; method: string; body?: any }) => {
    const response = await fetch(input.url, {
      method: input.method,
      body: JSON.stringify(input.body)
    });
    return await response.text();
  }
}
```

**ARK Tool Spec**:
```yaml
- type: custom
  name: http_request
  description: Make HTTP requests to external APIs
  parameters:
    type: object
    properties:
      url:
        type: string
        description: URL to request
      method:
        type: string
        enum: [GET, POST, PUT, DELETE]
      body:
        type: object
        description: Request body (for POST/PUT)
    required:
      - url
      - method
  executionMode: external
```

## Approval & Next Steps

**Stakeholders**:
- ARK Backend Team (ARK API changes)
- n8n Custom Nodes Team (this feature)
- Product Manager (prioritization)
- DevOps (deployment considerations)

**Decision Needed**:
- [ ] Approve RFC and allocate engineering resources
- [ ] Schedule ARK API design review with backend team
- [ ] Create epics/stories in project tracker
- [ ] Set target release version (e.g., v0.3.0)

**Timeline**:
- RFC Review: Week 1
- Design Finalization: Week 2
- Implementation: Week 3-6
- Testing & Documentation: Week 7-8
- Release: End of Week 8

---

**Author**: Claude (AI Assistant)
**Date**: 2026-02-08
**Status**: Draft - Awaiting Review
**Target Version**: v0.3.0
