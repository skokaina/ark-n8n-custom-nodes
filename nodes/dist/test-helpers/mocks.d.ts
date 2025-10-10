import { IExecuteFunctions, ILoadOptionsFunctions, INodeExecutionData } from 'n8n-workflow';
export declare function createMockExecuteFunctions(inputData?: INodeExecutionData[], parameters?: Record<string, any>): Partial<IExecuteFunctions>;
export declare function createMockLoadOptionsFunctions(): Partial<ILoadOptionsFunctions>;
export declare function createMockNodeExecutionData(json: any): INodeExecutionData;
