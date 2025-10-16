import {
  IExecuteFunctions,
  ILoadOptionsFunctions,
  INodeExecutionData,
  INodePropertyOptions,
  INodeType,
  INodeTypeDescription,
} from "n8n-workflow";

export class ArkAgent implements INodeType {
  description: INodeTypeDescription = {
    displayName: "ARK Agent",
    name: "arkAgent",
    icon: "file:ark-agent.svg",
    group: ["transform"],
    version: 1,
    description: "Execute ARK agent queries",
    defaults: {
      name: "ARK Agent",
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
        default: "",
        required: true,
        description: "The input text for the agent",
        placeholder: "What can you help me with?",
      },
      {
        displayName: "Wait for Completion",
        name: "wait",
        type: "boolean",
        default: true,
        description: "Whether to wait for the query to complete (when false, streaming is enabled)",
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
      const agent = this.getNodeParameter("agent", i) as string;
      const input = this.getNodeParameter("input", i) as string;
      const wait = this.getNodeParameter("wait", i) as boolean;

      const queryName = `n8n-${agent}-${Date.now()}`;

      const queryBody: any = {
        name: queryName,
        type: "user",
        input: input,
        targets: [
          {
            type: "agent",
            name: agent,
          },
        ],
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
            message: "Query created, not waiting for completion"
          }
        });
        continue;
      }

      let attempts = 0;
      const maxAttempts = 60;
      let response: any = null;

      while (attempts < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, 5000));

        const queryStatus = await this.helpers.request({
          method: "GET",
          url: `${baseUrl}/v1/queries/${queryName}`,
          json: true,
        });

        if (queryStatus.status?.phase === "done") {
          response = queryStatus;
          break;
        } else if (queryStatus.status?.phase === "error") {
          throw new Error(`Query failed: ${queryStatus.status?.responses?.[0]?.content || "Unknown error"}`);
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
        response: response.status?.responses?.[0]?.content || "",
        duration: response.status?.duration || null,
      };

      returnData.push({ json: output });
    }

    return [returnData];
  }
}
