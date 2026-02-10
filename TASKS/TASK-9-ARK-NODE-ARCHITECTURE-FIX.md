# TASK-9: Fix ARK Node Architecture

## Problem

Current architecture incorrectly mixes ARK-specific nodes with n8n's generic AI ecosystem:

1. **ARK Model** outputs `"main"` instead of `"ai_languageModel"` → Cannot connect to AI inputs
2. **ARK Agent Advanced** accepts generic n8n AI nodes (OpenAI, Anthropic, etc.) → Should only accept ARK nodes
3. **ARK Agent Tool** is too basic → Should support sub-nodes like ARK Agent Advanced

## Correct Architecture

```
ARK Agent Advanced
├── Chat Model Input → ONLY arkModel (not OpenAI/Anthropic)
├── Memory Input → ONLY arkMemory (not generic Memory nodes)
└── Tools Input → ONLY arkTool + arkAgentTool (not generic AI Agent Tools)

ARK Agent Tool (Enhanced)
├── Chat Model Input → ONLY arkModel
├── Memory Input → ONLY arkMemory
└── Tools Input → ONLY arkTool + arkAgentTool
```

## Implementation Steps

### Step 1: Fix ArkModel Output Type (5 min)

**File**: `nodes/nodes/ArkModel/ArkModel.node.ts`

**Change**:
```typescript
// BEFORE:
outputs: ["main"],

// AFTER:
outputs: [
  {
    displayName: "Model",
    type: "ai_languageModel",
  },
],
```

**Why**: This allows ArkModel to connect to AI language model inputs.

### Step 2: Fix ARK Agent Advanced - Filter to ARK Nodes Only (10 min)

**File**: `nodes/nodes/ArkAgentAdvanced/ArkAgentAdvanced.node.ts`

**Changes** (lines 32-52):
```typescript
inputs: [
  "main",
  {
    displayName: "Chat Model",
    type: "ai_languageModel",
    required: false,
    maxConnections: 1,
    filter: {
      nodes: ["CUSTOM.arkModel"],  // ← ADD: Only ARK Model
    },
  },
  {
    displayName: "Memory",
    type: "ai_memory",
    required: false,
    maxConnections: 1,
    filter: {
      nodes: ["CUSTOM.arkMemory"],  // ← ADD: Only ARK Memory
    },
  },
  {
    displayName: "Tools",
    type: "ai_tool",
    required: false,
    maxConnections: 10,
    filter: {
      nodes: ["CUSTOM.arkTool", "CUSTOM.arkAgentTool"],  // ← ADD: Only ARK Tools
    },
  },
],
```

**Why**: Prevents mixing ARK nodes with generic n8n AI nodes.

### Step 3: Enhance ARK Agent Tool with Sub-Node Support (30 min)

**File**: `nodes/nodes/ArkAgentTool/ArkAgentTool.node.ts`

**Current State**: Basic node with only `inputs: ["main"]`

**Target State**: Support Chat Model, Memory, and Tools like ARK Agent Advanced

**Changes**:

1. **Update inputs** (line 32):
```typescript
inputs: [
  "main",
  {
    displayName: "Chat Model",
    type: "ai_languageModel",
    required: false,
    maxConnections: 1,
    filter: {
      nodes: ["CUSTOM.arkModel"],
    },
  },
  {
    displayName: "Memory",
    type: "ai_memory",
    required: false,
    maxConnections: 1,
    filter: {
      nodes: ["CUSTOM.arkMemory"],
    },
  },
  {
    displayName: "Tools",
    type: "ai_tool",
    required: false,
    maxConnections: 10,
    filter: {
      nodes: ["CUSTOM.arkTool", "CUSTOM.arkAgentTool"],
    },
  },
],
```

2. **Add Configuration Mode property** (similar to ARK Agent Advanced):
```typescript
{
  displayName: "Configuration Mode",
  name: "configMode",
  type: "options",
  options: [
    {
      name: "Use Pre-configured Agent",
      value: "static",
      description: "Agent's model and tools are already configured in ARK",
    },
    {
      name: "Update Agent Configuration",
      value: "dynamic",
      description: "Update agent's model and tools from connected sub-nodes",
    },
  ],
  default: "static",
}
```

