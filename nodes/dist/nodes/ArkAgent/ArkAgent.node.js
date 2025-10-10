"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ArkAgent = void 0;
class ArkAgent {
    constructor() {
        this.description = {
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
        this.methods = {
            loadOptions: {
                async getAgents() {
                    const credentials = await this.getCredentials('arkApi');
                    const baseUrl = credentials.baseUrl;
                    const response = await this.helpers.request({
                        method: 'GET',
                        url: `${baseUrl}/v1/agents`,
                        json: true,
                    });
                    return response.items.map((agent) => ({
                        name: agent.name,
                        value: agent.name,
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
            const agent = this.getNodeParameter('agent', i);
            const input = this.getNodeParameter('input', i);
            const wait = this.getNodeParameter('wait', i);
            const timeout = this.getNodeParameter('timeout', i, '300s');
            const sessionId = this.getNodeParameter('sessionId', i, '');
            const memory = this.getNodeParameter('memory', i, '');
            const body = {
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
exports.ArkAgent = ArkAgent;
//# sourceMappingURL=ArkAgent.node.js.map