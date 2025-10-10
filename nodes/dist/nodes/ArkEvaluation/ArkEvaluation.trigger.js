"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ArkEvaluation = void 0;
class ArkEvaluation {
    constructor() {
        this.description = {
            displayName: 'ARK Evaluation Trigger',
            name: 'arkEvaluationTrigger',
            icon: 'file:ark-evaluation.svg',
            group: ['trigger'],
            version: 1,
            description: 'Trigger workflow when ARK evaluation completes',
            defaults: {
                name: 'ARK Evaluation Trigger',
            },
            inputs: [],
            outputs: ['main'],
            webhooks: [
                {
                    name: 'default',
                    httpMethod: 'POST',
                    responseMode: 'onReceived',
                    path: 'evaluation',
                },
            ],
            properties: [
                {
                    displayName: 'Events',
                    name: 'events',
                    type: 'multiOptions',
                    options: [
                        {
                            name: 'Completed',
                            value: 'completed',
                            description: 'Trigger when evaluation completes successfully',
                        },
                        {
                            name: 'Failed',
                            value: 'failed',
                            description: 'Trigger when evaluation fails',
                        },
                        {
                            name: 'All',
                            value: '*',
                            description: 'Trigger on any evaluation event',
                        },
                    ],
                    default: ['completed'],
                    description: 'The evaluation events to listen for',
                },
            ],
        };
        this.webhookMethods = {
            default: {
                async checkExists() {
                    return true;
                },
                async create() {
                    return true;
                },
                async delete() {
                    return true;
                },
            },
        };
    }
    async webhook() {
        const bodyData = this.getBodyData();
        const events = this.getNodeParameter('events');
        const evaluationData = bodyData.evaluation || bodyData;
        const status = evaluationData.status;
        if (events.includes('*') || events.includes(status)) {
            return {
                workflowData: [this.helpers.returnJsonArray(bodyData)],
            };
        }
        return {
            workflowData: [[]],
        };
    }
}
exports.ArkEvaluation = ArkEvaluation;
//# sourceMappingURL=ArkEvaluation.trigger.js.map