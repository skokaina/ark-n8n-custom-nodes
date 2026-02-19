# Phase 5: E2E Testing & Examples

**Status**: ⏸️ Waiting for Phase 2, 3, 4
**Estimated Time**: 1-2 hours
**Priority**: Low (but important for quality)

## Overview

Create example workflows demonstrating ARK AI tool nodes in real scenarios.

## Files to Create

### 1. `samples/ai-tool-examples/agent-to-agent.json`

**Scenario**: Agent calls another agent for specialized processing

```json
{
  "name": "Agent-to-Agent Communication",
  "nodes": [
    {
      "parameters": {},
      "name": "When clicking 'Test workflow'",
      "type": "n8n-nodes-base.manualTrigger",
      "position": [250, 300]
    },
    {
      "parameters": {
        "values": {
          "string": [
            {
              "name": "userQuery",
              "value": "Analyze sales data and provide insights"
            }
          ]
        }
      },
      "name": "Set Test Data",
      "type": "n8n-nodes-base.set",
      "position": [470, 300]
    },
    {
      "parameters": {
        "agentName": "data-analyzer-agent",
        "namespace": "default",
        "timeout": "60s"
      },
      "credentials": {
        "arkApi": {
          "id": "1",
          "name": "ARK API"
        }
      },
      "name": "ARK Agent Tool - Analyzer",
      "type": "CUSTOM.arkAgentTool",
      "position": [690, 300]
    },
    {
      "parameters": {
        "values": {
          "string": [
            {
              "name": "analysis",
              "value": "={{ $json.response }}"
            },
            {
              "name": "nextStep",
              "value": "Enrich this analysis with market trends"
            }
          ]
        }
      },
      "name": "Prepare for Enrichment",
      "type": "n8n-nodes-base.set",
      "position": [910, 300]
    },
    {
      "parameters": {
        "agentName": "market-enricher-agent",
        "namespace": "default",
        "timeout": "60s"
      },
      "credentials": {
        "arkApi": {
          "id": "1",
          "name": "ARK API"
        }
      },
      "name": "ARK Agent Tool - Enricher",
      "type": "CUSTOM.arkAgentTool",
      "position": [1130, 300]
    },
    {
      "parameters": {},
      "name": "Display Final Results",
      "type": "n8n-nodes-base.displayResults",
      "position": [1350, 300]
    }
  ],
  "connections": {
    "When clicking 'Test workflow'": {
      "main": [[{"node": "Set Test Data", "type": "main", "index": 0}]]
    },
    "Set Test Data": {
      "main": [[{"node": "ARK Agent Tool - Analyzer", "type": "main", "index": 0}]]
    },
    "ARK Agent Tool - Analyzer": {
      "main": [[{"node": "Prepare for Enrichment", "type": "main", "index": 0}]]
    },
    "Prepare for Enrichment": {
      "main": [[{"node": "ARK Agent Tool - Enricher", "type": "main", "index": 0}]]
    },
    "ARK Agent Tool - Enricher": {
      "main": [[{"node": "Display Final Results", "type": "main", "index": 0}]]
    }
  }
}
```

**Description**: Demonstrates agent-to-agent communication where one agent analyzes data and another enriches the analysis.

### 2. `samples/ai-tool-examples/workflow-orchestration.json`

**Scenario**: Main workflow orchestrates multiple sub-workflows

```json
{
  "name": "Workflow Orchestration",
  "nodes": [
    {
      "parameters": {},
      "name": "Schedule Trigger",
      "type": "n8n-nodes-base.scheduleTrigger",
      "position": [250, 300],
      "parameters": {
        "rule": {
          "interval": [{"field": "hours", "hoursInterval": 6}]
        }
      }
    },
    {
      "parameters": {
        "url": "https://api.example.com/data",
        "method": "GET"
      },
      "name": "Fetch Raw Data",
      "type": "n8n-nodes-base.httpRequest",
      "position": [470, 300]
    },
    {
      "parameters": {
        "workflowId": "data-cleaning-workflow",
        "timeout": 60000
      },
      "credentials": {
        "n8nApi": {
          "id": "2",
          "name": "n8n API"
        }
      },
      "name": "ARK Workflow Tool - Clean",
      "type": "CUSTOM.arkWorkflowTool",
      "position": [690, 300]
    },
    {
      "parameters": {
        "workflowId": "data-analysis-workflow",
        "timeout": 120000
      },
      "credentials": {
        "n8nApi": {
          "id": "2",
          "name": "n8n API"
        }
      },
      "name": "ARK Workflow Tool - Analyze",
      "type": "CUSTOM.arkWorkflowTool",
      "position": [910, 300]
    },
    {
      "parameters": {
        "workflowId": "report-generation-workflow",
        "timeout": 90000
      },
      "credentials": {
        "n8nApi": {
          "id": "2",
          "name": "n8n API"
        }
      },
      "name": "ARK Workflow Tool - Report",
      "type": "CUSTOM.arkWorkflowTool",
      "position": [1130, 300]
    },
    {
      "parameters": {
        "operation": "sendEmail",
        "toEmail": "team@example.com",
        "subject": "Daily Report Ready",
        "text": "={{ $json.result }}"
      },
      "name": "Send Notification",
      "type": "n8n-nodes-base.emailSend",
      "position": [1350, 300]
    }
  ],
  "connections": {
    "Schedule Trigger": {
      "main": [[{"node": "Fetch Raw Data", "type": "main", "index": 0}]]
    },
    "Fetch Raw Data": {
      "main": [[{"node": "ARK Workflow Tool - Clean", "type": "main", "index": 0}]]
    },
    "ARK Workflow Tool - Clean": {
      "main": [[{"node": "ARK Workflow Tool - Analyze", "type": "main", "index": 0}]]
    },
    "ARK Workflow Tool - Analyze": {
      "main": [[{"node": "ARK Workflow Tool - Report", "type": "main", "index": 0}]]
    },
    "ARK Workflow Tool - Report": {
      "main": [[{"node": "Send Notification", "type": "main", "index": 0}]]
    }
  }
}
```

