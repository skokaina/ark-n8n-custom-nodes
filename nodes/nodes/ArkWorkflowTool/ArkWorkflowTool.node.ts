import {
  IExecuteFunctions,
  ILoadOptionsFunctions,
  INodeExecutionData,
  INodePropertyOptions,
  INodeType,
  INodeTypeDescription,
} from "n8n-workflow";

export class ArkWorkflowTool implements INodeType {
  description: INodeTypeDescription = {
    displayName: "ARK Workflow Tool",
    name: "arkWorkflowTool",
    icon: "fa:project-diagram",
    group: ["transform"],
    version: 1,
    description: "Execute n8n workflows programmatically",
    defaults: {
      name: "ARK Workflow Tool",
    },
    inputs: ["main"],
    outputs: ["main"],
    credentials: [
      {
        name: "n8nApi",
        required: true,
      },
    ],
    properties: [
      {
        displayName: "Workflow",
        name: "workflowId",
        type: "options",
        typeOptions: {
          loadOptionsMethod: "getWorkflows",
        },
        default: "",
        required: true,
        description: "The n8n workflow to execute",
      },
      {
        displayName: "Wait for Completion",
        name: "wait",
        type: "boolean",
        default: true,
        description:
          "Whether to wait for the workflow execution to complete before continuing",
      },
      {
        displayName: "Pass Input Data",
        name: "passInputData",
        type: "boolean",
        default: true,
        description:
          "Whether to pass the input data from the previous node to the workflow",
      },
      {
        displayName: "Additional Parameters",
        name: "additionalParameters",
        type: "json",
        default: "{}",
        description:
          "Additional parameters to pass to the workflow (JSON format)",
        placeholder: '{"key": "value"}',
      },
      {
        displayName: "Timeout",
        name: "timeout",
        type: "number",
        default: 60,
        displayOptions: {
          show: {
            wait: [true],
          },
        },
        description: "Maximum time to wait for completion (in seconds)",
      },
    ],
  };

  methods = {
    loadOptions: {
      async getWorkflows(
        this: ILoadOptionsFunctions,
      ): Promise<INodePropertyOptions[]> {
        const credentials = await this.getCredentials("n8nApi");
        const baseUrl = credentials.baseUrl as string;
        const apiKey = credentials.apiKey as string;

        try {
          const response = await this.helpers.request({
            method: "GET",
            url: `${baseUrl}/api/v1/workflows`,
            headers: {
              "X-N8N-API-KEY": apiKey,
            },
            json: true,
          });

          return response.data.map((workflow: any) => ({
            name: workflow.name,
            value: workflow.id,
            description: workflow.tags?.join(", ") || "",
          }));
        } catch (error: any) {
          throw new Error(`Failed to load workflows: ${error.message}`);
        }
      },
    },
  };

  async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
    const items = this.getInputData();
    const returnData: INodeExecutionData[] = [];

    const credentials = await this.getCredentials("n8nApi");
    const baseUrl = credentials.baseUrl as string;
    const apiKey = credentials.apiKey as string;

    const workflowId = this.getNodeParameter("workflowId", 0) as string;
    const wait = this.getNodeParameter("wait", 0) as boolean;
    const passInputData = this.getNodeParameter("passInputData", 0) as boolean;
    const timeout = this.getNodeParameter("timeout", 0, 60) as number;

    for (let i = 0; i < items.length; i++) {
      try {
        // Parse additional parameters
        let additionalParams = {};
        const additionalParamsString = this.getNodeParameter(
          "additionalParameters",
          i,
          "{}",
        ) as string;
        try {
          additionalParams = JSON.parse(additionalParamsString);
        } catch (error: any) {
          throw new Error(
            `Invalid JSON in Additional Parameters: ${error.message}`,
          );
        }

        // Build execution payload
        const executionData: any = {
          ...additionalParams,
        };

        // Include input data if enabled
        if (passInputData) {
          executionData.input = items[i].json;
        }

        // Execute workflow via n8n API
        const executeUrl = `${baseUrl}/api/v1/workflows/${workflowId}/execute`;

        console.log(`[ArkWorkflowTool] Executing workflow ${workflowId}`);
        console.log(
          `[ArkWorkflowTool] Execution data:`,
          JSON.stringify(executionData),
        );

        const startTime = Date.now();
        const response = await this.helpers.request({
          method: "POST",
          url: executeUrl,
          headers: {
            "X-N8N-API-KEY": apiKey,
            "Content-Type": "application/json",
          },
          body: executionData,
          json: true,
          timeout: wait ? timeout * 1000 : 30000, // Convert to milliseconds
        });

        const duration = ((Date.now() - startTime) / 1000).toFixed(2);

        console.log(
          `[ArkWorkflowTool] Workflow executed in ${duration}s`,
          response,
        );

        // Extract result from response
        let result: any = {};
        let executionId = "";
        let status = "unknown";

        if (response.data) {
          // Response contains execution result
          executionId = response.data.executionId || response.data.id || "";
          status = response.data.finished ? "completed" : "running";

          // Extract output data from last node
          if (response.data.data && response.data.data.resultData) {
            const runData = response.data.data.resultData.runData;
            // Get the last node's output
            const nodeNames = Object.keys(runData);
            if (nodeNames.length > 0) {
              const lastNode = nodeNames[nodeNames.length - 1];
              const lastNodeData = runData[lastNode];
              if (
                lastNodeData &&
                lastNodeData.length > 0 &&
                lastNodeData[0].data?.main?.[0]
              ) {
                result = lastNodeData[0].data.main[0].map((item: any) =>
                  item.json ? item.json : item,
                );
              }
            }
          }
        } else {
          // Async execution
          executionId = response.executionId || response.id || "";
          status = "pending";
          result = { message: "Workflow execution started asynchronously" };
        }

        returnData.push({
          json: {
            workflowId,
            executionId,
            status,
            duration: `${duration}s`,
            result,
            success: true,
          },
          pairedItem: { item: i },
        });
      } catch (error: any) {
        if (this.continueOnFail()) {
          returnData.push({
            json: {
              workflowId,
              error: error.message,
              success: false,
            },
            pairedItem: { item: i },
          });
          continue;
        }
        throw new Error(`Workflow execution failed: ${error.message}`);
      }
    }

    return [returnData];
  }
}
