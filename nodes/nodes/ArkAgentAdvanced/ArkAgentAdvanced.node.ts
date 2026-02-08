import {
  IExecuteFunctions,
  ILoadOptionsFunctions,
  INodeExecutionData,
  INodePropertyOptions,
  INodeType,
  INodeTypeDescription,
} from "n8n-workflow";
import {
  getSessionId,
  patchAgent,
  postQuery,
  pollQueryStatus,
  extractModelRef,
  extractToolsConfig,
  extractMemoryRef,
  extractResponseContent,
} from "../../utils/arkHelpers";

export class ArkAgentAdvanced implements INodeType {
  description: INodeTypeDescription = {
    displayName: "ARK Agent Advanced",
    name: "arkAgentAdvanced",
    icon: "fa:sitemap",
    group: ["transform"],
    version: 1,
    description:
      "Execute ARK agents with dynamic configuration, memory, and session management",
    defaults: {
      name: "ARK Agent Advanced",
    },
    inputs: [
      "main",
      {
        displayName: "Chat Model",
        type: "ai_languageModel",
        required: false,
        maxConnections: 1,
      },
      {
        displayName: "Memory",
        type: "ai_memory",
        required: false,
        maxConnections: 1,
      },
      {
        displayName: "Tools",
        type: "ai_tool",
        required: false,
        maxConnections: 10,
      },
    ],
    outputs: ["main"],
    credentials: [
      {
        name: "arkApi",
        required: true,
      },
    ],
    properties: [
      {
        displayName: "Configuration Mode",
        name: "configMode",
        type: "options",
        options: [
          {
            name: "Use Pre-configured Agent",
            value: "static",
            description:
              "Agent's model and tools are already configured in ARK",
          },
          {
            name: "Update Agent Configuration",
            value: "dynamic",
            description:
              "Update agent's model and tools from connected sub-nodes before execution",
          },
        ],
        default: "static",
        description:
          "Choose whether to use agent as-is or dynamically configure it",
      },
      {
        displayName: "Agent",
        name: "agent",
        type: "options",
        typeOptions: {
          loadOptionsMethod: "getAgents",
        },
        default: "",
        required: true,
        description: "The ARK agent to execute",
      },
      {
        displayName: "Input",
        name: "input",
        type: "string",
        typeOptions: {
          rows: 4,
        },
        default: "",
        required: true,
        description: "The input text/question for the agent",
        placeholder: "What can you help me with?",
      },
      {
        displayName: "Session ID",
        name: "sessionId",
        type: "string",
        default: "",
        placeholder: "user-123-session or leave empty for auto-generated",
        description:
          "Unique identifier for conversation continuity when memory is connected. Same session ID maintains conversation history. Leave empty to auto-generate from workflow context.",
      },
      {
        displayName: "Wait for Completion",
        name: "wait",
        type: "boolean",
        default: true,
        description:
          "Whether to wait for the query to complete. If disabled, query runs asynchronously.",
      },
      {
        displayName: "Timeout",
        name: "timeout",
        type: "string",
        default: "30s",
        placeholder: "30s, 5m, etc.",
        description: "Maximum time to wait for completion (e.g., 30s, 5m)",
      },
    ],
  };

  methods = {
    loadOptions: {
      async getAgents(
        this: ILoadOptionsFunctions,
      ): Promise<INodePropertyOptions[]> {
        const credentials = await this.getCredentials("arkApi");
        const baseUrl = credentials.baseUrl as string;

        const response = await this.helpers.request({
          method: "GET",
          url: `${baseUrl}/v1/agents`,
          json: true,
        });

        return response.items.map((agent: any) => ({
          name: agent.name,
          value: agent.name,
          description: agent.description || "",
        }));
      },
    },
  };

  async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
    const items = this.getInputData();
    const returnData: INodeExecutionData[] = [];
    const credentials = await this.getCredentials("arkApi");
    const baseUrl = credentials.baseUrl as string;
    const namespace = (credentials.namespace as string) || "default";

