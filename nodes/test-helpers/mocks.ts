import {
  IExecuteFunctions,
  ILoadOptionsFunctions,
  INodeExecutionData,
  INodePropertyOptions,
} from 'n8n-workflow';

export function createMockExecuteFunctions(
  inputDataOrOptions?: INodeExecutionData[] | {
    inputData?: INodeExecutionData[];
    nodeParameters?: Record<string, any>;
    credentials?: Record<string, any>;
  },
  parameters?: Record<string, any>,
  credentials?: Record<string, any>
): Partial<IExecuteFunctions> {
  // Support both old signature (inputData, parameters, credentials) and new signature (options object)
  let inputData: INodeExecutionData[];
  let nodeParameters: Record<string, any>;
  let creds: Record<string, any>;

  if (Array.isArray(inputDataOrOptions)) {
    // Old signature: createMockExecuteFunctions(inputData, parameters, credentials)
    inputData = inputDataOrOptions;
    nodeParameters = parameters || {};
    creds = credentials || {
      baseUrl: 'http://ark-api.default.svc.cluster.local',
      token: 'test-token',
    };
  } else {
    // New signature: createMockExecuteFunctions({ inputData, nodeParameters, credentials })
    const options = inputDataOrOptions || {};
    inputData = options.inputData || [{ json: {} }];
    nodeParameters = options.nodeParameters || {};
    creds = options.credentials || {
      arkApi: {
        baseUrl: 'http://ark-api.default.svc.cluster.local',
        token: 'test-token',
      },
    };
  }

  return {
    getInputData: () => inputData,
    getNodeParameter: (parameterName: string, itemIndex: number) => {
      return nodeParameters[parameterName];
    },
    getCredentials: async <T extends object>(type: string, itemIndex?: number) => {
      return (creds[type] || creds) as T;
    },
    getWorkflow: () => ({
      id: 'test-workflow',
      name: 'Test Workflow',
    } as any),
    getExecutionId: () => 'test-execution',
    getInputConnectionData: async (
      inputName: string,
      itemIndex: number
    ): Promise<unknown> => {
      return null;
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
