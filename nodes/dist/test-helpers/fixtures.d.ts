export declare const mockAgentsList: {
    items: {
        name: string;
        namespace: string;
        description: string;
        model_ref: string;
        available: string;
    }[];
    count: number;
};
export declare const mockModelsList: {
    items: {
        name: string;
        namespace: string;
        model: string;
        type: string;
        phase: string;
    }[];
    count: number;
};
export declare const mockTeamsList: {
    items: {
        name: string;
        namespace: string;
        description: string;
        agents: string[];
    }[];
    count: number;
};
export declare const mockAgentExecuteRequest: {
    input: string;
    wait: boolean;
    timeout: string;
};
export declare const mockAgentExecuteResponseSuccess: {
    queryName: string;
    input: string;
    response: string;
    status: string;
    duration: string;
};
export declare const mockAgentExecuteResponseFailed: {
    queryName: string;
    input: string;
    status: string;
    duration: string;
    error: string;
};
export declare const mockAgentExecuteResponseTimeout: {
    queryName: string;
    input: string;
    status: string;
    duration: string;
    error: string;
};
export declare const mockAgentExecuteResponseAsync: {
    queryName: string;
    input: string;
    status: string;
    duration: null;
    response: null;
};
export declare const mockModelExecuteRequest: {
    prompt: string;
    temperature: number;
    maxTokens: number;
};
export declare const mockModelExecuteResponse: {
    queryName: string;
    prompt: string;
    response: string;
    status: string;
    duration: string;
};
export declare const mockTeamExecuteRequest: {
    input: string;
    wait: boolean;
};
export declare const mockTeamExecuteResponse: {
    queryName: string;
    input: string;
    response: string;
    status: string;
    duration: string;
};
export declare const evaluatorsListFixture: {
    items: {
        name: string;
        namespace: string;
        description: string;
    }[];
    count: number;
};
export declare const directEvaluationFixture: {
    name: string;
    namespace: string;
    type: string;
    spec: {
        type: string;
        evaluator: {
            name: string;
        };
        config: {
            input: string;
            output: string;
        };
        timeout: string;
    };
    status: {
        phase: string;
        score: string;
        passed: boolean;
        message: string;
    };
};
export declare const queryEvaluationFixture: {
    name: string;
    namespace: string;
    type: string;
    spec: {
        type: string;
        evaluator: {
            name: string;
        };
        config: {
            queryRef: {
                name: string;
                responseTarget: string;
            };
        };
        timeout: string;
    };
    status: {
        phase: string;
        score: string;
        passed: boolean;
        message: string;
    };
};
export declare const queriesListFixture: {
    items: {
        name: string;
        namespace: string;
        spec: {
            input: string;
            targets: {
                type: string;
                name: string;
            }[];
        };
    }[];
    count: number;
};
export declare const queryDetailFixture: {
    name: string;
    namespace: string;
    input: string;
    targets: {
        type: string;
        name: string;
    }[];
    status: {
        phase: string;
        responses: {
            target: {
                type: string;
                name: string;
            };
            content: string;
        }[];
    };
};
