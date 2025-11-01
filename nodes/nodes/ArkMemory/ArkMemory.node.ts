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

export class ArkMemory implements INodeType {
  description: INodeTypeDescription = {
    displayName: "ARK Memory",
    name: "arkMemory",
    icon: "file:ark-memory.svg",
    group: ["transform"],
    version: 1,
    description:
      "Select and output ARK memory configuration for agent connections",
    defaults: {
      name: "ARK Memory",
    },
    inputs: ["main"],
    outputs: [
      {
        displayName: "Memory",
        type: "ai_memory",
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
        displayName: "Memory",
        name: "memory",
        type: "options",
        typeOptions: {
          loadOptionsMethod: "getMemories",
        },
        default: "",
        required: true,
        description: "The ARK Memory resource to use",
      },
    ],
  };

  methods = {
    loadOptions: {
      async getMemories(
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
              url: `${baseUrl}/v1/namespaces/${namespace}/memories`,
              json: true,
            });
          } catch (namespacedError) {
            // Fallback to non-namespaced endpoint
            response = await this.helpers.request({
              method: "GET",
              url: `${baseUrl}/v1/memories`,
              json: true,
            });
          }

          const memories = response.items || response || [];

          if (Array.isArray(memories) && memories.length > 0) {
            return memories.map((memory: any) => {
              const memoryName = memory.metadata?.name || memory.name;
              const memoryType = memory.spec?.type || "buffer";

              return {
                name: `${memoryName} (${memoryType})`,
                value: memoryName,
              };
            });
          }

          // Return empty if no memories found
          return [];
        } catch (error) {
          // If memories endpoint fails, return empty array
          return [];
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
      const memoryName = this.getNodeParameter("memory", i) as string;

      // Fetch memory details from ARK API
      let memoryType = "buffer";
      let maxMessages = 20;

      try {
        const memoryResponse = await this.helpers.request({
          method: "GET",
          url: `${baseUrl}/v1/namespaces/${namespace}/memories/${memoryName}`,
          json: true,
        });

        memoryType = memoryResponse.spec?.type || "buffer";
        maxMessages = memoryResponse.spec?.maxMessages || 20;
      } catch (error) {
        // Use defaults if fetch fails
      }

      // Output memory data in format expected by ArkAgentAdvanced
      const memoryData = {
        name: memoryName,
        namespace: namespace,
        type: memoryType,
        maxMessages: maxMessages,
        // Additional metadata for n8n ai_memory connection type
        memoryName: memoryName,
      };

      returnData.push({
        json: memoryData,
        pairedItem: { item: i },
      });
    }

    return [returnData];
  }

  async supplyData(
    this: ISupplyDataFunctions,
    itemIndex: number,
  ): Promise<SupplyData> {
    const credentials = await this.getCredentials("arkApi");
    const namespace = (credentials.namespace as string) || "default";

    const memoryName = this.getNodeParameter("memory", itemIndex) as string;

    const memoryData = {
      name: memoryName,
      namespace: namespace,
      memoryName: memoryName,
    };

    return { response: memoryData };
  }
}
