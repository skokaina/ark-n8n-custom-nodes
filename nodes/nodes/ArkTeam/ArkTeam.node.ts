import {
  IExecuteFunctions,
  ILoadOptionsFunctions,
  INodeExecutionData,
  INodePropertyOptions,
  INodeType,
  INodeTypeDescription,
} from 'n8n-workflow';

export class ArkTeam implements INodeType {
  description: INodeTypeDescription = {
    displayName: 'ARK Team',
    name: 'arkTeam',
    icon: 'file:ark-team.svg',
    group: ['transform'],
    version: 1,
    description: 'Execute ARK team-based multi-agent workflows',
    defaults: {
      name: 'ARK Team',
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
        displayName: 'Team',
        name: 'team',
        type: 'options',
        typeOptions: {
          loadOptionsMethod: 'getTeams',
        },
        default: '',
        required: true,
        description: 'The ARK team to execute',
      },
      {
        displayName: 'Input',
        name: 'input',
        type: 'string',
        default: '',
        required: true,
        description: 'The input text for the team',
        placeholder: 'Coordinate this task across agents',
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
    ],
  };

  methods = {
    loadOptions: {
      async getTeams(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
        const credentials = await this.getCredentials('arkApi');
        const baseUrl = credentials.baseUrl as string;

        const response = await this.helpers.request({
          method: 'GET',
          url: `${baseUrl}/v1/teams`,
          json: true,
        });

        return response.items.map((team: any) => ({
          name: team.name,
          value: team.name,
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
      const team = this.getNodeParameter('team', i) as string;
      const input = this.getNodeParameter('input', i) as string;
      const wait = this.getNodeParameter('wait', i) as boolean;
      const timeout = this.getNodeParameter('timeout', i, '300s') as string;

      const body: any = {
        input,
        wait,
        timeout,
      };

      const response = await this.helpers.request({
        method: 'POST',
        url: `${baseUrl}/v1/teams/${team}/execute`,
        body,
        json: true,
      });

      returnData.push({ json: response });
    }

    return [returnData];
  }
}
