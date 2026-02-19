# Revised Approach: MCP Bridge for n8n ↔ ARK Tool Integration

**Date**: 2026-02-10
**Status**: ✅ Architecture Finalized - Ready for Implementation

---

## 🎯 Decision Summary

**CHANGE**: Pivot from direct tool conversion approach to **MCP (Model Context Protocol) bridge pattern**.

**Why**:
- ✅ Standards-based (existing protocol)
- ✅ ARK already supports MCP tools
- ✅ n8n has native MCP capabilities
- ✅ No ARK API changes required
- ✅ Clean separation of concerns
- ✅ Easier to deploy and maintain

---

## 📊 Architecture Comparison

### ❌ Original Approach (Direct Bridge)

```
n8n Tools → ARK Agent Advanced Node
              ↓
         Convert to ARK format
              ↓
         POST to ARK API with externalTools
              ↓
         Tool Execution Loop:
           - ARK returns tool_call_required
           - n8n executes tool locally
           - Send result back to ARK
           - Repeat
```

**Issues**:
- Requires ARK API changes (`externalTools` field, `/tool-result` endpoint)
- Complex state management in n8n node
- Tight coupling between n8n and ARK
- Custom protocol to maintain

### ✅ New Approach (MCP Bridge)

```
┌──────────────────────────────────────┐
│         n8n Pod (Helm Chart)         │
│                                      │
│  ┌────────────┐  ┌───────────────┐ │
│  │ n8n Main   │  │ MCP Server    │ │
│  │ Instance   │◄─┤ (Sidecar)     │ │
│  │            │  │               │ │
│  │ Workflows  │  │ - Tool        │ │
│  │ AI Tools   │  │   Discovery   │ │
│  └────────────┘  │ - SSE         │ │
│                  │   Endpoint    │ │
│                  └───────────────┘ │
└──────────────────────┼──────────────┘
                       │
                       │ MCP Protocol
                       │ (JSON-RPC/SSE)
                       │
┌──────────────────────┼──────────────┐
│         ARK Cluster  │              │
│                      ▼              │
│  ┌─────────────────────────────┐  │
│  │  ARK Agent                  │  │
│  │  spec:                      │  │
│  │    tools:                   │  │
│  │      - type: mcp            │  │
│  │        server:              │  │
│  │          url: http://...    │  │
│  └─────────────────────────────┘  │
└────────────────────────────────────┘
```

**Benefits**:
- Standard MCP protocol (JSON-RPC over SSE)
- ARK native support (no API changes)
- Clean separation (n8n ↔ MCP ↔ ARK)
- Sidecar deployment pattern
- Reusable for other systems

---

## 🔬 Research Findings

### n8n AI Tools

