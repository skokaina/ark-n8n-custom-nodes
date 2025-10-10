import { ArkTeam } from '../ArkTeam.node';
import { IExecuteFunctions, ILoadOptionsFunctions } from 'n8n-workflow';
import {
  createMockExecuteFunctions,
  createMockLoadOptionsFunctions,
  createMockNodeExecutionData,
} from '../../../test-helpers/mocks';
import {
  mockTeamsList,
  mockTeamExecuteRequest,
  mockTeamExecuteResponse,
} from '../../../test-helpers/fixtures';

describe('ArkTeam Node', () => {
  let arkTeam: ArkTeam;

  beforeEach(() => {
    arkTeam = new ArkTeam();
  });

  describe('Node Metadata', () => {
    it('should have correct displayName', () => {
      expect(arkTeam.description.displayName).toBe('ARK Team');
    });

    it('should have correct name', () => {
      expect(arkTeam.description.name).toBe('arkTeam');
    });

    it('should have correct group', () => {
      expect(arkTeam.description.group).toEqual(['transform']);
    });

    it('should have correct version', () => {
      expect(arkTeam.description.version).toBe(1);
    });

    it('should have a description', () => {
      expect(arkTeam.description.description).toBeDefined();
      expect(arkTeam.description.description).toContain('team');
    });

    it('should require ARK API credentials', () => {
      expect(arkTeam.description.credentials).toEqual([
        {
          name: 'arkApi',
          required: true,
        },
      ]);
    });

    it('should have an icon', () => {
      expect(arkTeam.description.icon).toBe('file:ark-team.svg');
    });
  });

  describe('Node Properties', () => {
    it('should have team dropdown property', () => {
      const teamProperty = arkTeam.description.properties.find(
        (p: any) => p.name === 'team'
      );

      expect(teamProperty).toBeDefined();
      expect(teamProperty?.displayName).toBe('Team');
      expect(teamProperty?.type).toBe('options');
      expect(teamProperty?.typeOptions?.loadOptionsMethod).toBe('getTeams');
      expect(teamProperty?.required).toBe(true);
    });

    it('should have input property', () => {
      const inputProperty = arkTeam.description.properties.find(
        (p: any) => p.name === 'input'
      );

      expect(inputProperty).toBeDefined();
      expect(inputProperty?.displayName).toBe('Input');
      expect(inputProperty?.type).toBe('string');
      expect(inputProperty?.required).toBe(true);
    });

    it('should have wait property', () => {
      const waitProperty = arkTeam.description.properties.find(
        (p: any) => p.name === 'wait'
      );

      expect(waitProperty).toBeDefined();
      expect(waitProperty?.displayName).toBe('Wait for Completion');
      expect(waitProperty?.type).toBe('boolean');
      expect(waitProperty?.default).toBe(true);
    });

    it('should have timeout property', () => {
      const timeoutProperty = arkTeam.description.properties.find(
        (p: any) => p.name === 'timeout'
      );

      expect(timeoutProperty).toBeDefined();
      expect(timeoutProperty?.displayName).toBe('Timeout');
      expect(timeoutProperty?.type).toBe('string');
      expect(timeoutProperty?.default).toBe('300s');
    });
  });

  describe('getTeams() Loader Method', () => {
    it('should fetch and format teams list', async () => {
      const mockFunctions = createMockLoadOptionsFunctions();
      (mockFunctions.helpers!.request as jest.Mock).mockResolvedValue(mockTeamsList);

      const result = await arkTeam.methods!.loadOptions!.getTeams!.call(
        mockFunctions as ILoadOptionsFunctions
      );

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        name: 'test-team',
        value: 'test-team',
      });

      expect(mockFunctions.helpers!.request).toHaveBeenCalledWith({
        method: 'GET',
        url: 'http://ark-api.default.svc.cluster.local/v1/teams',
        json: true,
      });
    });

    it('should handle API errors gracefully', async () => {
      const mockFunctions = createMockLoadOptionsFunctions();
      (mockFunctions.helpers!.request as jest.Mock).mockRejectedValue(
        new Error('API Error')
      );

      await expect(
        arkTeam.methods!.loadOptions!.getTeams!.call(
          mockFunctions as ILoadOptionsFunctions
        )
      ).rejects.toThrow('API Error');
    });
  });

  describe('execute() Method', () => {
    it('should execute team with synchronous wait', async () => {
      const inputData = [createMockNodeExecutionData({})];
      const parameters = {
        team: 'test-team',
        input: 'Coordinate a task',
        wait: true,
        timeout: '300s',
      };

      const mockFunctions = createMockExecuteFunctions(inputData, parameters);
      (mockFunctions.helpers!.request as jest.Mock).mockResolvedValue(
        mockTeamExecuteResponse
      );

      const result = await arkTeam.execute!.call(
        mockFunctions as IExecuteFunctions
      );

      expect(result).toHaveLength(1);
      expect(result[0]).toHaveLength(1);
      expect(result[0][0].json).toEqual(mockTeamExecuteResponse);

      expect(mockFunctions.helpers!.request).toHaveBeenCalledWith({
        method: 'POST',
        url: 'http://ark-api.default.svc.cluster.local/v1/teams/test-team/execute',
        body: {
          input: 'Coordinate a task',
          wait: true,
          timeout: '300s',
        },
        json: true,
      });
    });

    it('should handle asynchronous execution (wait=false)', async () => {
      const inputData = [createMockNodeExecutionData({})];
      const parameters = {
        team: 'test-team',
        input: 'Task',
        wait: false,
      };

      const mockFunctions = createMockExecuteFunctions(inputData, parameters);
      const asyncResponse = {
        queryName: 'team-query-async',
        input: 'Task',
        status: 'pending',
        duration: null,
        response: null,
      };
      (mockFunctions.helpers!.request as jest.Mock).mockResolvedValue(asyncResponse);

      const result = await arkTeam.execute!.call(
        mockFunctions as IExecuteFunctions
      );

      expect(result[0][0].json.status).toBe('pending');
    });

    it('should process multiple input items', async () => {
      const inputData = [
        createMockNodeExecutionData({ task: 'First' }),
        createMockNodeExecutionData({ task: 'Second' }),
      ];
      const parameters = {
        team: 'test-team',
        input: 'Coordinate',
        wait: true,
      };

      const mockFunctions = createMockExecuteFunctions(inputData, parameters);
      (mockFunctions.helpers!.request as jest.Mock).mockResolvedValue(
        mockTeamExecuteResponse
      );

      const result = await arkTeam.execute!.call(
        mockFunctions as IExecuteFunctions
      );

      expect(result[0]).toHaveLength(2);
      expect(mockFunctions.helpers!.request).toHaveBeenCalledTimes(2);
    });
  });
});
