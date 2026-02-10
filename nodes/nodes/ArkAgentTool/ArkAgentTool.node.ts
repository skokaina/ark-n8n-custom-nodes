import {
  IExecuteFunctions,
  ILoadOptionsFunctions,
  INodeExecutionData,
  INodePropertyOptions,
  INodeType,
  INodeTypeDescription,
} from "n8n-workflow";
import {
  extractResponseContent,
  extractModelRef,
  extractToolsConfig,
  extractMemoryRef,
  patchAgent,
  getSessionId,
} from "../../utils/arkHelpers";

export class ArkAgentTool implements INodeType {
  description: INodeTypeDescription = {
    displayName: "ARK Agent Tool",
    name: "arkAgentTool",
    icon: "file:ark-agent-tool.svg",
    group: ["transform"],
    version: 1,
    description: "Execute ARK agent queries from workflows",
    defaults: {
      name: "ARK Agent Tool",
    },
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
        name: "agentName",
        type: "options",
        typeOptions: {
          loadOptionsMethod: "getAgents",
        },
        default: "",
        required: true,
        description: "The ARK agent to execute",
      },
      {
        displayName: "Namespace",
        name: "namespace",
        type: "string",
        default: "default",
        description: "Kubernetes namespace where the agent is deployed",
      },
      {
        displayName: "Timeout",
        name: "timeout",
        type: "string",
        default: "30s",
        description: 'Maximum wait time (e.g., "30s", "5m")',
        placeholder: "30s",
      },
      {
        displayName: "Session ID",
        name: "sessionId",
        type: "string",
        default: "",
        description:
          "Optional session ID for memory persistence when Memory is connected (auto-generated if empty)",
        placeholder: "user-123-session",
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

    const agentName = this.getNodeParameter("agentName", 0) as string;
    const namespace = this.getNodeParameter("namespace", 0) as string;
    const timeout = this.getNodeParameter("timeout", 0) as string;
    const configMode = this.getNodeParameter("configMode", 0) as string;

    const credentials = await this.getCredentials("arkApi");
    const baseUrl = credentials.baseUrl as string;

    // Extract sub-node configurations
    const modelRef = await extractModelRef(this, 0);
    const toolsConfig = await extractToolsConfig(this, 0);
    const memoryRef = await extractMemoryRef(this, 0);

    // If dynamic mode, update agent configuration before execution
    if (configMode === "dynamic") {
      if (modelRef || (toolsConfig && toolsConfig.length > 0)) {
        await patchAgent(this, baseUrl, namespace, agentName, {
          modelRef,
          tools: toolsConfig,
        });
      }
    }

    for (let i = 0; i < items.length; i++) {
      try {
        // Get input from previous node
        // Try 'input' field first, fallback to entire JSON
        const input =
          (items[i].json.input as string) || JSON.stringify(items[i].json);

        // Get session ID (auto-generated if not provided and memory is connected)
        const sessionId = getSessionId(this, i);

        // Build query spec
        const queryName = `tool-query-${Date.now()}-${i}`;
        const queryBody: any = {
          name: queryName,
          type: "user",
          input: input,
          target: {
            type: "agent",
            name: agentName,
          },
          wait: true,
          timeout: timeout,
        };

        // Add memory configuration from connected Memory sub-node
        if (memoryRef) {
          queryBody.memory = memoryRef;
          if (sessionId) {
            queryBody.sessionId = sessionId;
          }
        }

        // Execute query via ARK API
        await this.helpers.request({
          method: "POST",
          url: `${baseUrl}/v1/queries?namespace=${namespace}`,
          headers: {
            "Content-Type": "application/json",
          },
          body: queryBody,
          json: true,
        });

        // Poll for completion
        let attempts = 0;
        const maxAttempts = 60; // ~10 minutes max (with exponential backoff)
        let response: any = null;

        while (attempts < maxAttempts) {
          // Exponential backoff: 1s, 2s, 4s, 8s, capped at 10s
          const delay = Math.min(1000 * Math.pow(2, attempts), 10000);
          await new Promise((resolve) => setTimeout(resolve, delay));

          const queryStatus = await this.helpers.request({
            method: "GET",
            url: `${baseUrl}/v1/queries/${queryName}?namespace=${namespace}`,
            json: true,
          });

          if (queryStatus.status?.phase === "done") {
            response = queryStatus;
            break;
          } else if (queryStatus.status?.phase === "error") {
            throw new Error(
              `Query failed: ${extractResponseContent(queryStatus) || "Unknown error"}`,
            );
          }

          attempts++;
        }

        if (!response) {
          throw new Error(
            `Query timed out after ${maxAttempts} polling attempts`,
          );
        }

        // Extract response content
        const result = extractResponseContent(response);

        returnData.push({
          json: {
            response: result,
            queryName: queryName,
            status: response.status?.phase || "completed",
            agentName: agentName,
            sessionId: queryBody.sessionId || undefined,
            duration: response.status?.duration || null,
          },
          pairedItem: { item: i },
        });
      } catch (error: any) {
        if (this.continueOnFail()) {
          returnData.push({
            json: {
              error: error.message,
              agentName: agentName,
            },
            pairedItem: { item: i },
          });
          continue;
        }
        throw error;
      }
    }

    return [returnData];
  }
}
