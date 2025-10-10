"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ArkEvaluation = void 0;
class ArkEvaluation {
    constructor() {
        this.description = {
            displayName: 'ARK Evaluation',
            name: 'arkEvaluation',
            icon: 'file:ark-evaluation.svg',
            group: ['transform'],
            version: 1,
            description: 'Create and execute ARK evaluations',
            defaults: {
                name: 'ARK Evaluation',
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
                    displayName: 'Evaluation Type',
                    name: 'evaluationType',
                    type: 'options',
                    options: [
                        {
                            name: 'Direct',
                            value: 'direct',
                            description: 'Evaluate input/output directly',
                        },
                        {
                            name: 'Query',
                            value: 'query',
                            description: 'Evaluate based on existing query',
                        },
                    ],
                    default: 'direct',
                    description: 'Type of evaluation to perform',
                },
                {
                    displayName: 'Evaluator',
                    name: 'evaluator',
                    type: 'options',
                    typeOptions: {
                        loadOptionsMethod: 'getEvaluators',
                    },
                    default: '',
                    required: true,
                    description: 'The evaluator to use',
                },
                {
                    displayName: 'Input',
                    name: 'input',
                    type: 'string',
                    typeOptions: {
                        rows: 4,
                    },
                    displayOptions: {
                        show: {
                            evaluationType: ['direct'],
                        },
                    },
                    default: '',
                    required: true,
                    description: 'The input to evaluate',
                },
                {
                    displayName: 'Output',
                    name: 'output',
                    type: 'string',
                    typeOptions: {
                        rows: 4,
                    },
                    displayOptions: {
                        show: {
                            evaluationType: ['direct'],
                        },
                    },
                    default: '',
                    required: true,
                    description: 'The output to evaluate',
                },
                {
                    displayName: 'Query',
                    name: 'queryName',
                    type: 'resourceLocator',
                    default: { mode: 'list', value: '' },
                    required: true,
                    displayOptions: {
                        show: {
                            evaluationType: ['query'],
                        },
                    },
                    description: 'The query to evaluate',
                    modes: [
                        {
                            displayName: 'From List',
                            name: 'list',
                            type: 'list',
                            typeOptions: {
                                searchListMethod: 'searchQueries',
                                searchable: true,
                            },
                        },
                        {
                            displayName: 'By Name',
                            name: 'name',
                            type: 'string',
                            placeholder: 'e.g. my-query-name',
                        },
                    ],
                },
                {
                    displayName: 'Response Target',
                    name: 'responseTarget',
                    type: 'resourceLocator',
                    default: { mode: 'list', value: '' },
                    required: true,
                    displayOptions: {
                        show: {
                            evaluationType: ['query'],
                        },
                    },
                    description: 'Which target response to evaluate',
                    modes: [
                        {
                            displayName: 'From List',
                            name: 'list',
                            type: 'list',
                            typeOptions: {
                                searchListMethod: 'searchQueryTargets',
                                searchable: true,
                            },
                        },
                        {
                            displayName: 'By Value',
                            name: 'value',
                            type: 'string',
                            placeholder: 'e.g. agent:my-agent',
                        },
                    ],
                },
                {
                    displayName: 'Wait for Completion',
                    name: 'wait',
                    type: 'boolean',
                    default: true,
                    description: 'Whether to wait for evaluation to complete',
                },
                {
                    displayName: 'Timeout',
                    name: 'timeout',
                    type: 'number',
                    default: 300,
                    displayOptions: {
                        show: {
                            wait: [true],
                        },
                    },
                    description: 'Maximum time to wait for completion (seconds)',
                },
                {
                    displayName: 'Advanced Parameters',
                    name: 'advancedParametersSection',
                    type: 'notice',
                    default: '',
                    displayOptions: {
                        show: {
                            '@version': [1],
                        },
                    },
                },
                {
                    displayName: 'Evaluation Scope',
                    name: 'scope',
                    type: 'multiOptions',
                    options: [
                        {
                            name: 'Relevance',
                            value: 'relevance',
                        },
                        {
                            name: 'Accuracy',
                            value: 'accuracy',
                        },
                        {
                            name: 'Completeness',
                            value: 'completeness',
                        },
                        {
                            name: 'Conciseness',
                            value: 'conciseness',
                        },
                        {
                            name: 'Clarity',
                            value: 'clarity',
                        },
                        {
                            name: 'Usefulness',
                            value: 'usefulness',
                        },
                        {
                            name: 'Compliance',
                            value: 'compliance',
                        },
                        {
                            name: 'Faithfulness',
                            value: 'faithfulness',
                        },
                    ],
                    default: [],
                    description: 'Evaluation criteria to assess',
                },
                {
                    displayName: 'Minimum Score',
                    name: 'minScore',
                    type: 'number',
                    typeOptions: {
                        minValue: 0,
                        maxValue: 1,
                        numberPrecision: 2,
                    },
                    default: 0.7,
                    description: 'Minimum score threshold (0.0-1.0)',
                },
                {
                    displayName: 'Temperature',
                    name: 'temperature',
                    type: 'number',
                    typeOptions: {
                        minValue: 0,
                        maxValue: 2,
                        numberPrecision: 1,
                    },
                    default: 0.0,
                    description: 'LLM temperature for evaluation (0.0-2.0)',
                },
                {
                    displayName: 'Max Tokens',
                    name: 'maxTokens',
                    type: 'number',
                    typeOptions: {
                        minValue: 1,
                    },
                    default: '',
                    description: 'Maximum tokens for evaluation response',
                },
                {
                    displayName: 'Evaluator Role',
                    name: 'evaluatorRole',
                    type: 'string',
                    default: '',
                    description: 'Custom evaluator role description',
                },
                {
                    displayName: 'Context',
                    name: 'context',
                    type: 'string',
                    typeOptions: {
                        rows: 4,
                    },
                    default: '',
                    description: 'Additional context for evaluation',
                },
                {
                    displayName: 'Evaluation Criteria',
                    name: 'evaluationCriteria',
                    type: 'string',
                    default: '',
                    description: 'Comma-separated list of specific criteria',
                },
            ],
        };
        this.methods = {
            loadOptions: {
                async getEvaluators() {
                    const credentials = await this.getCredentials('arkApi');
                    const baseUrl = credentials.baseUrl;
                    try {
                        const response = await this.helpers.request({
                            method: 'GET',
                            url: `${baseUrl}/v1/evaluators`,
                            json: true,
                        });
                        return response.items.map((evaluator) => ({
                            name: evaluator.name,
                            value: evaluator.name,
                        }));
                    }
                    catch (error) {
                        return [];
                    }
                },
            },
            listSearch: {
                async searchQueries(filter) {
                    const credentials = await this.getCredentials('arkApi');
                    const baseUrl = credentials.baseUrl;
                    try {
                        const response = await this.helpers.request({
                            method: 'GET',
                            url: `${baseUrl}/v1/queries`,
                            json: true,
                        });
                        let items = response.items || [];
                        if (filter) {
                            const filterLower = filter.toLowerCase();
                            items = items.filter((query) => query.name.toLowerCase().includes(filterLower));
                        }
                        return {
                            results: items.map((query) => ({
                                name: query.name,
                                value: query.name,
                                url: `${baseUrl}/v1/queries/${query.name}`,
                            })),
                        };
                    }
                    catch (error) {
                        return { results: [] };
                    }
                },
                async searchQueryTargets(filter) {
                    const credentials = await this.getCredentials('arkApi');
                    const baseUrl = credentials.baseUrl;
                    const queryNameParam = this.getCurrentNodeParameter('queryName');
                    const queryName = typeof queryNameParam === 'string'
                        ? queryNameParam
                        : (queryNameParam === null || queryNameParam === void 0 ? void 0 : queryNameParam.value) || '';
                    if (!queryName) {
                        return { results: [] };
                    }
                    try {
                        const response = await this.helpers.request({
                            method: 'GET',
                            url: `${baseUrl}/v1/queries/${encodeURIComponent(queryName)}`,
                            json: true,
                        });
                        let targets = response.targets || [];
                        if (filter) {
                            const filterLower = filter.toLowerCase();
                            targets = targets.filter((target) => `${target.type}:${target.name}`.toLowerCase().includes(filterLower));
                        }
                        return {
                            results: targets.map((target) => ({
                                name: `${target.type}: ${target.name}`,
                                value: `${target.type}:${target.name}`,
                            })),
                        };
                    }
                    catch (error) {
                        return { results: [] };
                    }
                },
            },
        };
    }
    async execute() {
        var _a;
        const items = this.getInputData();
        const returnData = [];
        const credentials = await this.getCredentials('arkApi');
        const baseUrl = credentials.baseUrl;
        const token = credentials.token;
        for (let i = 0; i < items.length; i++) {
            const evaluationType = this.getNodeParameter('evaluationType', i);
            const evaluator = this.getNodeParameter('evaluator', i);
            const wait = this.getNodeParameter('wait', i);
            const timeout = this.getNodeParameter('timeout', i, 300);
            const scope = this.getNodeParameter('scope', i, []);
            const minScore = this.getNodeParameter('minScore', i, 0.7);
            const temperature = this.getNodeParameter('temperature', i, 0.0);
            const maxTokens = this.getNodeParameter('maxTokens', i, '');
            const evaluatorRole = this.getNodeParameter('evaluatorRole', i, '');
            const context = this.getNodeParameter('context', i, '');
            const evaluationCriteria = this.getNodeParameter('evaluationCriteria', i, '');
            const parameters = [];
            if (scope.length > 0) {
                parameters.push({ name: 'scope', value: scope.join(',') });
            }
            parameters.push({ name: 'min_score', value: minScore.toString() });
            if (temperature !== 0.0) {
                parameters.push({ name: 'temperature', value: temperature.toString() });
            }
            if (maxTokens && maxTokens !== '') {
                parameters.push({ name: 'max_tokens', value: maxTokens.toString() });
            }
            if (evaluatorRole) {
                parameters.push({ name: 'evaluator_role', value: evaluatorRole });
            }
            if (context) {
                parameters.push({ name: 'context', value: context });
            }
            if (evaluationCriteria) {
                const criteriaList = evaluationCriteria.split(',').map((c) => c.trim()).filter((c) => c);
                if (criteriaList.length > 0) {
                    parameters.push({ name: 'evaluation_criteria', value: criteriaList.join(',') });
                }
            }
            const evaluationName = `eval-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
            const requestBody = {
                name: evaluationName,
                type: evaluationType,
                evaluator: {
                    name: evaluator,
                },
                config: {},
                timeout: `${timeout}s`,
            };
            if (parameters.length > 0) {
                requestBody.evaluator.parameters = parameters;
            }
            if (evaluationType === 'direct') {
                const input = this.getNodeParameter('input', i);
                const output = this.getNodeParameter('output', i);
                requestBody.config.input = input;
                requestBody.config.output = output;
            }
            else if (evaluationType === 'query') {
                const queryNameParam = this.getNodeParameter('queryName', i);
                const responseTargetParam = this.getNodeParameter('responseTarget', i);
                const queryName = typeof queryNameParam === 'string'
                    ? queryNameParam
                    : (queryNameParam === null || queryNameParam === void 0 ? void 0 : queryNameParam.value) || '';
                const responseTarget = typeof responseTargetParam === 'string'
                    ? responseTargetParam
                    : (responseTargetParam === null || responseTargetParam === void 0 ? void 0 : responseTargetParam.value) || '';
                requestBody.config.queryRef = {
                    name: queryName,
                    responseTarget,
                };
            }
            const headers = {
                'Content-Type': 'application/json',
            };
            if (token) {
                headers['Authorization'] = `Bearer ${token}`;
            }
            const response = await this.helpers.request({
                method: 'POST',
                url: `${baseUrl}/v1/evaluations`,
                body: requestBody,
                headers,
                json: true,
            });
            if (wait) {
                const evaluationName = response.name;
                const startTime = Date.now();
                const maxWaitTime = timeout * 1000;
                while (true) {
                    const statusResponse = await this.helpers.request({
                        method: 'GET',
                        url: `${baseUrl}/v1/evaluations/${evaluationName}`,
                        headers,
                        json: true,
                    });
                    const phase = (_a = statusResponse.status) === null || _a === void 0 ? void 0 : _a.phase;
                    if (phase === 'done' || phase === 'failed' || phase === 'error') {
                        returnData.push({ json: statusResponse });
                        break;
                    }
                    if (Date.now() - startTime > maxWaitTime) {
                        throw new Error(`Evaluation timed out after ${timeout} seconds`);
                    }
                    await new Promise((resolve) => setTimeout(resolve, 2000));
                }
            }
            else {
                returnData.push({ json: response });
            }
        }
        return [returnData];
    }
}
exports.ArkEvaluation = ArkEvaluation;
//# sourceMappingURL=ArkEvaluation.node.js.map