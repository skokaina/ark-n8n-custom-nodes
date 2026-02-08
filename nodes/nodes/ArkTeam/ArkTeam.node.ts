import {
  IExecuteFunctions,
  ILoadOptionsFunctions,
  INodeExecutionData,
  INodePropertyOptions,
  INodeType,
  INodeTypeDescription,
} from "n8n-workflow";

export class ArkTeam implements INodeType {
  description: INodeTypeDescription = {
    displayName: "ARK Team",
    name: "arkTeam",
    icon: "fa:users",
    group: ["transform"],
    version: 1,
    description: "Execute ARK team-based multi-agent workflows",
    defaults: {
      name: "ARK Team",
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
        displayName: "Team",
        name: "team",
        type: "options",
        typeOptions: {
          loadOptionsMethod: "getTeams",
        },
        default: "",
        required: true,
        description: "The ARK team to execute",
      },
      {
        displayName: "Input",
        name: "input",
        type: "string",
        default: "",
        required: true,
        description: "The input text for the team",
        placeholder: "Coordinate this task across agents",
      },
      {
        displayName: "Wait for Completion",
        name: "wait",
        type: "boolean",
        default: true,
        description:
          "Whether to wait for the query to complete (when false, streaming is enabled)",
      },
    ],
  };

  methods = {
    loadOptions: {
      async getTeams(
        this: ILoadOptionsFunctions,
      ): Promise<INodePropertyOptions[]> {
        const credentials = await this.getCredentials("arkApi");
        const baseUrl = credentials.baseUrl as string;

        const response = await this.helpers.request({
          method: "GET",
          url: `${baseUrl}/v1/teams`,
          json: true,
        });

        return response.items.map((team: any) => ({
          name: team.name,
          value: team.name,
        }));
      },
    },
  };

  async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
    const items = this.getInputData();
    const returnData: INodeExecutionData[] = [];
    const credentials = await this.getCredentials("arkApi");
    const baseUrl = credentials.baseUrl as string;

    for (let i = 0; i < items.length; i++) {
      const team = this.getNodeParameter("team", i) as string;
      const input = this.getNodeParameter("input", i) as string;
      const wait = this.getNodeParameter("wait", i) as boolean;

      const queryName = `n8n-${team}-${Date.now()}`;

      // Get workflow and execution context
      const workflow = this.getWorkflow();
      const executionId = this.getExecutionId();

      // Get session ID from chat session (if available from input data)
      const itemData = items[i].json;
      const chatSessionId =
        itemData.sessionId ||
        itemData.chatSessionId ||
        itemData.session_id ||
        itemData.chat_session_id ||
        "unknown";

      const queryBody: any = {
        name: queryName,
        type: "user",
        input: input,
        targets: [
          {
            type: "team",
            name: team,
          },
        ],
        metadata: {
          annotations: {
            "ark.mckinsey.com/run-id": executionId,
            "ark.mckinsey.com/workflow-id": workflow.id,
            "ark.mckinsey.com/session-id": chatSessionId,
          },
          labels: {
            n8n_workflow_name: workflow.name ?? "unknown",
            n8n_workflow_id: workflow.id ?? "unknown",
            n8n_execution_id: executionId,
            n8n_team_name: team,
            n8n_session_id: chatSessionId,
          },
        },
      };

      await this.helpers.request({
        method: "POST",
        url: `${baseUrl}/v1/queries`,
        body: queryBody,
        json: true,
      });

      if (!wait) {
        returnData.push({
          json: {
            queryName: queryName,
            status: "pending",
            message: "Query created, not waiting for completion",
          },
        });
        continue;
      }

      let attempts = 0;
      const maxAttempts = 60;
      let response: any = null;

      while (attempts < maxAttempts) {
        await new Promise((resolve) => setTimeout(resolve, 5000));

        const queryStatus = await this.helpers.request({
          method: "GET",
          url: `${baseUrl}/v1/queries/${queryName}`,
          json: true,
        });

        if (queryStatus.status?.phase === "done") {
          response = queryStatus;
          break;
        } else if (queryStatus.status?.phase === "error") {
          throw new Error(
            `Query failed: ${queryStatus.status?.response?.content || "Unknown error"}`,
          );
        }

        attempts++;
      }

      if (!response) {
        throw new Error(`Query timed out after ${maxAttempts * 5} seconds`);
      }

      const output = {
        queryName: queryName,
        status: response.status?.phase || "unknown",
        input: input,
        response: response.status?.response?.content || "",
        duration: response.status?.duration || null,
      };

      returnData.push({ json: output });
    }

    return [returnData];
  }
}
