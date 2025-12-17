import { ArkTeam } from "../ArkTeam.node";
import {
  IExecuteFunctions,
  ILoadOptionsFunctions,
} from "n8n-workflow";
import {
  createMockExecuteFunctions,
  createMockLoadOptionsFunctions,
  createMockNodeExecutionData,
} from "../../../test-helpers/mocks";
import {
  mockTeamsList,
} from "../../../test-helpers/fixtures";

// Mock timers
jest.useFakeTimers();

describe("ArkTeam Node", () => {
  let arkTeam: ArkTeam;

  beforeEach(() => {
    arkTeam = new ArkTeam();
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.clearAllTimers();
  });

  describe("Node Metadata", () => {
    it("should have correct displayName", () => {
      expect(arkTeam.description.displayName).toBe("ARK Team");
    });

    it("should have correct name", () => {
      expect(arkTeam.description.name).toBe("arkTeam");
    });

    it("should have correct group", () => {
      expect(arkTeam.description.group).toEqual(["transform"]);
    });

    it("should have correct version", () => {
      expect(arkTeam.description.version).toBe(1);
    });

    it("should have a description", () => {
      expect(arkTeam.description.description).toBeDefined();
      expect(arkTeam.description.description).toContain("team");
    });

    it("should require ARK API credentials", () => {
      expect(arkTeam.description.credentials).toEqual([
        {
          name: "arkApi",
          required: true,
        },
      ]);
    });

    it("should have an icon", () => {
      expect(arkTeam.description.icon).toBe("fa:users");
    });
  });

  describe("Node Properties", () => {
    it("should have team dropdown property", () => {
      const teamProperty = arkTeam.description.properties.find(
        (p: any) => p.name === "team",
      );

      expect(teamProperty).toBeDefined();
      expect(teamProperty?.displayName).toBe("Team");
      expect(teamProperty?.type).toBe("options");
      expect(teamProperty?.typeOptions?.loadOptionsMethod).toBe("getTeams");
      expect(teamProperty?.required).toBe(true);
    });

    it("should have input property", () => {
      const inputProperty = arkTeam.description.properties.find(
        (p: any) => p.name === "input",
      );

      expect(inputProperty).toBeDefined();
      expect(inputProperty?.displayName).toBe("Input");
      expect(inputProperty?.type).toBe("string");
      expect(inputProperty?.required).toBe(true);
    });

    it("should have wait property", () => {
      const waitProperty = arkTeam.description.properties.find(
        (p: any) => p.name === "wait",
      );

      expect(waitProperty).toBeDefined();
      expect(waitProperty?.displayName).toBe("Wait for Completion");
      expect(waitProperty?.type).toBe("boolean");
      expect(waitProperty?.default).toBe(true);
    });
  });

  describe("getTeams() Loader Method", () => {
    it("should fetch and format teams list", async () => {
      const mockFunctions = createMockLoadOptionsFunctions();
      (mockFunctions.helpers!.request as jest.Mock).mockResolvedValue(
        mockTeamsList,
      );

      const result = await arkTeam.methods!.loadOptions!.getTeams!.call(
        mockFunctions as ILoadOptionsFunctions,
      );

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        name: "test-team",
        value: "test-team",
      });

      expect(mockFunctions.helpers!.request).toHaveBeenCalledWith({
        method: "GET",
        url: "http://ark-api.default.svc.cluster.local/v1/teams",
        json: true,
      });
    });

    it("should handle API errors gracefully", async () => {
      const mockFunctions = createMockLoadOptionsFunctions();
      (mockFunctions.helpers!.request as jest.Mock).mockRejectedValue(
        new Error("API Error"),
      );

      await expect(
        arkTeam.methods!.loadOptions!.getTeams!.call(
          mockFunctions as ILoadOptionsFunctions,
        ),
      ).rejects.toThrow("API Error");
    });
  });

  describe("execute() Method", () => {
    it("should execute team with wait=false (async mode)", async () => {
      const inputData = [createMockNodeExecutionData({})];
      const parameters = {
        team: "test-team",
        input: "Coordinate a task",
        wait: false,
      };

      const mockFunctions = createMockExecuteFunctions(inputData, parameters);
      (mockFunctions.helpers!.request as jest.Mock).mockResolvedValue({});

      const result = await arkTeam.execute!.call(
        mockFunctions as IExecuteFunctions,
      );

      expect(mockFunctions.helpers!.request).toHaveBeenCalledWith(
        expect.objectContaining({
          method: "POST",
          url: "http://ark-api.default.svc.cluster.local/v1/queries",
        })
      );

      // Verify the request body has correct target type
      const callArgs = (mockFunctions.helpers!.request as jest.Mock).mock.calls[0][0];
      expect(callArgs.body.targets).toEqual([
        { type: "team", name: "test-team" }
      ]);
      expect(callArgs.body.metadata.labels.n8n_team_name).toBe("test-team");

      expect(result[0][0].json).toMatchObject({
        status: "pending",
        message: "Query created, not waiting for completion",
      });
      expect(result[0][0].json.queryName).toMatch(/^n8n-test-team-/);
    });

    it("should execute team with wait=true and poll until done", async () => {
      const inputData = [createMockNodeExecutionData({})];
      const parameters = {
        team: "test-team",
        input: "Coordinate a task",
        wait: true,
      };

      const mockFunctions = createMockExecuteFunctions(inputData, parameters);

      // Mock POST query creation
      const postMock = jest.fn().mockResolvedValue({});

      // Mock GET query status - first running, then done
      const getMock = jest.fn()
        .mockResolvedValueOnce({ status: { phase: "running" } })
        .mockResolvedValueOnce({
          status: {
            phase: "done",
            responses: [{ content: "Task coordinated successfully across agents" }],
            duration: "5.0s",
          },
        });

      (mockFunctions.helpers!.request as jest.Mock)
        .mockImplementationOnce(postMock)
        .mockImplementation(getMock);

      const executePromise = arkTeam.execute!.call(
        mockFunctions as IExecuteFunctions,
      );

      // Fast-forward through polling delays
      await jest.advanceTimersByTimeAsync(5000); // First poll
      await jest.advanceTimersByTimeAsync(5000); // Second poll

      const result = await executePromise;

      expect(result[0][0].json).toMatchObject({
        status: "done",
        input: "Coordinate a task",
        response: "Task coordinated successfully across agents",
        duration: "5.0s",
      });
    });

    it("should handle query execution failure", async () => {
      const inputData = [createMockNodeExecutionData({})];
      const parameters = {
        team: "test-team",
        input: "Coordinate a task",
        wait: true,
      };

      const mockFunctions = createMockExecuteFunctions(inputData, parameters);

      // Mock POST query creation
      const postMock = jest.fn().mockResolvedValue({});

      // Mock GET query status - return error
      const getMock = jest.fn().mockResolvedValue({
        status: {
          phase: "error",
          responses: [{ content: "Team execution failed" }],
        },
      });

      (mockFunctions.helpers!.request as jest.Mock)
        .mockImplementationOnce(postMock)
        .mockImplementation(getMock);

      const executePromise = arkTeam.execute!.call(
        mockFunctions as IExecuteFunctions,
      );

      // Run timers and expect rejection simultaneously
      await Promise.all([
        jest.runAllTimersAsync(),
        expect(executePromise).rejects.toThrow("Query failed")
      ]);
    });

    it("should timeout if query never completes", async () => {
      const inputData = [createMockNodeExecutionData({})];
      const parameters = {
        team: "test-team",
        input: "Coordinate a task",
        wait: true,
      };

      const mockFunctions = createMockExecuteFunctions(inputData, parameters);

      // Mock POST query creation
      const postMock = jest.fn().mockResolvedValue({});

      // Mock GET query status - always running
      const getMock = jest.fn().mockResolvedValue({
        status: { phase: "running" },
      });

      (mockFunctions.helpers!.request as jest.Mock)
        .mockImplementationOnce(postMock)
        .mockImplementation(getMock);

      const executePromise = arkTeam.execute!.call(
        mockFunctions as IExecuteFunctions,
      );

      // Run timers and expect rejection simultaneously
      await Promise.all([
        jest.runAllTimersAsync(),
        expect(executePromise).rejects.toThrow("Query timed out")
      ]);
    });

    it("should process multiple input items", async () => {
      const inputData = [
        createMockNodeExecutionData({ task: "First" }),
        createMockNodeExecutionData({ task: "Second" }),
      ];
      const parameters = {
        team: "test-team",
        input: "Coordinate",
        wait: false,
      };

      const mockFunctions = createMockExecuteFunctions(inputData, parameters);
      (mockFunctions.helpers!.request as jest.Mock).mockResolvedValue({});

      const result = await arkTeam.execute!.call(
        mockFunctions as IExecuteFunctions,
      );

      expect(result[0]).toHaveLength(2);
      expect(mockFunctions.helpers!.request).toHaveBeenCalledTimes(2);
    });

    it("should handle response with missing optional fields", async () => {
      const inputData = [createMockNodeExecutionData({})];
      const parameters = {
        team: "test-team",
        input: "Coordinate a task",
        wait: true,
      };

      const mockFunctions = createMockExecuteFunctions(inputData, parameters);

      // Mock POST query creation
      const postMock = jest.fn().mockResolvedValue({});

      // Mock GET query status with minimal response (missing optional fields)
      const getMock = jest.fn().mockResolvedValue({
        status: {
          phase: "done",
          // responses array is missing, duration is missing
        },
      });

      (mockFunctions.helpers!.request as jest.Mock)
        .mockImplementationOnce(postMock)
        .mockImplementation(getMock);

      const executePromise = arkTeam.execute!.call(
        mockFunctions as IExecuteFunctions,
      );

      await jest.advanceTimersByTimeAsync(5000);

      const result = await executePromise;

      // Should use fallback values for missing fields
      expect(result[0][0].json).toMatchObject({
        status: "done",
        response: "", // fallback for missing content
        duration: null, // fallback for missing duration
      });
    });

    it("should handle workflow with undefined name", async () => {
      const inputData = [createMockNodeExecutionData({})];
      const parameters = {
        team: "test-team",
        input: "Test",
        wait: false,
      };

      const mockFunctions = createMockExecuteFunctions(inputData, parameters);

      // Override getWorkflow to return workflow with undefined name
      mockFunctions.getWorkflow = jest.fn().mockReturnValue({
        id: "workflow-123",
        name: undefined, // undefined name to test ?? fallback
      });

      (mockFunctions.helpers!.request as jest.Mock).mockResolvedValue({});

      await arkTeam.execute!.call(
        mockFunctions as IExecuteFunctions,
      );

      // Verify the metadata labels use fallback value
      const callArgs = (mockFunctions.helpers!.request as jest.Mock).mock.calls[0][0];
      expect(callArgs.body.metadata.labels.n8n_workflow_name).toBe("unknown");
    });
  });
});
