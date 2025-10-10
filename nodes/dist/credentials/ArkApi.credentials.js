"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ArkApi = void 0;
class ArkApi {
    constructor() {
        this.name = 'arkApi';
        this.displayName = 'ARK API';
        this.documentationUrl = 'https://github.com/mckinsey/agents-at-scale-ark';
        this.properties = [
            {
                displayName: 'Base URL',
                name: 'baseUrl',
                type: 'string',
                default: 'http://ark-api.default.svc.cluster.local',
                required: true,
                description: 'The base URL of the ARK API service',
                placeholder: 'http://ark-api.default.svc.cluster.local',
            },
            {
                displayName: 'API Token',
                name: 'token',
                type: 'string',
                typeOptions: {
                    password: true,
                },
                default: '',
                required: false,
                description: 'Optional API token for authentication (future use)',
            },
        ];
    }
}
exports.ArkApi = ArkApi;
//# sourceMappingURL=ArkApi.credentials.js.map