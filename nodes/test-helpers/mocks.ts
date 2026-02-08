import {
  IExecuteFunctions,
  ILoadOptionsFunctions,
  INodeExecutionData,
  INodePropertyOptions,
  ISupplyDataFunctions,
} from 'n8n-workflow';

export function createMockExecuteFunctions(
  inputDataOrOptions?: INodeExecutionData[] | {
    inputData?: INodeExecutionData[];
    parameters?: Record<string, any>;
    nodeParameters?: Record<string, any>;
    credentials?: Record<string, any>;
    helpers?: any;
    workflow?: any;
    executionId?: string;
  },
  parameters?: Record<string, any>,
  credentials?: Record<string, any>
): Partial<IExecuteFunctions> & { helpers: any } {
  // Support both old signature (inputData, parameters, credentials) and new signature (options object)
  let inputData: INodeExecutionData[];
  let nodeParameters: Record<string, any>;
  let creds: Record<string, any>;
  let helpers: any;
  let workflow: any;
  let executionId: string;

  if (Array.isArray(inputDataOrOptions)) {
    // Old signature: createMockExecuteFunctions(inputData, parameters, credentials)
    inputData = inputDataOrOptions;
    nodeParameters = parameters || {};
    creds = credentials || {
      baseUrl: 'http://ark-api.default.svc.cluster.local',
      token: 'test-token',
    };
    helpers = { request: jest.fn() };
    workflow = { id: 'test-workflow', name: 'Test Workflow' };
    executionId = 'test-execution';
  } else {
    // New signature: createMockExecuteFunctions({ inputData, nodeParameters, credentials })
    const options = inputDataOrOptions || {};
    inputData = options.inputData || [{ json: {} }];
    nodeParameters = options.parameters || options.nodeParameters || {};
    creds = options.credentials || {
      arkApi: {
        baseUrl: 'http://ark-api.default.svc.cluster.local',
        token: 'test-token',
      },
    };
    helpers = options.helpers || { request: jest.fn() };
    workflow = options.workflow || { id: 'test-workflow', name: 'Test Workflow' };
    executionId = options.executionId || 'test-execution';
  }

  return {
    getInputData: () => inputData,
    getNodeParameter: (parameterName: string, itemIndex: number) => {
      return nodeParameters[parameterName];
    },
    getCredentials: async <T extends object>(type: string, itemIndex?: number) => {
      return (creds[type] || creds) as T;
    },
    getWorkflow: () => workflow as any,
    getExecutionId: () => executionId,
    getInputConnectionData: async (
      inputName: string,
      itemIndex: number
    ): Promise<unknown> => {
      return null;
    },
    continueOnFail: () => false,
    helpers: helpers as any,
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

export function createMockSupplyDataFunctions(
  options?: {
    parameters?: Record<string, any>;
    credentials?: Record<string, any>;
    helpers?: any;
  }
): Partial<ISupplyDataFunctions> & { helpers: any } {
  const nodeParameters = options?.parameters || {};
  const creds = options?.credentials || {
    arkApi: {
      baseUrl: 'http://ark-api.default.svc.cluster.local',
      token: 'test-token',
    },
  };
  const helpers = options?.helpers || { request: jest.fn() };

  return {
    getNodeParameter: (parameterName: string, itemIndex: number) => {
      return nodeParameters[parameterName];
    },
    getCredentials: async <T extends object>(type: string, itemIndex?: number) => {
      return (creds[type] || creds) as T;
    },
    helpers: helpers as any,
  };
}
