"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createMockExecuteFunctions = createMockExecuteFunctions;
exports.createMockLoadOptionsFunctions = createMockLoadOptionsFunctions;
exports.createMockNodeExecutionData = createMockNodeExecutionData;
function createMockExecuteFunctions(inputData = [], parameters = {}) {
    return {
        getInputData: () => inputData,
        getNodeParameter: (parameterName, itemIndex) => {
            return parameters[parameterName];
        },
        getCredentials: async (type, itemIndex) => {
            return {
                baseUrl: 'http://ark-api.default.svc.cluster.local',
                token: 'test-token',
            };
        },
        helpers: {
            request: jest.fn(),
        },
    };
}
function createMockLoadOptionsFunctions() {
    return {
        getCredentials: async (type, itemIndex) => {
            return {
                baseUrl: 'http://ark-api.default.svc.cluster.local',
                token: 'test-token',
            };
        },
        helpers: {
            request: jest.fn(),
        },
    };
}
function createMockNodeExecutionData(json) {
    return {
        json,
    };
}
//# sourceMappingURL=mocks.js.map