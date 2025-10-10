import {
  IExecuteFunctions,
  ILoadOptionsFunctions,
  INodeExecutionData,
  INodePropertyOptions,
  INodeType,
  INodeTypeDescription,
} from 'n8n-workflow';

export class ArkAgent implements INodeType {
  description: INodeTypeDescription = {
    displayName: 'ARK Agent',
    name: 'arkAgent',
    icon: 'file:ark-agent.svg',
    group: ['transform'],
    version: 1,
    description: 'Execute ARK agent queries',
    defaults: {
      name: 'ARK Agent',
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
        displayName: 'Agent',
        name: 'agent',
        type: 'options',
        typeOptions: {
          loadOptionsMethod: 'getAgents',
        },
        default: '',
        required: true,
        description: 'The ARK agent to execute',
      },
      {
        displayName: 'Input',
        name: 'input',
        type: 'string',
        default: '',
        required: true,
        description: 'The input text for the agent',
        placeholder: 'What can you help me with?',
      },
      {
        displayName: 'Wait for Completion',
        name: 'wait',
        type: 'boolean',
        default: true,
        description: 'Whether to wait for the query to complete',
      },
      {
        displayName: 'Timeout',
        name: 'timeout',
        type: 'string',
        default: '300s',
        description: 'Maximum time to wait for completion (e.g., "60s", "5m")',
        placeholder: '300s',
      },
      {
        displayName: 'Session ID',
        name: 'sessionId',
        type: 'string',
        default: '',
        description: 'Optional session ID for context persistence',
        placeholder: 'user-session-123',
      },
      {
        displayName: 'Memory',
        name: 'memory',
        type: 'string',
        default: '',
        description: 'Optional memory resource name',
        placeholder: 'conversation-memory',
      },
    ],
  };

  methods = {
    loadOptions: {
      async getAgents(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
        const credentials = await this.getCredentials('arkApi');
        const baseUrl = credentials.baseUrl as string;

        const response = await this.helpers.request({
          method: 'GET',
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
    const credentials = await this.getCredentials('arkApi');
    const baseUrl = credentials.baseUrl as string;

    for (let i = 0; i < items.length; i++) {
      const agent = this.getNodeParameter('agent', i) as string;
      const input = this.getNodeParameter('input', i) as string;
      const wait = this.getNodeParameter('wait', i) as boolean;
      const timeout = this.getNodeParameter('timeout', i, '300s') as string;
      const sessionId = this.getNodeParameter('sessionId', i, '') as string;
      const memory = this.getNodeParameter('memory', i, '') as string;

      const body: any = {
        input,
        wait,
        timeout,
      };

      if (sessionId) {
        body.sessionId = sessionId;
      }

      if (memory) {
        body.memory = memory;
      }

      const response = await this.helpers.request({
        method: 'POST',
        url: `${baseUrl}/v1/agents/${agent}/execute`,
        body,
        json: true,
      });

      returnData.push({ json: response });
    }

    return [returnData];
  }
}
