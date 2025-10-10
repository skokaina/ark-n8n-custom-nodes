import { ArkEvaluation } from '../ArkEvaluation.node';
import { IExecuteFunctions, ILoadOptionsFunctions } from 'n8n-workflow';
import {
  createMockExecuteFunctions,
  createMockLoadOptionsFunctions,
} from '../../../test-helpers/mocks';
import {
  evaluatorsListFixture,
  directEvaluationFixture,
  queryEvaluationFixture,
  queriesListFixture,
  queryDetailFixture,
} from '../../../test-helpers/fixtures';

describe('ArkEvaluation Node', () => {
  let arkEvaluation: ArkEvaluation;

  beforeEach(() => {
    arkEvaluation = new ArkEvaluation();
  });

  describe('Node Metadata', () => {
    it('should have correct displayName', () => {
      expect(arkEvaluation.description.displayName).toBe('ARK Evaluation');
    });

    it('should have correct name', () => {
      expect(arkEvaluation.description.name).toBe('arkEvaluation');
    });

    it('should have correct group', () => {
      expect(arkEvaluation.description.group).toEqual(['transform']);
    });

    it('should have correct version', () => {
      expect(arkEvaluation.description.version).toBe(1);
    });

    it('should have inputs and outputs', () => {
      expect(arkEvaluation.description.inputs).toEqual(['main']);
      expect(arkEvaluation.description.outputs).toEqual(['main']);
    });

    it('should require ARK API credentials', () => {
      expect(arkEvaluation.description.credentials).toEqual([
        {
          name: 'arkApi',
          required: true,
        },
      ]);
    });

    it('should have an icon', () => {
      expect(arkEvaluation.description.icon).toBe('file:ark-evaluation.svg');
    });
  });

  describe('Node Properties', () => {
    it('should have evaluation type property', () => {
      const typeProperty = arkEvaluation.description.properties.find(
        (p: any) => p.name === 'evaluationType'
      );

      expect(typeProperty).toBeDefined();
      expect(typeProperty?.displayName).toBe('Evaluation Type');
      expect(typeProperty?.type).toBe('options');
      expect(typeProperty?.default).toBe('direct');
    });

    it('should have evaluator property with dynamic options', () => {
      const evaluatorProperty = arkEvaluation.description.properties.find(
        (p: any) => p.name === 'evaluator'
      );

      expect(evaluatorProperty).toBeDefined();
      expect(evaluatorProperty?.displayName).toBe('Evaluator');
      expect(evaluatorProperty?.type).toBe('options');
      expect(evaluatorProperty?.typeOptions?.loadOptionsMethod).toBe('getEvaluators');
      expect(evaluatorProperty?.required).toBe(true);
    });

    it('should have input property for direct evaluation', () => {
      const inputProperty = arkEvaluation.description.properties.find(
        (p: any) => p.name === 'input'
      );

      expect(inputProperty).toBeDefined();
      expect(inputProperty?.displayName).toBe('Input');
      expect(inputProperty?.type).toBe('string');
    });

    it('should have output property for direct evaluation', () => {
      const outputProperty = arkEvaluation.description.properties.find(
        (p: any) => p.name === 'output'
      );

      expect(outputProperty).toBeDefined();
      expect(outputProperty?.displayName).toBe('Output');
      expect(outputProperty?.type).toBe('string');
    });

    it('should have queryName property as resourceLocator for query evaluation', () => {
      const queryNameProperty = arkEvaluation.description.properties.find(
        (p: any) => p.name === 'queryName'
      );

      expect(queryNameProperty).toBeDefined();
      expect(queryNameProperty?.displayName).toBe('Query');
      expect(queryNameProperty?.type).toBe('resourceLocator');
      expect(queryNameProperty?.required).toBe(true);
      expect(queryNameProperty?.modes).toHaveLength(2);
    });

    it('should have responseTarget property as resourceLocator', () => {
      const responseTargetProperty = arkEvaluation.description.properties.find(
        (p: any) => p.name === 'responseTarget'
      );

      expect(responseTargetProperty).toBeDefined();
      expect(responseTargetProperty?.displayName).toBe('Response Target');
      expect(responseTargetProperty?.type).toBe('resourceLocator');
      expect(responseTargetProperty?.required).toBe(true);
      expect(responseTargetProperty?.modes).toHaveLength(2);
    });

    it('should have wait property', () => {
      const waitProperty = arkEvaluation.description.properties.find(
        (p: any) => p.name === 'wait'
      );

      expect(waitProperty).toBeDefined();
      expect(waitProperty?.displayName).toBe('Wait for Completion');
      expect(waitProperty?.type).toBe('boolean');
      expect(waitProperty?.default).toBe(true);
    });

    it('should have timeout property', () => {
      const timeoutProperty = arkEvaluation.description.properties.find(
        (p: any) => p.name === 'timeout'
      );

      expect(timeoutProperty).toBeDefined();
      expect(timeoutProperty?.displayName).toBe('Timeout');
      expect(timeoutProperty?.type).toBe('number');
      expect(timeoutProperty?.default).toBe(300);
    });

    it('should have scope property for evaluation criteria', () => {
      const scopeProperty = arkEvaluation.description.properties.find(
        (p: any) => p.name === 'scope'
      );

      expect(scopeProperty).toBeDefined();
      expect(scopeProperty?.displayName).toBe('Evaluation Scope');
      expect(scopeProperty?.type).toBe('multiOptions');
      expect(scopeProperty?.default).toEqual([]);
      expect(scopeProperty?.options).toHaveLength(8);
    });

    it('should have minScore property', () => {
      const minScoreProperty = arkEvaluation.description.properties.find(
        (p: any) => p.name === 'minScore'
      );

      expect(minScoreProperty).toBeDefined();
      expect(minScoreProperty?.displayName).toBe('Minimum Score');
      expect(minScoreProperty?.type).toBe('number');
      expect(minScoreProperty?.default).toBe(0.7);
    });

    it('should have temperature property', () => {
      const temperatureProperty = arkEvaluation.description.properties.find(
        (p: any) => p.name === 'temperature'
      );

      expect(temperatureProperty).toBeDefined();
      expect(temperatureProperty?.displayName).toBe('Temperature');
      expect(temperatureProperty?.type).toBe('number');
      expect(temperatureProperty?.default).toBe(0.0);
    });

    it('should have maxTokens property', () => {
      const maxTokensProperty = arkEvaluation.description.properties.find(
        (p: any) => p.name === 'maxTokens'
      );

      expect(maxTokensProperty).toBeDefined();
      expect(maxTokensProperty?.displayName).toBe('Max Tokens');
      expect(maxTokensProperty?.type).toBe('number');
    });

    it('should have evaluatorRole property', () => {
      const evaluatorRoleProperty = arkEvaluation.description.properties.find(
        (p: any) => p.name === 'evaluatorRole'
      );

      expect(evaluatorRoleProperty).toBeDefined();
      expect(evaluatorRoleProperty?.displayName).toBe('Evaluator Role');
      expect(evaluatorRoleProperty?.type).toBe('string');
    });

    it('should have context property', () => {
      const contextProperty = arkEvaluation.description.properties.find(
        (p: any) => p.name === 'context'
      );

      expect(contextProperty).toBeDefined();
      expect(contextProperty?.displayName).toBe('Context');
      expect(contextProperty?.type).toBe('string');
    });

    it('should have evaluationCriteria property', () => {
      const evaluationCriteriaProperty = arkEvaluation.description.properties.find(
        (p: any) => p.name === 'evaluationCriteria'
      );

      expect(evaluationCriteriaProperty).toBeDefined();
      expect(evaluationCriteriaProperty?.displayName).toBe('Evaluation Criteria');
      expect(evaluationCriteriaProperty?.type).toBe('string');
    });
  });

  describe('Loader Methods', () => {
    describe('getEvaluators()', () => {
      it('should fetch and format evaluators list', async () => {
        const mockFunctions = createMockLoadOptionsFunctions();
        (mockFunctions.helpers!.request as jest.Mock).mockResolvedValue(evaluatorsListFixture);

        const result = await arkEvaluation.methods!.loadOptions!.getEvaluators!.call(
          mockFunctions as ILoadOptionsFunctions
        );

        expect(result).toHaveLength(2);
        expect(result[0]).toEqual({
          name: 'correctness-evaluator',
          value: 'correctness-evaluator',
        });
        expect(result[1]).toEqual({
          name: 'relevance-evaluator',
          value: 'relevance-evaluator',
        });
      });

      it('should handle fetch errors gracefully', async () => {
        const mockFunctions = createMockLoadOptionsFunctions();
        (mockFunctions.helpers!.request as jest.Mock).mockRejectedValue(
          new Error('API Error')
        );

        const result = await arkEvaluation.methods!.loadOptions!.getEvaluators!.call(
          mockFunctions as ILoadOptionsFunctions
        );

        expect(result).toEqual([]);
      });
    });

    describe('searchQueries()', () => {
      it('should fetch and format queries list', async () => {
        const mockFunctions = createMockLoadOptionsFunctions();
        (mockFunctions.helpers!.request as jest.Mock).mockResolvedValue(queriesListFixture);

        const result = await arkEvaluation.methods!.listSearch!.searchQueries!.call(
          mockFunctions as ILoadOptionsFunctions
        );

        expect(result.results).toHaveLength(2);
        expect(result.results[0]).toMatchObject({
          name: 'sample-query',
          value: 'sample-query',
        });
        expect(result.results[1]).toMatchObject({
          name: 'team-query',
          value: 'team-query',
        });
      });

      it('should filter queries by search term', async () => {
        const mockFunctions = createMockLoadOptionsFunctions();
        (mockFunctions.helpers!.request as jest.Mock).mockResolvedValue(queriesListFixture);

        const result = await arkEvaluation.methods!.listSearch!.searchQueries!.call(
          mockFunctions as ILoadOptionsFunctions,
          'sample'
        );

        expect(result.results).toHaveLength(1);
        expect(result.results[0].name).toBe('sample-query');
      });

      it('should handle fetch errors gracefully', async () => {
        const mockFunctions = createMockLoadOptionsFunctions();
        (mockFunctions.helpers!.request as jest.Mock).mockRejectedValue(
          new Error('API Error')
        );

        const result = await arkEvaluation.methods!.listSearch!.searchQueries!.call(
          mockFunctions as ILoadOptionsFunctions
        );

        expect(result.results).toEqual([]);
      });
    });

    describe('searchQueryTargets()', () => {
      it('should fetch and format query targets with type:name format', async () => {
        const mockFunctions = createMockLoadOptionsFunctions();
        mockFunctions.getCurrentNodeParameter = jest.fn().mockReturnValue('sample-query');
        (mockFunctions.helpers!.request as jest.Mock).mockResolvedValue(queryDetailFixture);

        const result = await arkEvaluation.methods!.listSearch!.searchQueryTargets!.call(
          mockFunctions as ILoadOptionsFunctions
        );

        expect(result.results).toHaveLength(2);
        expect(result.results[0]).toEqual({
          name: 'agent: test-agent',
          value: 'agent:test-agent',
        });
        expect(result.results[1]).toEqual({
          name: 'model: gpt-4',
          value: 'model:gpt-4',
        });
      });

      it('should handle resourceLocator query name parameter', async () => {
        const mockFunctions = createMockLoadOptionsFunctions();
        mockFunctions.getCurrentNodeParameter = jest.fn().mockReturnValue({ value: 'sample-query' });
        (mockFunctions.helpers!.request as jest.Mock).mockResolvedValue(queryDetailFixture);

        const result = await arkEvaluation.methods!.listSearch!.searchQueryTargets!.call(
          mockFunctions as ILoadOptionsFunctions
        );

        expect(result.results).toHaveLength(2);
      });

      it('should return empty results when no query is selected', async () => {
        const mockFunctions = createMockLoadOptionsFunctions();
        mockFunctions.getCurrentNodeParameter = jest.fn().mockReturnValue('');

        const result = await arkEvaluation.methods!.listSearch!.searchQueryTargets!.call(
          mockFunctions as ILoadOptionsFunctions
        );

        expect(result.results).toEqual([]);
      });

      it('should handle fetch errors gracefully', async () => {
        const mockFunctions = createMockLoadOptionsFunctions();
        mockFunctions.getCurrentNodeParameter = jest.fn().mockReturnValue('sample-query');
        (mockFunctions.helpers!.request as jest.Mock).mockRejectedValue(
          new Error('API Error')
        );

        const result = await arkEvaluation.methods!.listSearch!.searchQueryTargets!.call(
          mockFunctions as ILoadOptionsFunctions
        );

        expect(result.results).toEqual([]);
      });
    });
  });
});
