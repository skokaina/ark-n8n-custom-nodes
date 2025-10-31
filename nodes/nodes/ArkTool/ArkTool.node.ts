import {
  IExecuteFunctions,
  ILoadOptionsFunctions,
  INodeExecutionData,
  INodePropertyOptions,
  INodeType,
  INodeTypeDescription,
  ISupplyDataFunctions,
  SupplyData,
} from "n8n-workflow";

export class ArkTool implements INodeType {
  description: INodeTypeDescription = {
    displayName: "ARK Tool",
    name: "arkTool",
    icon: "file:ark-tool.svg",
    group: ["transform"],
    version: 1,
    description:
      "Select and output ARK tool configuration for agent connections",
    defaults: {
      name: "ARK Tool",
    },
    inputs: ["main"],
    outputs: [
      {
        displayName: "Tool",
        type: "ai_tool",
      },
    ],
    credentials: [
      {
        name: "arkApi",
        required: true,
      },
    ],
    properties: [
      {
        displayName: "Tool Selection Mode",
        name: "selectionMode",
        type: "options",
        options: [
          {
            name: "Select from Available Tools",
            value: "select",
            description: "Choose a tool from ARK cluster",
          },
          {
            name: "Specify Tool Manually",
            value: "manual",
            description: "Enter tool name and type manually",
          },
        ],
        default: "select",
        description: "How to specify the tool",
      },
      {
        displayName: "Tool",
        name: "tool",
        type: "options",
        typeOptions: {
          loadOptionsMethod: "getTools",
        },
        displayOptions: {
          show: {
            selectionMode: ["select"],
          },
        },
        default: "",
        required: true,
        description: "The ARK tool to output",
      },
      {
        displayName: "Tool Name",
        name: "toolName",
        type: "string",
        displayOptions: {
          show: {
            selectionMode: ["manual"],
          },
        },
        default: "",
        required: true,
        placeholder: "web-search",
        description: "The name of the tool",
      },
      {
        displayName: "Tool Type",
        name: "toolType",
        type: "options",
        options: [
          {
            name: "Built-in",
            value: "builtin",
            description: "ARK built-in tool",
          },
          {
            name: "Custom",
            value: "custom",
            description: "Custom tool CRD",
          },
          {
            name: "MCP",
            value: "mcp",
            description: "Model Context Protocol server",
          },
        ],
        displayOptions: {
          show: {
            selectionMode: ["manual"],
          },
        },
        default: "builtin",
        description: "The type of tool",
      },
    ],
  };

  methods = {
    loadOptions: {
      async getTools(
        this: ILoadOptionsFunctions,
      ): Promise<INodePropertyOptions[]> {
        const credentials = await this.getCredentials("arkApi");
        const baseUrl = credentials.baseUrl as string;
        const namespace = (credentials.namespace as string) || "default";

        try {
          // Try namespaced endpoint first
          let response;
          try {
            response = await this.helpers.request({
              method: "GET",
              url: `${baseUrl}/v1/namespaces/${namespace}/tools`,
              json: true,
            });
          } catch (namespacedError) {
            // Fallback to non-namespaced endpoint
            response = await this.helpers.request({
              method: "GET",
              url: `${baseUrl}/v1/tools`,
              json: true,
            });
          }

          // Map tools to dropdown options
          const tools = response.items || response || [];

          if (Array.isArray(tools) && tools.length > 0) {
            return tools.map((tool: any) => {
              const toolName = tool.metadata?.name || tool.name;
              const toolDescription =
                tool.spec?.description || tool.description || "";

              return {
                name: `${toolName}${toolDescription ? ` - ${toolDescription}` : ""}`,
                value: toolName,
                description: toolDescription,
              };
            });
          }

          // If no tools found, return fallback
          throw new Error("No tools found");
        } catch (error) {
          // If tools endpoint fails or returns no data, return built-in tools
          return [
            {
              name: "Web Search - Built-in web search capability",
              value: "web-search",
              description: "Search the web for information",
            },
            {
              name: "Code Interpreter - Built-in code execution",
              value: "code-interpreter",
              description: "Execute code and return results",
            },
            {
              name: "Calculator - Built-in calculator",
              value: "calculator",
              description: "Perform mathematical calculations",
            },
          ];
        }
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
      const selectionMode = this.getNodeParameter("selectionMode", i) as string;

      let toolName: string;
      let toolType: string;
      let toolDescription = "";

      if (selectionMode === "select") {
        // Get selected tool from dropdown
        toolName = this.getNodeParameter("tool", i) as string;
      } else {
        toolName = this.getNodeParameter("toolName", i) as string;
      }

      // Fetch tool details from ARK API
      try {
        const toolResponse = await this.helpers.request({
          method: "GET",
          url: `${baseUrl}/v1/tools/${toolName}?namespace=${namespace}`,
          json: true,
        });

        toolDescription =
          toolResponse.spec?.description || toolResponse.description || "";

        // Determine tool type based on ARK tool object
        if (toolResponse.spec?.mcp || toolResponse.type === "mcp") {
          toolType = "mcp";
        } else if (toolResponse.spec?.builtin || toolResponse.builtin) {
          toolType = "builtin";
        } else {
          toolType = "custom";
        }
      } catch (error) {
        console.log("Error fetching tool details:", error);
        continue;
      }

      // Output tool data in format expected by ArkAgentAdvanced
      const toolData = {
        name: toolName,
        type: toolType,
        description: toolDescription,
        // Additional metadata for n8n ai_tool connection type
        toolName: toolName,
      };

      returnData.push({
        json: toolData,
        pairedItem: { item: i },
      });
    }

    if (returnData.length === 0) {
      return [];
    }

    return [returnData];
  }

  async supplyData(
    this: ISupplyDataFunctions,
    itemIndex: number,
  ): Promise<SupplyData> {
    const credentials = await this.getCredentials("arkApi");
    const baseUrl = credentials.baseUrl as string;
    const namespace = (credentials.namespace as string) || "default";
    const selectionMode = this.getNodeParameter(
      "selectionMode",
      itemIndex,
    ) as string;

    let toolName: string;
    let toolType: string;
    let toolDescription = "";

    if (selectionMode === "select") {
      // Get selected tool from dropdown
      toolName = this.getNodeParameter("tool", itemIndex) as string;
    } else {
      toolName = this.getNodeParameter("toolName", itemIndex) as string;
    }

    // Fetch tool details from ARK API
    try {
      const toolResponse = await this.helpers.request({
        method: "GET",
        url: `${baseUrl}/v1/tools/${toolName}?namespace=${namespace}`,
        json: true,
      });

      toolDescription =
        toolResponse.spec?.description || toolResponse.description || "";

      // Determine tool type based on ARK tool object
      if (toolResponse.spec?.mcp || toolResponse.type === "mcp") {
        toolType = "mcp";
      } else if (toolResponse.spec?.builtin || toolResponse.builtin) {
        toolType = "builtin";
      } else {
        toolType = "custom";
      }
    } catch (error) {
      console.log("Error fetching tool details:", error);
      return { response: null };
    }

    const toolData = {
      name: toolName,
      namespace: namespace,
      type: toolType,
      description: toolDescription,
    };

    return { response: toolData };
  }
}
