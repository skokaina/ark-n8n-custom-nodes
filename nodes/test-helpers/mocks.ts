import {
  IExecuteFunctions,
  ILoadOptionsFunctions,
  INodeExecutionData,
  INodePropertyOptions,
} from 'n8n-workflow';

export function createMockExecuteFunctions(
  inputData: INodeExecutionData[] = [],
  parameters: Record<string, any> = {}
): Partial<IExecuteFunctions> {
  return {
    getInputData: () => inputData,
    getNodeParameter: (parameterName: string, itemIndex: number) => {
      return parameters[parameterName];
    },
    getCredentials: async <T extends object>(type: string, itemIndex?: number) => {
      return {
        baseUrl: 'http://ark-api.default.svc.cluster.local',
        token: 'test-token',
      } as T;
    },
    helpers: {
      request: jest.fn(),
    } as any,
  };
}

export function createMockLoadOptionsFunctions(): Partial<ILoadOptionsFunctions> {
  return {
    getCredentials: async <T extends object>(type: string, itemIndex?: number) => {
      return {
        baseUrl: 'http://ark-api.default.svc.cluster.local',
        token: 'test-token',
      } as T;
    },
    helpers: {
      request: jest.fn(),
    } as any,
  };
}

export function createMockNodeExecutionData(json: any): INodeExecutionData {
  return {
    json,
  };
}
