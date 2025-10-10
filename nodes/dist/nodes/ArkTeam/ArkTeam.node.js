"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ArkTeam = void 0;
class ArkTeam {
    constructor() {
        this.description = {
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
        this.methods = {
            loadOptions: {
                async getTeams() {
                    const credentials = await this.getCredentials('arkApi');
                    const baseUrl = credentials.baseUrl;
                    const response = await this.helpers.request({
                        method: 'GET',
                        url: `${baseUrl}/v1/teams`,
                        json: true,
                    });
                    return response.items.map((team) => ({
                        name: team.name,
                        value: team.name,
                    }));
                },
            },
        };
    }
    async execute() {
        const items = this.getInputData();
        const returnData = [];
        const credentials = await this.getCredentials('arkApi');
        const baseUrl = credentials.baseUrl;
        for (let i = 0; i < items.length; i++) {
            const team = this.getNodeParameter('team', i);
            const input = this.getNodeParameter('input', i);
            const wait = this.getNodeParameter('wait', i);
            const timeout = this.getNodeParameter('timeout', i, '300s');
            const body = {
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
exports.ArkTeam = ArkTeam;
//# sourceMappingURL=ArkTeam.node.js.map