3. **Update execute() method** to handle sub-nodes:
```typescript
async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
  const items = this.getInputData();
  const returnData: INodeExecutionData[] = [];
  const credentials = await this.getCredentials("arkApi");
  const baseUrl = credentials.baseUrl as string;

  const agentName = this.getNodeParameter("agentName", 0) as string;
  const namespace = this.getNodeParameter("namespace", 0) as string;
  const configMode = this.getNodeParameter("configMode", 0) as string;

  // Extract sub-node configurations
  const modelRef = await extractModelRef.call(this, 0);
  const toolsConfig = await extractToolsConfig.call(this, 0);
  const memoryRef = await extractMemoryRef.call(this, 0);

  // If dynamic mode, update agent configuration
  if (configMode === "dynamic") {
    if (modelRef || toolsConfig.length > 0) {
      await patchAgent.call(this, baseUrl, namespace, agentName, {
        modelRef,
        tools: toolsConfig,
      });
    }
  }

  // Execute query with memory/session if provided
  for (let i = 0; i < items.length; i++) {
    const input = (items[i].json.input as string) || JSON.stringify(items[i].json);
    const sessionId = await getSessionId.call(this, i);

    const queryBody: any = {
      name: `tool-query-${Date.now()}`,
      type: "user",
      input: input,
      target: { type: "agent", name: agentName },
      wait: true,
      timeout: this.getNodeParameter("timeout", i) as string,
    };

    // Add memory reference if provided
    if (memoryRef) {
      queryBody.memory = memoryRef;
      if (sessionId) {
        queryBody.sessionId = sessionId;
      }
    }

    const response = await postQuery.call(this, baseUrl, namespace, queryBody);
    // ... rest of execution
  }

  return [returnData];
}
```

### Step 4: Update Tests (20 min)

**Files**:
- `nodes/nodes/ArkModel/__tests__/ArkModel.node.test.ts` - Test output type
- `nodes/nodes/ArkAgentAdvanced/__tests__/ArkAgentAdvanced.node.test.ts` - Test filters
- `nodes/nodes/ArkAgentTool/__tests__/ArkAgentTool.node.test.ts` - Test new sub-node support

**Key Tests**:
1. ArkModel outputs `ai_languageModel` type
2. ARK Agent Advanced input filters only allow ARK nodes
3. ARK Agent Tool supports dynamic configuration with sub-nodes
4. ARK Agent Tool can update agent model/tools when in dynamic mode

### Step 5: Update Documentation (10 min)

**File**: `CLAUDE.md`

**Update ARK Agent Advanced section**:
- Document that it ONLY accepts ARK-specific nodes
- Remove references to OpenAI/Anthropic compatibility

**Add ARK Agent Tool section**:
- Document sub-node support
- Explain static vs dynamic configuration
- Show example workflows

## Verification Checklist

- [ ] ArkModel can connect to "Chat Model" input of ARK Agent Advanced
- [ ] ARK Agent Advanced rejects OpenAI/Anthropic Chat Model nodes
- [ ] ARK Agent Advanced rejects generic n8n Memory nodes
- [ ] ARK Agent Advanced only accepts ARK Tool and ARK Agent Tool
- [ ] ARK Agent Tool has Chat Model, Memory, and Tools inputs
- [ ] ARK Agent Tool can dynamically configure agent
- [ ] ARK Agent Tool works with memory and session IDs
- [ ] All tests pass with >80% coverage
- [ ] Documentation updated

## Benefits

1. **Clear Architecture**: ARK nodes are self-contained ecosystem
2. **No Mixing**: Prevents confusion between ARK and n8n AI nodes
3. **Consistency**: ARK Agent Tool and ARK Agent Advanced work the same way
4. **Flexibility**: Both nodes support static and dynamic configuration

## Estimated Time

- Step 1: 5 minutes
- Step 2: 10 minutes
- Step 3: 30 minutes
- Step 4: 20 minutes
- Step 5: 10 minutes

**Total**: ~75 minutes

## Priority

**HIGH** - This is an architectural issue that affects usability and node discovery.