**Description**: Demonstrates workflow orchestration where a main workflow executes multiple sub-workflows sequentially.

### 3. `samples/ai-tool-examples/conversational-agent.json`

**Scenario**: Conversational agent with memory using ARK Agent Tool

```json
{
  "name": "Conversational Support Agent",
  "nodes": [
    {
      "parameters": {
        "path": "chat",
        "responseMode": "lastNode",
        "options": {}
      },
      "name": "Webhook",
      "type": "n8n-nodes-base.webhook",
      "position": [250, 300]
    },
    {
      "parameters": {
        "agentName": "support-agent",
        "namespace": "default",
        "memory": "conversation-memory",
        "sessionId": "={{ $json.body.userId }}",
        "timeout": "30s"
      },
      "credentials": {
        "arkApi": {
          "id": "1",
          "name": "ARK API"
        }
      },
      "name": "ARK Agent Tool - Support",
      "type": "CUSTOM.arkAgentTool",
      "position": [470, 300]
    },
    {
      "parameters": {
        "respondWith": "json",
        "responseBody": "={{ { \"reply\": $json.response, \"sessionId\": $json.sessionId } }}"
      },
      "name": "Respond to Webhook",
      "type": "n8n-nodes-base.respondToWebhook",
      "position": [690, 300]
    }
  ],
  "connections": {
    "Webhook": {
      "main": [[{"node": "ARK Agent Tool - Support", "type": "main", "index": 0}]]
    },
    "ARK Agent Tool - Support": {
      "main": [[{"node": "Respond to Webhook", "type": "main", "index": 0}]]
    }
  }
}
```

**Description**: Demonstrates a conversational agent that maintains conversation history using memory and session IDs.

## README for Examples

### File: `samples/ai-tool-examples/README.md`

```markdown
# ARK AI Tool Node Examples

Example workflows demonstrating ARK Agent Tool and ARK Workflow Tool usage.

## Prerequisites

### For ARK Agent Tool Examples
1. ARK cluster running with agents deployed
2. ARK API accessible from n8n
3. ARK API credentials configured in n8n

### For ARK Workflow Tool Examples
1. n8n instance running
2. n8n API key created (Settings → API)
3. Sub-workflows created (see setup instructions)

## Examples

### 1. agent-to-agent.json
**Scenario**: Multi-agent pipeline
**Use Case**: Agent calls another agent for specialized processing

**Setup**:
```bash
# Create test agents in ARK cluster
kubectl apply -f - <<EOF
apiVersion: ark.mckinsey.com/v1alpha1
kind: Agent
metadata:
  name: data-analyzer-agent
spec:
  modelRef:
    name: default
  prompt: "You analyze data and provide insights."
---
apiVersion: ark.mckinsey.com/v1alpha1
kind: Agent
metadata:
  name: market-enricher-agent
spec:
  modelRef:
    name: default
  prompt: "You enrich analysis with market trends."
EOF
```

**Import**:
1. n8n → Workflows → Import from File
2. Select `agent-to-agent.json`
3. Configure ARK API credentials
4. Execute workflow

**Expected Flow**:
1. Manual trigger starts workflow
2. First agent analyzes data
3. Second agent enriches analysis
4. Final results displayed

### 2. workflow-orchestration.json
**Scenario**: Modular workflow composition
**Use Case**: Main workflow orchestrates multiple sub-workflows

**Setup**:
Create these sub-workflows first:

**data-cleaning-workflow**:
```
Webhook Trigger
  ↓
Code: Clean data (remove nulls, format)
  ↓
Respond to Webhook
```

**data-analysis-workflow**:
```
Webhook Trigger
  ↓
Code: Analyze data (calculate metrics)
  ↓
Respond to Webhook
```

**report-generation-workflow**:
```
Webhook Trigger
  ↓
Code: Generate report (format output)
  ↓
