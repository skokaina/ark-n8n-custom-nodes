import { ArkAgent } from "../ArkAgent.node";
import {
  IExecuteFunctions,
  ILoadOptionsFunctions,
  INodeExecutionData,
} from "n8n-workflow";
import {
  createMockExecuteFunctions,
  createMockLoadOptionsFunctions,
  createMockNodeExecutionData,
} from "../../../test-helpers/mocks";
import {
  mockAgentsList,
} from "../../../test-helpers/fixtures";

// Mock timers
jest.useFakeTimers();

describe("ArkAgent Node", () => {
  let arkAgent: ArkAgent;

  beforeEach(() => {
    arkAgent = new ArkAgent();
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.clearAllTimers();
  });

  describe("Node Metadata", () => {
    it("should have correct displayName", () => {
      expect(arkAgent.description.displayName).toBe("ARK Agent");
    });

    it("should have correct name", () => {
      expect(arkAgent.description.name).toBe("arkAgent");
    });

    it("should have correct group", () => {
      expect(arkAgent.description.group).toEqual(["transform"]);
    });

    it("should have correct version", () => {
      expect(arkAgent.description.version).toBe(1);
    });

    it("should have a description", () => {
      expect(arkAgent.description.description).toBeDefined();
      expect(arkAgent.description.description).toContain("ARK agent");
    });

    it("should have defaults", () => {
      expect(arkAgent.description.defaults).toEqual({
        name: "ARK Agent",
      });
    });

    it("should have inputs and outputs", () => {
      expect(arkAgent.description.inputs).toEqual(["main"]);
      expect(arkAgent.description.outputs).toEqual(["main"]);
    });

    it("should require ARK API credentials", () => {
      expect(arkAgent.description.credentials).toEqual([
        {
          name: "arkApi",
          required: true,
        },
      ]);
    });

    it("should have an icon", () => {
      expect(arkAgent.description.icon).toBe("fa:robot");
    });
  });

  describe("Node Properties", () => {
    it("should have agent dropdown property", () => {
      const agentProperty = arkAgent.description.properties.find(
        (p: any) => p.name === "agent",
      );

      expect(agentProperty).toBeDefined();
      expect(agentProperty?.displayName).toBe("Agent");
      expect(agentProperty?.type).toBe("options");
      expect(agentProperty?.typeOptions?.loadOptionsMethod).toBe("getAgents");
      expect(agentProperty?.required).toBe(true);
    });

    it("should have input property", () => {
      const inputProperty = arkAgent.description.properties.find(
        (p: any) => p.name === "input",
      );

      expect(inputProperty).toBeDefined();
      expect(inputProperty?.displayName).toBe("Input");
      expect(inputProperty?.type).toBe("string");
      expect(inputProperty?.required).toBe(true);
    });

    it("should have wait property", () => {
      const waitProperty = arkAgent.description.properties.find(
        (p: any) => p.name === "wait",
      );

      expect(waitProperty).toBeDefined();
      expect(waitProperty?.displayName).toBe("Wait for Completion");
      expect(waitProperty?.type).toBe("boolean");
      expect(waitProperty?.default).toBe(true);
    });

  });

  describe("getAgents() Loader Method", () => {
    it("should fetch and format agents list", async () => {
      const mockFunctions = createMockLoadOptionsFunctions();
      (mockFunctions.helpers!.request as jest.Mock).mockResolvedValue(
        mockAgentsList,
      );

      const result = await arkAgent.methods!.loadOptions!.getAgents!.call(
        mockFunctions as ILoadOptionsFunctions,
      );

      expect(mockFunctions.helpers!.request).toHaveBeenCalledWith({
        method: "GET",
        url: "http://ark-api.default.svc.cluster.local/v1/agents",
        json: true,
      });

      expect(result).toEqual([
        { name: "test-agent", value: "test-agent" },
        { name: "sample-agent", value: "sample-agent" },
      ]);
    });
  });

  describe("execute() Method", () => {
    it("should execute agent with wait=false (async mode)", async () => {
      const inputData = [createMockNodeExecutionData({})];
      const parameters = {
        agent: "test-agent",
        input: "Hello",
        wait: false,
      };

      const mockFunctions = createMockExecuteFunctions(inputData, parameters);
      (mockFunctions.helpers!.request as jest.Mock).mockResolvedValue({});

      const result = await arkAgent.execute!.call(
        mockFunctions as IExecuteFunctions,
      );

      expect(mockFunctions.helpers!.request).toHaveBeenCalledWith(
        expect.objectContaining({
          method: "POST",
          url: "http://ark-api.default.svc.cluster.local/v1/queries",
        })
      );

      expect(result[0][0].json).toMatchObject({
        status: "pending",
        message: "Query created, not waiting for completion",
      });
      expect(result[0][0].json.queryName).toMatch(/^n8n-test-agent-/);
    });

    it("should execute agent with wait=true and poll until done", async () => {
      const inputData = [createMockNodeExecutionData({})];
      const parameters = {
        agent: "test-agent",
        input: "Hello, what can you do?",
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
            responses: [{ content: "I can help with various tasks" }],
            duration: "1.5s",
          },
        });

      (mockFunctions.helpers!.request as jest.Mock)
        .mockImplementationOnce(postMock)
        .mockImplementation(getMock);

      const executePromise = arkAgent.execute!.call(
        mockFunctions as IExecuteFunctions,
      );

      // Fast-forward through polling delays
      await jest.advanceTimersByTimeAsync(5000); // First poll
      await jest.advanceTimersByTimeAsync(5000); // Second poll

      const result = await executePromise;

      expect(result[0][0].json).toMatchObject({
        status: "done",
        input: "Hello, what can you do?",
        response: "I can help with various tasks",
        duration: "1.5s",
      });
    });

    it("should handle query execution failure", async () => {
      const inputData = [createMockNodeExecutionData({})];
      const parameters = {
        agent: "test-agent",
        input: "Hello",
        wait: true,
      };

      const mockFunctions = createMockExecuteFunctions(inputData, parameters);

      // Mock POST query creation
      const postMock = jest.fn().mockResolvedValue({});

      // Mock GET query status - return error
      const getMock = jest.fn().mockResolvedValue({
        status: {
          phase: "error",
          responses: [{ content: "Agent failed" }],
        },
      });

      (mockFunctions.helpers!.request as jest.Mock)
        .mockImplementationOnce(postMock)
        .mockImplementation(getMock);

      const executePromise = arkAgent.execute!.call(
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
        agent: "test-agent",
        input: "Hello",
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

      const executePromise = arkAgent.execute!.call(
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
        createMockNodeExecutionData({ query: "First query" }),
        createMockNodeExecutionData({ query: "Second query" }),
      ];
      const parameters = {
        agent: "test-agent",
        input: "Hello",
        wait: false,
      };

      const mockFunctions = createMockExecuteFunctions(inputData, parameters);
      (mockFunctions.helpers!.request as jest.Mock).mockResolvedValue({});

      const result = await arkAgent.execute!.call(
        mockFunctions as IExecuteFunctions,
      );

      expect(result[0]).toHaveLength(2);
      expect(mockFunctions.helpers!.request).toHaveBeenCalledTimes(2);
    });
  });
});