    for (let i = 0; i < items.length; i++) {
      const configMode = this.getNodeParameter("configMode", i) as string;
      const agentName = this.getNodeParameter("agent", i) as string;
      const input = this.getNodeParameter("input", i) as string;
      const wait = this.getNodeParameter("wait", i) as boolean;
      const timeout = this.getNodeParameter("timeout", i) as string;

      // Get or generate session ID
      const sessionId = getSessionId(this, i);

      // Extract memory from connected sub-node
      const memoryRef = await extractMemoryRef(this, i);

      // Dynamic mode: Update agent configuration from sub-nodes
      if (configMode === "dynamic") {
        try {
          // Extract model configuration from connected model node
          const modelRef = await extractModelRef(this, i);

          // Extract tools configuration from connected tool nodes
          const tools = await extractToolsConfig(this, i);

          // Patch agent if we have model or tools to update
          if (modelRef || (tools && tools.length > 0)) {
            await patchAgent(this, baseUrl, namespace, agentName, {
              modelRef,
              tools,
            });
          }
        } catch (error: any) {
          throw new Error(
            `Failed to update agent configuration: ${error.message}`,
          );
        }
      }

      // Get workflow and execution context
      const workflow = this.getWorkflow();
      const executionId = this.getExecutionId();
      const workflowName = (workflow.name ?? "unknown")
        .trim()
        .toLowerCase()
        .replace(/\s+/g, "_");

      // Get session ID from chat session (if available from input data)
      const itemData = items[i].json;
      const chatSessionId =
        itemData.sessionId ||
        itemData.chatSessionId ||
        itemData.session_id ||
        itemData.chat_session_id ||
        "unknown";

      // Prepare query specification
      const queryName = `n8n-${agentName}-${Date.now()}`;
      const querySpec: any = {
        type: "user",
        input: input,
        targets: [
          {
            type: "agent",
            name: agentName,
          },
        ],
        metadata: {
          annotations: {
            "ark.mckinsey.com/run-id": executionId,
            "ark.mckinsey.com/workflow-id": workflow.id,
            "ark.mckinsey.com/session-id": sessionId,
          },
          labels: {
            n8n_workflow_name: workflowName,
            n8n_workflow_id: workflow.id ?? "unknown",
            n8n_execution_id: executionId,
            n8n_agent_name: chatSessionId,
            n8n_session_id: sessionId,
          },
        },
        wait: wait,
        timeout: timeout,
      };

      // Add memory if configured
      if (memoryRef) {
        querySpec.memory = memoryRef;
      }

      // Always add sessionId (required for memory continuity)
      querySpec.sessionId = sessionId;

      // Execute query
      try {
        await postQuery(this, baseUrl, namespace, queryName, querySpec);

        if (!wait) {
          // Return immediately if not waiting for completion
          returnData.push({
            json: {
              queryName: queryName,
              status: "pending",
              message: "Query created, not waiting for completion",
              sessionId: sessionId,
              agentName: agentName,
              memoryRef: memoryRef?.name || null,
            },
            pairedItem: { item: i },
          });
          continue;
        }

        // Poll for completion
        const response = await pollQueryStatus(
          this,
          baseUrl,
          namespace,
          queryName,
          60, // maxAttempts
        );

        const output = {
          queryName: queryName,
          status: response.status?.phase || "unknown",
          input: input,
          response: extractResponseContent(response),
          duration: response.status?.duration || null,
          sessionId: sessionId,
          memoryRef: memoryRef?.name || null,
          agentName: agentName,
        };

        returnData.push({
          json: output,
          pairedItem: { item: i },
        });
      } catch (error: any) {
        if (this.continueOnFail()) {
          returnData.push({
            json: { error: error.message },
            pairedItem: { item: i },
          });
          continue;
        }
        throw new Error(`Query execution failed: ${error.message}`);
      }
    }

    return [returnData];
  }
}
