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

export class ArkModelSelector implements INodeType {
  description: INodeTypeDescription = {
    displayName: "ARK Model Selector",
    name: "arkModelSelector",
    icon: "fa:sliders-h",
    group: ["transform"],
    version: 1,
    description:
      "Select and output ARK model configuration for agent connections",
    defaults: {
      name: "ARK Model Selector",
    },
    inputs: ["main"],
    outputs: [
      {
        displayName: "Model",
        type: "ai_languageModel",
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
        displayName: "Model",
        name: "model",
        type: "options",
        typeOptions: {
          loadOptionsMethod: "getModels",
        },
        default: "",
        required: true,
        description: "The ARK model to use",
      },
    ],
  };

  methods = {
    loadOptions: {
      async getModels(
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
              url: `${baseUrl}/v1/namespaces/${namespace}/models`,
              json: true,
            });
          } catch (namespacedError) {
            // Fallback to non-namespaced endpoint
            response = await this.helpers.request({
              method: "GET",
              url: `${baseUrl}/v1/models`,
              json: true,
            });
          }

          const models = response.items || response || [];

          if (Array.isArray(models) && models.length > 0) {
            return models.map((model: any) => {
              const modelName = model.metadata?.name || model.name;
              const modelType = model.spec?.model || model.model;
              const provider = model.spec?.provider || model.type;

              return {
                name: `${modelName} (${provider}: ${modelType})`,
                value: modelName,
              };
            });
          }

          // Fallback if no models found
          throw new Error("No models found");
        } catch (error) {
          // Fallback to common models if API fails
          return [
            { name: "GPT-4", value: "gpt-4" },
            { name: "Default", value: "default" },
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
      const modelName = this.getNodeParameter("model", i) as string;

      // Fetch model details from ARK API
      let provider = "openai";
      let modelType = modelName;
      let temperature = 0.7;

      try {
        const modelResponse = await this.helpers.request({
          method: "GET",
          url: `${baseUrl}/v1/namespaces/${namespace}/models/${modelName}`,
          json: true,
        });

        provider =
          modelResponse.spec?.provider || modelResponse.type || "openai";
        modelType =
          modelResponse.spec?.model || modelResponse.model || modelName;
        temperature = modelResponse.spec?.temperature || 0.7;
      } catch (error) {
        // Use defaults if fetch fails
      }

      // Output model data in format expected by ArkAgentAdvanced
      const modelData = {
        name: modelName,
        namespace: namespace,
        provider: provider,
        model: modelType,
        temperature: temperature,
        // Additional metadata for n8n ai_languageModel connection type
        modelName: modelName,
      };

      returnData.push({
        json: modelData,
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
    const modelName = this.getNodeParameter("model", itemIndex) as string;

    const modelData = {
      name: modelName,
      namespace: namespace,
      modelName: modelName,
    };

    return { response: modelData };
  }
}
