# Phase 4: Documentation

**Status**: ⏸️ Waiting for Phase 2 & 3
**Estimated Time**: 1 hour
**Priority**: Medium

## Overview

Create comprehensive documentation for the new ARK AI tool nodes.

## File to Create

**File**: `docs/ARK_AI_TOOL_NODES.md`

## Documentation Structure

```markdown
# ARK AI Tool Nodes

Guide for using ARK Agent Tool and ARK Workflow Tool nodes in n8n workflows.

## Overview

Two new custom nodes for integrating ARK agents and n8n workflows:

1. **ARK Agent Tool** - Execute ARK agents from workflows
2. **ARK Workflow Tool** - Execute n8n sub-workflows programmatically

These are **standard n8n nodes** (not AI tools), allowing any workflow to use them.

## ARK Agent Tool

### Purpose

Execute ARK agents for specialized processing within n8n workflows.

### Configuration

**Required**:
- **Agent Name**: Name of ARK agent to execute (e.g., "data-analyzer-agent")
- **Namespace**: Kubernetes namespace (default: "default")

**Optional**:
- **Timeout**: Maximum wait time (default: "30s")
- **Memory**: Memory resource name for conversation history
- **Session ID**: Session identifier for memory persistence

**Credentials**: ARK API (baseUrl, namespace, optional API key)

### Input

Receives input from previous node:
- `input` field: String to send to agent
- If no `input` field: Entire JSON stringified

### Output

```json
{
  "response": "Agent response text",
  "queryName": "tool-query-1234567890-0",
  "status": "completed",
  "agentName": "data-analyzer-agent",
  "sessionId": "user-123-session"
}
```

### Example Workflows

#### 1. Data Processing
```
HTTP Trigger (receives data)
  ↓
ARK Agent Tool
  Agent: "data-processor-agent"
  Input: {{ $json.rawData }}
  ↓
Send Email (with results)
```

#### 2. Conversational Agent
```
Webhook Trigger (chat messages)
  ↓
ARK Agent Tool
  Agent: "support-agent"
  Memory: "conversation-memory"
  Session ID: "user-{{ $json.userId }}"
  Input: {{ $json.message }}
  ↓
HTTP Response (send reply)
```

#### 3. Multi-Agent Pipeline
```
Manual Trigger
  ↓
ARK Agent Tool (Analyzer)
  Agent: "data-analyzer-agent"
  ↓
ARK Agent Tool (Enricher)
  Agent: "data-enricher-agent"
  Input: {{ $json.response }}
  ↓
Store in Database
```

### Error Handling

Enable "Continue on Fail" to handle errors gracefully:
```json
{
  "error": "Query timeout",
  "agentName": "slow-agent"
}
```

### Best Practices

1. **Use expressions for dynamic inputs**: `{{ $json.data }}`
2. **Set appropriate timeouts**: Complex queries need more time
3. **Use memory for conversations**: Pass same session ID across calls
4. **Handle errors**: Enable continue on fail for production workflows
5. **Test with simple queries first**: Verify agent connectivity

## ARK Workflow Tool

### Purpose

Execute n8n sub-workflows as modular components from main workflows.

### Configuration

**Required**:
- **Workflow**: Select workflow from dropdown (loaded from n8n API)

**Optional**:
- **Timeout**: Maximum wait time in milliseconds (default: 30000)

**Credentials**: n8n API (baseUrl, API key)

### Input

Entire JSON from previous node passed as parameters to sub-workflow.

### Output

```json
{
  "result": { /* sub-workflow output */ },
  "workflowId": "wf-123",
  "executionId": "exec-456",
  "success": true
}
```

### Example Workflows

#### 1. Modular Processing
```
Manual Trigger
  ↓
Prepare Data
  ↓
ARK Workflow Tool
  Workflow: "data-processing-pipeline"
  ↓
Display Results
```

#### 2. Parallel Execution
```
Split in Batches
  ↓
ARK Workflow Tool (in loop)
  Workflow: "process-single-item"
  ↓
Merge Results
```

#### 3. Conditional Routing
```
IF node (check type)
  ├─ Branch A: ARK Workflow Tool → "process-type-a"
  └─ Branch B: ARK Workflow Tool → "process-type-b"
