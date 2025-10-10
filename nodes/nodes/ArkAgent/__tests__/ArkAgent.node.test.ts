import { ArkAgent } from '../ArkAgent.node';
import { IExecuteFunctions, ILoadOptionsFunctions, INodeExecutionData } from 'n8n-workflow';
import {
  createMockExecuteFunctions,
  createMockLoadOptionsFunctions,
  createMockNodeExecutionData,
} from '../../../test-helpers/mocks';
import {
  mockAgentsList,
  mockAgentExecuteRequest,
  mockAgentExecuteResponseSuccess,
  mockAgentExecuteResponseFailed,
  mockAgentExecuteResponseTimeout,
  mockAgentExecuteResponseAsync,
} from '../../../test-helpers/fixtures';

describe('ArkAgent Node', () => {
  let arkAgent: ArkAgent;

  beforeEach(() => {
    arkAgent = new ArkAgent();
  });

  describe('Node Metadata', () => {
    it('should have correct displayName', () => {
      expect(arkAgent.description.displayName).toBe('ARK Agent');
    });

    it('should have correct name', () => {
      expect(arkAgent.description.name).toBe('arkAgent');
    });

    it('should have correct group', () => {
      expect(arkAgent.description.group).toEqual(['transform']);
    });

    it('should have correct version', () => {
      expect(arkAgent.description.version).toBe(1);
    });

    it('should have a description', () => {
      expect(arkAgent.description.description).toBeDefined();
      expect(arkAgent.description.description).toContain('ARK agent');
    });

    it('should have defaults', () => {
      expect(arkAgent.description.defaults).toEqual({
        name: 'ARK Agent',
      });
    });

    it('should have inputs and outputs', () => {
      expect(arkAgent.description.inputs).toEqual(['main']);
      expect(arkAgent.description.outputs).toEqual(['main']);
    });

    it('should require ARK API credentials', () => {
      expect(arkAgent.description.credentials).toEqual([
        {
          name: 'arkApi',
          required: true,
        },
      ]);
    });

    it('should have an icon', () => {
      expect(arkAgent.description.icon).toBe('file:ark-agent.svg');
    });
  });

  describe('Node Properties', () => {
    it('should have agent dropdown property', () => {
      const agentProperty = arkAgent.description.properties.find(
        (p: any) => p.name === 'agent'
      );

      expect(agentProperty).toBeDefined();
      expect(agentProperty?.displayName).toBe('Agent');
      expect(agentProperty?.type).toBe('options');
      expect(agentProperty?.typeOptions?.loadOptionsMethod).toBe('getAgents');
      expect(agentProperty?.required).toBe(true);
    });

    it('should have input property', () => {
      const inputProperty = arkAgent.description.properties.find(
        (p: any) => p.name === 'input'
      );

      expect(inputProperty).toBeDefined();
      expect(inputProperty?.displayName).toBe('Input');
      expect(inputProperty?.type).toBe('string');
      expect(inputProperty?.required).toBe(true);
    });

    it('should have wait property', () => {
      const waitProperty = arkAgent.description.properties.find(
        (p: any) => p.name === 'wait'
      );

      expect(waitProperty).toBeDefined();
      expect(waitProperty?.displayName).toBe('Wait for Completion');
      expect(waitProperty?.type).toBe('boolean');
      expect(waitProperty?.default).toBe(true);
    });

    it('should have timeout property', () => {
      const timeoutProperty = arkAgent.description.properties.find(
        (p: any) => p.name === 'timeout'
      );

      expect(timeoutProperty).toBeDefined();
      expect(timeoutProperty?.displayName).toBe('Timeout');
      expect(timeoutProperty?.type).toBe('string');
      expect(timeoutProperty?.default).toBe('300s');
    });

    it('should have sessionId property', () => {
      const sessionIdProperty = arkAgent.description.properties.find(
        (p: any) => p.name === 'sessionId'
      );

      expect(sessionIdProperty).toBeDefined();
      expect(sessionIdProperty?.displayName).toBe('Session ID');
      expect(sessionIdProperty?.type).toBe('string');
    });

    it('should have memory property', () => {
      const memoryProperty = arkAgent.description.properties.find(
        (p: any) => p.name === 'memory'
      );

      expect(memoryProperty).toBeDefined();
      expect(memoryProperty?.displayName).toBe('Memory');
      expect(memoryProperty?.type).toBe('string');
    });
  });

  describe('getAgents() Loader Method', () => {
    it('should fetch and format agents list', async () => {
      const mockFunctions = createMockLoadOptionsFunctions();
      (mockFunctions.helpers!.request as jest.Mock).mockResolvedValue(mockAgentsList);

      const result = await arkAgent.methods!.loadOptions!.getAgents!.call(
        mockFunctions as ILoadOptionsFunctions
      );

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        name: 'test-agent',
        value: 'test-agent',
      });
      expect(result[1]).toEqual({
        name: 'sample-agent',
        value: 'sample-agent',
      });

      expect(mockFunctions.helpers!.request).toHaveBeenCalledWith({
        method: 'GET',
        url: 'http://ark-api.default.svc.cluster.local/v1/agents',
        json: true,
      });
    });

    it('should handle API errors gracefully', async () => {
      const mockFunctions = createMockLoadOptionsFunctions();
      (mockFunctions.helpers!.request as jest.Mock).mockRejectedValue(
        new Error('API Error')
      );

      await expect(
        arkAgent.methods!.loadOptions!.getAgents!.call(
          mockFunctions as ILoadOptionsFunctions
        )
      ).rejects.toThrow('API Error');
    });
  });

  describe('execute() Method', () => {
    it('should execute agent with synchronous wait', async () => {
      const inputData = [createMockNodeExecutionData({})];
      const parameters = {
        agent: 'test-agent',
        input: 'Hello, what can you do?',
        wait: true,
        timeout: '30s',
      };

      const mockFunctions = createMockExecuteFunctions(inputData, parameters);
      (mockFunctions.helpers!.request as jest.Mock).mockResolvedValue(
        mockAgentExecuteResponseSuccess
      );

      const result = await arkAgent.execute!.call(
        mockFunctions as IExecuteFunctions
      );

      expect(result).toHaveLength(1);
      expect(result[0]).toHaveLength(1);
      expect(result[0][0].json).toEqual(mockAgentExecuteResponseSuccess);

      expect(mockFunctions.helpers!.request).toHaveBeenCalledWith({
        method: 'POST',
        url: 'http://ark-api.default.svc.cluster.local/v1/agents/test-agent/execute',
        body: {
          input: 'Hello, what can you do?',
          wait: true,
          timeout: '30s',
        },
        json: true,
      });
    });

    it('should handle asynchronous execution (wait=false)', async () => {
      const inputData = [createMockNodeExecutionData({})];
      const parameters = {
        agent: 'test-agent',
        input: 'Hello',
        wait: false,
      };

      const mockFunctions = createMockExecuteFunctions(inputData, parameters);
      (mockFunctions.helpers!.request as jest.Mock).mockResolvedValue(
        mockAgentExecuteResponseAsync
      );

      const result = await arkAgent.execute!.call(
        mockFunctions as IExecuteFunctions
      );

      expect(result[0][0].json).toEqual(mockAgentExecuteResponseAsync);
      expect(result[0][0].json.status).toBe('pending');
    });

    it('should handle execution timeout', async () => {
      const inputData = [createMockNodeExecutionData({})];
      const parameters = {
        agent: 'test-agent',
        input: 'Hello',
        wait: true,
        timeout: '30s',
      };

      const mockFunctions = createMockExecuteFunctions(inputData, parameters);
      (mockFunctions.helpers!.request as jest.Mock).mockResolvedValue(
        mockAgentExecuteResponseTimeout
      );

      const result = await arkAgent.execute!.call(
        mockFunctions as IExecuteFunctions
      );

      expect(result[0][0].json).toEqual(mockAgentExecuteResponseTimeout);
      expect(result[0][0].json.status).toBe('timeout');
    });

    it('should handle execution failure', async () => {
      const inputData = [createMockNodeExecutionData({})];
      const parameters = {
        agent: 'test-agent',
        input: 'Hello',
        wait: true,
      };

      const mockFunctions = createMockExecuteFunctions(inputData, parameters);
      (mockFunctions.helpers!.request as jest.Mock).mockResolvedValue(
        mockAgentExecuteResponseFailed
      );

      const result = await arkAgent.execute!.call(
        mockFunctions as IExecuteFunctions
      );

      expect(result[0][0].json).toEqual(mockAgentExecuteResponseFailed);
      expect(result[0][0].json.status).toBe('failed');
    });

    it('should pass sessionId when provided', async () => {
      const inputData = [createMockNodeExecutionData({})];
      const parameters = {
        agent: 'test-agent',
        input: 'Hello',
        wait: true,
        sessionId: 'session-123',
      };

      const mockFunctions = createMockExecuteFunctions(inputData, parameters);
      (mockFunctions.helpers!.request as jest.Mock).mockResolvedValue(
        mockAgentExecuteResponseSuccess
      );

      await arkAgent.execute!.call(mockFunctions as IExecuteFunctions);

      expect(mockFunctions.helpers!.request).toHaveBeenCalledWith(
        expect.objectContaining({
          body: expect.objectContaining({
            sessionId: 'session-123',
          }),
        })
      );
    });

    it('should pass memory when provided', async () => {
      const inputData = [createMockNodeExecutionData({})];
      const parameters = {
        agent: 'test-agent',
        input: 'Hello',
        wait: true,
        memory: 'conversation-memory',
      };

      const mockFunctions = createMockExecuteFunctions(inputData, parameters);
      (mockFunctions.helpers!.request as jest.Mock).mockResolvedValue(
        mockAgentExecuteResponseSuccess
      );

      await arkAgent.execute!.call(mockFunctions as IExecuteFunctions);

      expect(mockFunctions.helpers!.request).toHaveBeenCalledWith(
        expect.objectContaining({
          body: expect.objectContaining({
            memory: 'conversation-memory',
          }),
        })
      );
    });

    it('should process multiple input items', async () => {
      const inputData = [
        createMockNodeExecutionData({ query: 'First query' }),
        createMockNodeExecutionData({ query: 'Second query' }),
      ];
      const parameters = {
        agent: 'test-agent',
        input: 'Hello',
        wait: true,
      };

      const mockFunctions = createMockExecuteFunctions(inputData, parameters);
      (mockFunctions.helpers!.request as jest.Mock).mockResolvedValue(
        mockAgentExecuteResponseSuccess
      );

      const result = await arkAgent.execute!.call(
        mockFunctions as IExecuteFunctions
      );

      expect(result[0]).toHaveLength(2);
      expect(mockFunctions.helpers!.request).toHaveBeenCalledTimes(2);
    });
  });
});
