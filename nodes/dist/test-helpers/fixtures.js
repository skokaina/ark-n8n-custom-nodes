"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.queryDetailFixture = exports.queriesListFixture = exports.queryEvaluationFixture = exports.directEvaluationFixture = exports.evaluatorsListFixture = exports.mockTeamExecuteResponse = exports.mockTeamExecuteRequest = exports.mockModelExecuteResponse = exports.mockModelExecuteRequest = exports.mockAgentExecuteResponseAsync = exports.mockAgentExecuteResponseTimeout = exports.mockAgentExecuteResponseFailed = exports.mockAgentExecuteResponseSuccess = exports.mockAgentExecuteRequest = exports.mockTeamsList = exports.mockModelsList = exports.mockAgentsList = void 0;
exports.mockAgentsList = {
    items: [
        {
            name: 'test-agent',
            namespace: 'default',
            description: 'A test agent',
            model_ref: 'default',
            available: 'available',
        },
        {
            name: 'sample-agent',
            namespace: 'default',
            description: 'Sample agent for testing',
            model_ref: 'gpt-4',
            available: 'available',
        },
    ],
    count: 2,
};
exports.mockModelsList = {
    items: [
        {
            name: 'default',
            namespace: 'default',
            model: 'gpt-4.1-mini',
            type: 'azure',
            phase: 'ready',
        },
        {
            name: 'gpt-4',
            namespace: 'default',
            model: 'gpt-4',
            type: 'openai',
            phase: 'ready',
        },
    ],
    count: 2,
};
exports.mockTeamsList = {
    items: [
        {
            name: 'test-team',
            namespace: 'default',
            description: 'A test team',
            agents: ['agent-1', 'agent-2'],
        },
    ],
    count: 1,
};
exports.mockAgentExecuteRequest = {
    input: 'Hello, what can you do?',
    wait: true,
    timeout: '30s',
};
exports.mockAgentExecuteResponseSuccess = {
    queryName: 'test-agent-abc123',
    input: 'Hello, what can you do?',
    response: 'I can help you with various tasks!',
    status: 'completed',
    duration: '2.5s',
};
exports.mockAgentExecuteResponseFailed = {
    queryName: 'test-agent-abc123',
    input: 'Hello, what can you do?',
    status: 'failed',
    duration: '1.0s',
    error: 'Agent not available',
};
exports.mockAgentExecuteResponseTimeout = {
    queryName: 'test-agent-abc123',
    input: 'Hello, what can you do?',
    status: 'timeout',
    duration: '30s',
    error: 'Query did not complete within 30 seconds',
};
exports.mockAgentExecuteResponseAsync = {
    queryName: 'test-agent-abc123',
    input: 'Hello, what can you do?',
    status: 'pending',
    duration: null,
    response: null,
};
exports.mockModelExecuteRequest = {
    prompt: 'What is 2+2?',
    temperature: 0.7,
    maxTokens: 100,
};
exports.mockModelExecuteResponse = {
    queryName: 'model-query-xyz789',
    prompt: 'What is 2+2?',
    response: '2+2 equals 4',
    status: 'completed',
    duration: '1.2s',
};
exports.mockTeamExecuteRequest = {
    input: 'Coordinate a task',
    wait: true,
};
exports.mockTeamExecuteResponse = {
    queryName: 'team-query-def456',
    input: 'Coordinate a task',
    response: 'Task coordinated successfully across agents',
    status: 'completed',
    duration: '5.0s',
};
exports.evaluatorsListFixture = {
    items: [
        {
            name: 'correctness-evaluator',
            namespace: 'default',
            description: 'Evaluates correctness of responses',
        },
        {
            name: 'relevance-evaluator',
            namespace: 'default',
            description: 'Evaluates relevance of responses',
        },
    ],
    count: 2,
};
exports.directEvaluationFixture = {
    name: 'eval-test-123',
    namespace: 'default',
    type: 'direct',
    spec: {
        type: 'direct',
        evaluator: {
            name: 'correctness-evaluator',
        },
        config: {
            input: 'What is 2+2?',
            output: '4',
        },
        timeout: '300s',
    },
    status: {
        phase: 'Completed',
        score: '0.95',
        passed: true,
        message: 'Evaluation completed successfully',
    },
};
exports.queryEvaluationFixture = {
    name: 'eval-query-456',
    namespace: 'default',
    type: 'query',
    spec: {
        type: 'query',
        evaluator: {
            name: 'correctness-evaluator',
        },
        config: {
            queryRef: {
                name: 'sample-query',
                responseTarget: 'agent:test-agent',
            },
        },
        timeout: '300s',
    },
    status: {
        phase: 'Completed',
        score: '0.88',
        passed: true,
        message: 'Query evaluation completed',
    },
};
exports.queriesListFixture = {
    items: [
        {
            name: 'sample-query',
            namespace: 'default',
            spec: {
                input: 'What is the capital of France?',
                targets: [
                    { type: 'agent', name: 'test-agent' },
                    { type: 'model', name: 'gpt-4' },
                ],
            },
        },
        {
            name: 'team-query',
            namespace: 'default',
            spec: {
                input: 'Coordinate task',
                targets: [
                    { type: 'team', name: 'test-team' },
                ],
            },
        },
    ],
    count: 2,
};
exports.queryDetailFixture = {
    name: 'sample-query',
    namespace: 'default',
    input: 'What is the capital of France?',
    targets: [
        { type: 'agent', name: 'test-agent' },
        { type: 'model', name: 'gpt-4' },
    ],
    status: {
        phase: 'done',
        responses: [
            { target: { type: 'agent', name: 'test-agent' }, content: 'Paris' },
            { target: { type: 'model', name: 'gpt-4' }, content: 'Paris' },
        ],
    },
};
//# sourceMappingURL=fixtures.js.map