```

### Setup n8n API Access

1. Open n8n → **Settings** → **API**
2. Click **Create API Key**
3. Label: "Workflow Tool"
4. Copy API key
5. Create n8n API credential in workflow
   - Base URL: `http://localhost:5678` (or your n8n URL)
   - API Key: Paste key

### Error Handling

Enable "Continue on Fail":
```json
{
  "error": "Workflow not found",
  "workflowId": "invalid-id",
  "success": false
}
```

### Best Practices

1. **Design modular sub-workflows**: Single responsibility
2. **Use descriptive names**: Easy to find in dropdown
3. **Test sub-workflows independently**: Verify before integration
4. **Set appropriate timeouts**: Long-running workflows need more time
5. **Handle errors gracefully**: Use continue on fail

## Comparison with Built-in Nodes

| Feature | ARK Agent Tool | ARK Workflow Tool | Execute Workflow (built-in) |
|---------|----------------|-------------------|----------------------------|
| **Execute ARK agents** | ✅ Yes | ❌ No | ❌ No |
| **Execute workflows** | ❌ No | ✅ Yes | ✅ Yes |
| **API-based** | ✅ Yes | ✅ Yes | ❌ No (direct) |
| **Memory support** | ✅ Yes | ❌ No | ❌ No |
| **Session management** | ✅ Yes | ❌ No | ❌ No |
| **External cluster** | ✅ Yes | ✅ Yes | ❌ No |

## Troubleshooting

### ARK Agent Tool

**Issue**: "Connection refused to ARK API"
**Solution**: Verify ARK API URL in credentials, check network access

**Issue**: "Agent not found"
**Solution**: Check agent name spelling, verify agent exists: `kubectl get agents -n default`

**Issue**: "Query timeout"
**Solution**: Increase timeout value, check agent response time

**Issue**: "401 Unauthorized"
**Solution**: Check ARK API key in credentials (if required)

### ARK Workflow Tool

**Issue**: "No workflows in dropdown"
**Solution**: Verify n8n API key, check n8n API URL, ensure workflows exist

**Issue**: "401 Unauthorized"
**Solution**: Regenerate n8n API key, update credential

**Issue**: "Workflow execution failed"
**Solution**: Test sub-workflow independently, check for errors in sub-workflow

**Issue**: "Timeout"
**Solution**: Increase timeout setting, optimize sub-workflow

## Security Considerations

### ARK Agent Tool
- Store ARK API credentials securely
- Use Kubernetes RBAC to limit agent access
- Validate input before sending to agents
- Don't expose sensitive data in queries

### ARK Workflow Tool
- Protect n8n API keys (never commit to Git)
- Use role-based access in n8n
- Validate input before passing to sub-workflows
- Audit sub-workflow executions

## Performance Tips

### ARK Agent Tool
- Use appropriate timeouts (don't over-allocate)
- Batch similar queries when possible
- Reuse session IDs for conversations
- Monitor ARK cluster resources

### ARK Workflow Tool
- Design efficient sub-workflows
- Avoid deep nesting (workflow calling workflow calling workflow)
- Use caching where appropriate
- Monitor execution times

## Related Documentation

- [ARK Custom Nodes](../CLAUDE.md) - Main development guide
- [ARK Agent Advanced](../CLAUDE.md#ark-agent-advanced-node) - Advanced agent usage
- [n8n API Documentation](https://docs.n8n.io/api/) - n8n API reference
- [ARK Documentation](https://github.com/agents-at-scale/ark) - ARK platform guide

## Support

- GitHub Issues: [ark-n8n-custom-nodes/issues](https://github.com/your-org/ark-n8n-custom-nodes/issues)
- ARK Community: [ARK Discussions](https://github.com/agents-at-scale/ark/discussions)
- n8n Community: [n8n Forum](https://community.n8n.io/)
```

## Success Criteria

- ✅ Documentation file created
- ✅ All sections complete with examples
- ✅ Troubleshooting guides included
- ✅ Best practices documented
- ✅ Links to related docs
- ✅ Security considerations covered
- ✅ Performance tips included

## Commit Message Template

```
docs: add ARK AI tool nodes documentation

Complete documentation for ARK Agent Tool and ARK Workflow Tool nodes.

Includes:
- Configuration guides
- Example workflows
- Troubleshooting tips
- Best practices
- Security considerations
- Performance optimization

File: docs/ARK_AI_TOOL_NODES.md

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>
```

## Next Steps

After completion, proceed to Phase 5: E2E Testing and Examples
