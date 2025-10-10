import {
  IExecuteFunctions,
  ILoadOptionsFunctions,
  INodeExecutionData,
  INodePropertyOptions,
  INodeType,
  INodeTypeDescription,
} from 'n8n-workflow';

export class ArkModel implements INodeType {
  description: INodeTypeDescription = {
    displayName: 'ARK Model',
    name: 'arkModel',
    icon: 'file:ark-model.svg',
    group: ['transform'],
    version: 1,
    description: 'Query ARK models directly',
    defaults: {
      name: 'ARK Model',
    },
    inputs: ['main'],
    outputs: ['main'],
    credentials: [
      {
        name: 'arkApi',
        required: true,
      },
    ],
    properties: [
      {
        displayName: 'Model',
        name: 'model',
        type: 'options',
        typeOptions: {
          loadOptionsMethod: 'getModels',
        },
        default: '',
        required: true,
        description: 'The ARK model to query',
      },
      {
        displayName: 'Prompt',
        name: 'prompt',
        type: 'string',
        default: '',
        required: true,
        description: 'The prompt text for the model',
        placeholder: 'What is the capital of France?',
      },
      {
        displayName: 'Temperature',
        name: 'temperature',
        type: 'number',
        default: 0.7,
        description: 'Sampling temperature (0.0 to 1.0)',
        typeOptions: {
          minValue: 0,
          maxValue: 1,
          numberPrecision: 2,
        },
      },
      {
        displayName: 'Max Tokens',
        name: 'maxTokens',
        type: 'number',
        default: '',
        description: 'Maximum number of tokens to generate',
        placeholder: '100',
      },
    ],
  };

  methods = {
    loadOptions: {
      async getModels(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
        const credentials = await this.getCredentials('arkApi');
        const baseUrl = credentials.baseUrl as string;

        const response = await this.helpers.request({
          method: 'GET',
          url: `${baseUrl}/v1/models`,
          json: true,
        });

        return response.items.map((model: any) => ({
          name: `${model.name} (${model.model})`,
          value: model.name,
        }));
      },
    },
  };

  async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
    const items = this.getInputData();
    const returnData: INodeExecutionData[] = [];
    const credentials = await this.getCredentials('arkApi');
    const baseUrl = credentials.baseUrl as string;

    for (let i = 0; i < items.length; i++) {
      const model = this.getNodeParameter('model', i) as string;
      const prompt = this.getNodeParameter('prompt', i) as string;
      const temperature = this.getNodeParameter('temperature', i, 0.7) as number;
      const maxTokens = this.getNodeParameter('maxTokens', i, '') as number;

      const body: any = {
        prompt,
        temperature,
      };

      if (maxTokens) {
        body.maxTokens = maxTokens;
      }

      const response = await this.helpers.request({
        method: 'POST',
        url: `${baseUrl}/v1/models/${model}/query`,
        body,
        json: true,
      });

      returnData.push({ json: response });
    }

    return [returnData];
  }
}