**Sources**:
- [n8n LangChain Documentation](https://docs.n8n.io/advanced-ai/langchain/langchain-n8n/)
- [AI Agents with n8n Guide](https://strapi.io/blog/build-ai-agents-n8n)

**Key Findings**:
- Tools use LangChain's `Tool` interface
- Connected via `ai_tool` input type
- Retrieved via `getInputConnectionData('ai_tool', 0)`
- Tool structure:
  ```typescript
  interface Tool {
    name: string;
    description: string;
    schema: ZodSchema;  // Zod validation schema
    call(input: string): Promise<string>;
  }
  ```

### ARK MCP Support

**Sources**:
- [ARK Documentation](https://mckinsey.github.io/agents-at-scale-ark/)
- [ARK GitHub](https://github.com/mckinsey/agents-at-scale-ark)

**Key Findings**:
- Native MCP tool type in Agent CRDs
- Supports "standardized tool integration"
- Tools execute via MCP protocol
- No custom implementation needed

### Model Context Protocol (MCP)

**Sources**:
- [n8n MCP Integration](https://www.leanware.co/insights/n8n-mcp-integration)
- [MCP Client Tool Docs](https://docs.n8n.io/integrations/builtin/cluster-nodes/sub-nodes/n8n-nodes-langchain.toolmcp/)
- [n8n MCP Guide](https://medium.com/@tam.tamanna18/integrating-n8n-workflow-automation-with-model-context-protocol-mcp-servers-0e7ef54729c1)

**Key Findings**:
- Protocol: JSON-RPC over SSE (Server-Sent Events)
- Two n8n nodes: `MCP Server Trigger`, `MCP Client Tool`
- Bidirectional: n8n can expose AND consume MCP tools
- Authentication: Bearer, OAuth2, custom headers

---

## 🏗️ Implementation Plan

### Phase 1: MCP Server Development (Week 1)

**Task #5**: Research and Design
- Study MCP protocol specification
- Design server architecture
- Define API contracts
- **Estimated**: 8 hours

**Task #6**: Implement MCP Server
- Express server with SSE endpoint
- n8n tool discovery via `getInputConnectionData()`
- Tool conversion (LangChain → MCP format)
- MCP protocol handlers (tools/list, tools/call)
- Unit tests + integration tests
- **Estimated**: 16 hours

### Phase 2: Deployment Integration (Week 2)

**Task #7**: Helm Chart Integration
- Add MCP server as sidecar to n8n deployment
- Create ClusterIP service for MCP endpoint
- Configure resource limits and health checks
- Update values.yaml with MCP configuration
- Test in local k3d cluster
- **Estimated**: 6 hours

### Phase 3: ARK Integration & Testing (Week 3)

**Task #8**: ARK Configuration and E2E Tests
- Create sample Agent CRDs with MCP tools
- Configure ARK → n8n MCP connection
- Playwright E2E tests (Calculator, HTTP Request, Error Handling)
- Documentation and sample workflows
- **Estimated**: 12 hours

**Total Effort**: 42 hours (~5-6 weeks part-time)

---

## 🔄 MCP Protocol Flow

### Tool Discovery

```
1. ARK Agent starts
   ↓
2. Agent spec includes MCP tool:
   tools:
     - type: mcp
       server:
         url: http://ark-n8n-mcp:8080/sse
   ↓
3. ARK connects to MCP server (SSE)
   ↓
4. ARK sends: tools/list request
   ↓
5. MCP Server:
   - Calls getInputConnectionData('ai_tool', 0)
   - Discovers connected n8n tools
   - Converts to MCP format
   - Returns tool list
   ↓
6. ARK Agent now knows available tools
```

### Tool Execution

```
1. User query: "What is 25 * 42?"
   ↓
2. ARK Agent decides to use "calculator" tool
   ↓
3. ARK sends: tools/call request
   {
     "name": "calculator",
     "arguments": {"expression": "25 * 42"}
   }
   ↓
4. MCP Server:
   - Finds calculator tool
   - Calls tool.call('{"expression": "25 * 42"}')
   - n8n executes Calculator node
   - Returns result: "1050"
   ↓
5. MCP Server sends response to ARK
   ↓
6. ARK Agent receives: "1050"
   ↓
7. ARK Agent generates response:
   "The answer is 1050"
```

---

## 📝 MCP Server API Specification

### Endpoint: `GET /sse`

Server-Sent Events endpoint for MCP communication.

### MCP Messages (JSON-RPC)

**1. tools/list** (Request from ARK)
```json
{
  "jsonrpc": "2.0",
  "method": "tools/list",
  "id": 1
}
```

**Response from MCP Server**:
```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": {
    "tools": [
      {
        "name": "calculator",
        "description": "Perform mathematical calculations",
        "inputSchema": {
          "type": "object",
          "properties": {
            "expression": {
              "type": "string",
              "description": "Math expression to evaluate"
            }
          },
          "required": ["expression"]
        }
      }
    ]
  }
}
```

**2. tools/call** (Request from ARK)
```json
{
  "jsonrpc": "2.0",
  "method": "tools/call",
  "params": {
    "name": "calculator",
    "arguments": {
      "expression": "25 * 42"
    }
  },
  "id": 2
}
```

**Response from MCP Server**:
```json
{
  "jsonrpc": "2.0",
  "id": 2,
  "result": {
    "content": [
      {
        "type": "text",
        "text": "1050"
      }
    ]
  }
}
```

---

## 🧪 Testing Strategy

### Unit Tests (Jest)
- Tool discovery from n8n
- LangChain → MCP format conversion
- MCP protocol message handling
- Error scenarios

### Integration Tests
- MCP server + mock n8n instance
- Tool execution round-trip
- SSE connection handling

### E2E Tests (Playwright)
- Deploy full stack (n8n + MCP + ARK)
- Create workflow with Calculator tool
- Execute ARK query using tool
- Verify correct result

---

## 📚 Documentation Required

1. **Architecture Document** (this file)
2. **MCP Server README** (`mcp-server/README.md`)
3. **ARK Integration Guide** (`docs/ARK_MCP_INTEGRATION.md`)
4. **Deployment Guide** (`docs/DEPLOYING_MCP_SERVER.md`)
5. **Sample Workflows** (`samples/mcp-tools/`)
6. **Troubleshooting Guide** (`docs/TROUBLESHOOTING_MCP.md`)

---

## ✅ Success Criteria

- [ ] MCP server discovers n8n tools automatically
- [ ] ARK agents can list available n8n tools
- [ ] Tool execution works end-to-end (ARK → MCP → n8n → MCP → ARK)
- [ ] Error handling graceful (tool failures, timeouts)
- [ ] E2E tests pass consistently
- [ ] Deployed as Helm chart sidecar
- [ ] Documentation complete
- [ ] <500ms latency for tool calls

---

## 🔄 Migration from Original Tasks

| Original Task | Status | New Approach |
|---------------|--------|--------------|
| Task 1.1: Add ai_tool input | ✅ Complete | Already exists in node |
| Task 1.2: Tool converter | ⚠️ Revised | Now converts to MCP format (Task #6) |
| Task 1.3: Tool Source UI | ❌ Not needed | ARK agents configured via CRD |
| Task 1.4: Tests | ⚠️ Revised | Now MCP server tests (Task #6, #8) |
| Phase 2: Mock ARK API | ❌ Not needed | ARK already supports MCP |
| Phase 3: Execution loop | ✅ Replaced | MCP protocol handles this |
| Phase 4: E2E tests | ✅ Kept | Updated for MCP approach (Task #8) |
| Phase 5: Documentation | ✅ Kept | Updated for MCP approach |

---

## 🚀 Next Steps

1. **Review this document** - Team alignment on MCP approach
2. **Start Task #5** - Research and design MCP server architecture
3. **Validate with stakeholders** - ARK team, n8n users
4. **Begin implementation** - Task #6 (MCP server)

---

**Authors**: Claude (AI Assistant)
**Date**: 2026-02-10
**Status**: ✅ Ready for Implementation
**Estimated Completion**: 5-6 weeks part-time
