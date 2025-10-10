import { ArkModel } from '../ArkModel.node';
import { IExecuteFunctions, ILoadOptionsFunctions } from 'n8n-workflow';
import {
  createMockExecuteFunctions,
  createMockLoadOptionsFunctions,
  createMockNodeExecutionData,
} from '../../../test-helpers/mocks';
import {
  mockModelsList,
  mockModelExecuteRequest,
  mockModelExecuteResponse,
} from '../../../test-helpers/fixtures';

describe('ArkModel Node', () => {
  let arkModel: ArkModel;

  beforeEach(() => {
    arkModel = new ArkModel();
  });

  describe('Node Metadata', () => {
    it('should have correct displayName', () => {
      expect(arkModel.description.displayName).toBe('ARK Model');
    });

    it('should have correct name', () => {
      expect(arkModel.description.name).toBe('arkModel');
    });

    it('should have correct group', () => {
      expect(arkModel.description.group).toEqual(['transform']);
    });

    it('should have correct version', () => {
      expect(arkModel.description.version).toBe(1);
    });

    it('should have a description', () => {
      expect(arkModel.description.description).toBeDefined();
      expect(arkModel.description.description).toContain('model');
    });

    it('should require ARK API credentials', () => {
      expect(arkModel.description.credentials).toEqual([
        {
          name: 'arkApi',
          required: true,
        },
      ]);
    });

    it('should have an icon', () => {
      expect(arkModel.description.icon).toBe('file:ark-model.svg');
    });
  });

  describe('Node Properties', () => {
    it('should have model dropdown property', () => {
      const modelProperty = arkModel.description.properties.find(
        (p: any) => p.name === 'model'
      );

      expect(modelProperty).toBeDefined();
      expect(modelProperty?.displayName).toBe('Model');
      expect(modelProperty?.type).toBe('options');
      expect(modelProperty?.typeOptions?.loadOptionsMethod).toBe('getModels');
      expect(modelProperty?.required).toBe(true);
    });

    it('should have prompt property', () => {
      const promptProperty = arkModel.description.properties.find(
        (p: any) => p.name === 'prompt'
      );

      expect(promptProperty).toBeDefined();
      expect(promptProperty?.displayName).toBe('Prompt');
      expect(promptProperty?.type).toBe('string');
      expect(promptProperty?.required).toBe(true);
    });

    it('should have temperature property', () => {
      const tempProperty = arkModel.description.properties.find(
        (p: any) => p.name === 'temperature'
      );

      expect(tempProperty).toBeDefined();
      expect(tempProperty?.displayName).toBe('Temperature');
      expect(tempProperty?.type).toBe('number');
      expect(tempProperty?.default).toBe(0.7);
    });

    it('should have maxTokens property', () => {
      const maxTokensProperty = arkModel.description.properties.find(
        (p: any) => p.name === 'maxTokens'
      );

      expect(maxTokensProperty).toBeDefined();
      expect(maxTokensProperty?.displayName).toBe('Max Tokens');
      expect(maxTokensProperty?.type).toBe('number');
    });
  });

  describe('getModels() Loader Method', () => {
    it('should fetch and format models list', async () => {
      const mockFunctions = createMockLoadOptionsFunctions();
      (mockFunctions.helpers!.request as jest.Mock).mockResolvedValue(mockModelsList);

      const result = await arkModel.methods!.loadOptions!.getModels!.call(
        mockFunctions as ILoadOptionsFunctions
      );

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        name: 'default (gpt-4.1-mini)',
        value: 'default',
      });
      expect(result[1]).toEqual({
        name: 'gpt-4 (gpt-4)',
        value: 'gpt-4',
      });

      expect(mockFunctions.helpers!.request).toHaveBeenCalledWith({
        method: 'GET',
        url: 'http://ark-api.default.svc.cluster.local/v1/models',
        json: true,
      });
    });

    it('should handle API errors gracefully', async () => {
      const mockFunctions = createMockLoadOptionsFunctions();
      (mockFunctions.helpers!.request as jest.Mock).mockRejectedValue(
        new Error('API Error')
      );

      await expect(
        arkModel.methods!.loadOptions!.getModels!.call(
          mockFunctions as ILoadOptionsFunctions
        )
      ).rejects.toThrow('API Error');
    });
  });

  describe('execute() Method', () => {
    it('should execute model query with default parameters', async () => {
      const inputData = [createMockNodeExecutionData({})];
      const parameters = {
        model: 'default',
        prompt: 'What is 2+2?',
        temperature: 0.7,
      };

      const mockFunctions = createMockExecuteFunctions(inputData, parameters);
      (mockFunctions.helpers!.request as jest.Mock).mockResolvedValue(
        mockModelExecuteResponse
      );

      const result = await arkModel.execute!.call(
        mockFunctions as IExecuteFunctions
      );

      expect(result).toHaveLength(1);
      expect(result[0]).toHaveLength(1);
      expect(result[0][0].json).toEqual(mockModelExecuteResponse);

      expect(mockFunctions.helpers!.request).toHaveBeenCalledWith({
        method: 'POST',
        url: 'http://ark-api.default.svc.cluster.local/v1/models/default/query',
        body: {
          prompt: 'What is 2+2?',
          temperature: 0.7,
        },
        json: true,
      });
    });

    it('should pass maxTokens when provided', async () => {
      const inputData = [createMockNodeExecutionData({})];
      const parameters = {
        model: 'gpt-4',
        prompt: 'Hello',
        temperature: 0.5,
        maxTokens: 100,
      };

      const mockFunctions = createMockExecuteFunctions(inputData, parameters);
      (mockFunctions.helpers!.request as jest.Mock).mockResolvedValue(
        mockModelExecuteResponse
      );

      await arkModel.execute!.call(mockFunctions as IExecuteFunctions);

      expect(mockFunctions.helpers!.request).toHaveBeenCalledWith(
        expect.objectContaining({
          body: expect.objectContaining({
            maxTokens: 100,
          }),
        })
      );
    });

    it('should process multiple input items', async () => {
      const inputData = [
        createMockNodeExecutionData({ query: 'First' }),
        createMockNodeExecutionData({ query: 'Second' }),
      ];
      const parameters = {
        model: 'default',
        prompt: 'Hello',
        temperature: 0.7,
      };

      const mockFunctions = createMockExecuteFunctions(inputData, parameters);
      (mockFunctions.helpers!.request as jest.Mock).mockResolvedValue(
        mockModelExecuteResponse
      );

      const result = await arkModel.execute!.call(
        mockFunctions as IExecuteFunctions
      );

      expect(result[0]).toHaveLength(2);
      expect(mockFunctions.helpers!.request).toHaveBeenCalledTimes(2);
    });
  });
});
