# Demo Workflows

Demo workflows showcasing ARK custom nodes.

## Quick Start

Run the complete setup with demo workflow:

```bash
make quickstart
```

This will:
1. Setup k3d cluster with ARK (if needed)
2. Deploy ark-n8n with auto-login
3. Import demo workflow
4. Open n8n UI in browser

## ark-agent-tool-demo.json

**Purpose**: Demonstrates the ARK Agent Tool node

**Flow**:
```
Manual Trigger
  ↓
Prepare Input (test message)
  ↓
ARK Agent Tool (calls test-agent)
  ↓
Format Output (displays response)
```

**What it shows**:
- How to use ARK Agent Tool in a workflow
- Input preparation from previous node
- Response extraction and formatting
- Basic ARK agent interaction

**Prerequisites**:
- k3d cluster with ARK
- test-agent deployed (created by `make e2e-create`)
- ARK API credentials configured

**Testing**:
1. Open workflow in n8n
2. Click "Test workflow"
3. View response in Format Output node

**Modify to test**:
- Change input message in "Prepare Input"
- Update agent name in "ARK Agent Tool"
- Add memory and session ID
- Adjust timeout

## Manual Import

If `make quickstart` doesn't work:

```bash
# 1. Port-forward to n8n
kubectl port-forward svc/ark-n8n-proxy 8080:80

# 2. Open http://localhost:8080

# 3. Import workflow:
#    Workflows → Import from File
#    Select: samples/demo-workflows/ark-agent-tool-demo.json
```

## Creating Custom Demos

Copy and modify the demo:

```bash
cp ark-agent-tool-demo.json my-custom-demo.json
# Edit my-custom-demo.json
```

Key fields to change:
- `name`: Workflow name
- `nodes[].parameters`: Node configuration
- `connections`: Node connections

## Automated Import

Use the import script directly:

```bash
# Start port-forward first
kubectl port-forward svc/ark-n8n-proxy 8080:80 &

# Import workflow
bash scripts/import-demo-workflow.sh samples/demo-workflows/ark-agent-tool-demo.json
```

## Available Demos

| Workflow | Purpose | Nodes Used |
|----------|---------|------------|
| ark-agent-tool-demo.json | ARK Agent Tool basics | Manual Trigger, Set, ARK Agent Tool |

More demos coming soon:
- Memory and session management
- Multi-agent workflows
- Error handling examples
