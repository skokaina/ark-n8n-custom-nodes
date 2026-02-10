import {
  IExecuteFunctions,
  INodeExecutionData,
  INodeType,
  INodeTypeDescription,
} from "n8n-workflow";
import { extractResponseContent } from "../../utils/arkHelpers";

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
    inputs: ["main"],
    outputs: ["main"],
    credentials: [
      {
        name: "arkApi",
        required: true,
      },
    ],
    properties: [
      {
        displayName: "Agent Name",
        name: "agentName",
        type: "string",
        default: "",
        required: true,
        description: "Name of ARK agent to execute",
        placeholder: "data-analyzer-agent",
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
        displayName: "Memory",
        name: "memory",
        type: "string",
        default: "",
        description:
          "Optional memory resource name for conversation history",
        placeholder: "conversation-memory",
      },
      {
        displayName: "Session ID",
        name: "sessionId",
        type: "string",
        default: "",
        description:
          "Optional session ID for memory persistence (auto-generated if empty)",
        placeholder: "user-123-session",
      },
    ],
  };

  async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
    const items = this.getInputData();
    const returnData: INodeExecutionData[] = [];

    const agentName = this.getNodeParameter("agentName", 0) as string;
    const namespace = this.getNodeParameter("namespace", 0) as string;
    const timeout = this.getNodeParameter("timeout", 0) as string;
    const memory = this.getNodeParameter("memory", 0) as string;
    const sessionId = this.getNodeParameter("sessionId", 0) as string;

    const credentials = await this.getCredentials("arkApi");
    const baseUrl = credentials.baseUrl as string;

    for (let i = 0; i < items.length; i++) {
      try {
        // Get input from previous node
        // Try 'input' field first, fallback to entire JSON
        const input =
          (items[i].json.input as string) || JSON.stringify(items[i].json);

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

        // Add optional memory configuration
        if (memory && memory.trim() !== "") {
          queryBody.memory = {
            name: memory.trim(),
            namespace: namespace,
          };
        }

        // Add optional session ID
        if (sessionId && sessionId.trim() !== "") {
          queryBody.sessionId = sessionId.trim();
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