Respond to Webhook
```

**Import**:
1. Create sub-workflows above
2. Import `workflow-orchestration.json`
3. Configure n8n API credentials
4. Update workflow IDs in ARK Workflow Tool nodes
5. Execute workflow

**Expected Flow**:
1. Schedule trigger (or manual)
2. Fetches data from API
3. Cleans data via sub-workflow
4. Analyzes data via sub-workflow
5. Generates report via sub-workflow
6. Sends email notification

### 3. conversational-agent.json
**Scenario**: Conversational AI with memory
**Use Case**: Multi-turn chat with context retention

**Setup**:
```bash
# Create support agent and memory
kubectl apply -f - <<EOF
apiVersion: ark.mckinsey.com/v1alpha1
kind: Agent
metadata:
  name: support-agent
spec:
  modelRef:
    name: default
  prompt: "You are a helpful support agent."
---
apiVersion: ark.mckinsey.com/v1alpha1
kind: Memory
metadata:
  name: conversation-memory
spec:
  type: buffer
  maxMessages: 20
EOF
```

**Import**:
1. Import `conversational-agent.json`
2. Configure ARK API credentials
3. Activate workflow
4. Get webhook URL

**Test**:
```bash
# First message
curl -X POST https://your-n8n/webhook/chat \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "user-123",
    "message": "Hello, I need help"
  }'

# Follow-up (same session)
curl -X POST https://your-n8n/webhook/chat \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "user-123",
    "message": "What did I just ask about?"
  }'
```

**Expected Flow**:
1. Webhook receives message
2. ARK agent processes with memory
3. Agent remembers conversation
4. Response returned

## Troubleshooting

### ARK Agent Tool Issues
- Verify ARK cluster is running: `kubectl get agents`
- Check agent exists: `kubectl get agent <name> -n default`
- Test ARK API: `curl http://ark-api:8000/v1/agents`

### ARK Workflow Tool Issues
- Verify n8n API key is valid
- Check workflow exists in n8n
- Test n8n API: `curl -H "X-N8N-API-KEY: key" http://n8n:5678/api/v1/workflows`

### General Issues
- Check credentials are configured correctly
- View execution logs in n8n
- Enable "Continue on Fail" for better error messages

## Customization

### Modify Examples
1. Clone example workflow
2. Update agent names / workflow IDs
3. Adjust timeouts as needed
4. Add error handling nodes
5. Test thoroughly

### Create New Examples
1. Start with these templates
2. Add your specific nodes
3. Document setup requirements
4. Test end-to-end
5. Share with team

## Next Steps

- Review [ARK AI Tool Nodes Documentation](../../docs/ARK_AI_TOOL_NODES.md)
- Explore [ARK Documentation](https://github.com/agents-at-scale/ark)
- Join [n8n Community](https://community.n8n.io/)
```

## Manual E2E Testing

### Test Checklist

#### ARK Agent Tool
- [ ] Import agent-to-agent.json
- [ ] Configure ARK API credentials
- [ ] Create test agents in cluster
- [ ] Execute workflow manually
- [ ] Verify agent responses
- [ ] Check error handling (invalid agent)
- [ ] Test memory persistence

#### ARK Workflow Tool
- [ ] Create sub-workflows
- [ ] Import workflow-orchestration.json
- [ ] Configure n8n API credentials
- [ ] Update workflow IDs in nodes
- [ ] Execute workflow manually
- [ ] Verify sub-workflow execution
- [ ] Check error handling (invalid workflow)
- [ ] Test timeout scenarios

#### Conversational Agent
- [ ] Create support agent and memory
- [ ] Import conversational-agent.json
- [ ] Activate workflow
- [ ] Send test messages via webhook
- [ ] Verify conversation continuity
- [ ] Test different session IDs
- [ ] Check memory limits

## Success Criteria

- ✅ All 3 example workflows created
- ✅ README with setup instructions
- ✅ Examples tested manually
- ✅ All scenarios work end-to-end
- ✅ Error cases handled gracefully
- ✅ Documentation clear and complete

## Commit Message Template

```
test: add E2E examples for ARK AI tool nodes

Example workflows demonstrating ARK Agent Tool and ARK Workflow Tool.

Examples:
1. agent-to-agent.json - Multi-agent pipeline
2. workflow-orchestration.json - Sub-workflow composition
3. conversational-agent.json - Chat with memory

Each example includes:
- Complete workflow JSON
- Setup instructions
- Expected behavior
- Troubleshooting tips

Files:
- samples/ai-tool-examples/agent-to-agent.json
- samples/ai-tool-examples/workflow-orchestration.json
- samples/ai-tool-examples/conversational-agent.json
- samples/ai-tool-examples/README.md

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>
```

## Final Steps

After all phases complete:
1. Run full test suite: `make test`
2. Run E2E tests: `make e2e`
3. Build Docker image: `make docker-build`
4. Update main README with new nodes
5. Create pull request
6. Tag release version
