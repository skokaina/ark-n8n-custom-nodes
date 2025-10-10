import { IExecuteFunctions, ILoadOptionsFunctions, INodeExecutionData, INodePropertyOptions, INodeType, INodeTypeDescription } from 'n8n-workflow';
export declare class ArkEvaluation implements INodeType {
    description: INodeTypeDescription;
    methods: {
        loadOptions: {
            getEvaluators(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]>;
        };
        listSearch: {
            searchQueries(this: ILoadOptionsFunctions, filter?: string): Promise<{
                results: any;
            }>;
            searchQueryTargets(this: ILoadOptionsFunctions, filter?: string): Promise<{
                results: any;
            }>;
        };
    };
    execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]>;
}
