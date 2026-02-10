import { ArkAgentTool } from "../ArkAgentTool.node";
import { INodeExecutionData } from "n8n-workflow";
import { createMockExecuteFunctions } from "../../../test-helpers/mocks";

describe("ArkAgentTool Node", () => {
  let arkAgentTool: ArkAgentTool;

  beforeEach(() => {
    arkAgentTool = new ArkAgentTool();
    jest.clearAllMocks();
  });

  describe("Node Metadata", () => {
    it("should have correct displayName", () => {
      expect(arkAgentTool.description.displayName).toBe("ARK Agent Tool");
    });

    it("should have correct name", () => {
      expect(arkAgentTool.description.name).toBe("arkAgentTool");
    });

    it("should have correct group", () => {
      expect(arkAgentTool.description.group).toEqual(["transform"]);
    });

    it("should have correct version", () => {
      expect(arkAgentTool.description.version).toBe(1);
    });

    it("should have a description", () => {
      expect(arkAgentTool.description.description).toBeDefined();
      expect(arkAgentTool.description.description).toContain(
        "Execute ARK agent",
      );
    });

    it("should have defaults", () => {
      expect(arkAgentTool.description.defaults).toEqual({
        name: "ARK Agent Tool",
      });
    });

    it("should have inputs and outputs", () => {
      expect(arkAgentTool.description.inputs).toBeDefined();
      expect(arkAgentTool.description.outputs).toBeDefined();

      // Check main input exists
      expect(arkAgentTool.description.inputs).toContain("main");

      // Check AI inputs exist
      const inputs = arkAgentTool.description.inputs as any[];
      const chatModelInput = inputs.find((i: any) => i.type === "ai_languageModel");
      const memoryInput = inputs.find((i: any) => i.type === "ai_memory");
      const toolsInput = inputs.find((i: any) => i.type === "ai_tool");

      expect(chatModelInput).toBeDefined();
      expect(memoryInput).toBeDefined();
      expect(toolsInput).toBeDefined();

      // Check outputs include main and ai_tool
      expect(arkAgentTool.description.outputs).toContain("main");
      const outputs = arkAgentTool.description.outputs as any[];
      const toolOutput = outputs.find((o: any) => o.type === "ai_tool");
      expect(toolOutput).toBeDefined();
    });

    it("should require ARK API credentials", () => {
      expect(arkAgentTool.description.credentials).toEqual([
        {
          name: "arkApi",
          required: true,
        },
      ]);
    });

    it("should have an icon", () => {
      expect(arkAgentTool.description.icon).toBe("file:ark-agent-tool.svg");
    });
  });

  describe("Node Properties", () => {
    it("should have agentName property", () => {
      const agentNameProperty = arkAgentTool.description.properties.find(
        (p: any) => p.name === "agentName",
      );

      expect(agentNameProperty).toBeDefined();
      expect(agentNameProperty?.displayName).toBe("Agent");
      expect(agentNameProperty?.type).toBe("options");
      expect(agentNameProperty?.required).toBe(true);
    });

    it("should have namespace property", () => {
      const namespaceProperty = arkAgentTool.description.properties.find(
        (p: any) => p.name === "namespace",
      );

      expect(namespaceProperty).toBeDefined();
      expect(namespaceProperty?.displayName).toBe("Namespace");
      expect(namespaceProperty?.type).toBe("string");
      expect(namespaceProperty?.default).toBe("default");
    });

    it("should have timeout property", () => {
      const timeoutProperty = arkAgentTool.description.properties.find(
        (p: any) => p.name === "timeout",
      );

      expect(timeoutProperty).toBeDefined();
      expect(timeoutProperty?.displayName).toBe("Timeout");
      expect(timeoutProperty?.type).toBe("string");
      expect(timeoutProperty?.default).toBe("30s");
    });

    it("should have sessionId property", () => {
      const sessionIdProperty = arkAgentTool.description.properties.find(
        (p: any) => p.name === "sessionId",
      );

      expect(sessionIdProperty).toBeDefined();
      expect(sessionIdProperty?.displayName).toBe("Session ID");
      expect(sessionIdProperty?.type).toBe("string");
      expect(sessionIdProperty?.default).toBe("");
    });
  });

  describe("Execute Method", () => {
    beforeEach(() => {
      // Mock setTimeout to resolve immediately for faster tests
      jest.spyOn(global, "setTimeout").mockImplementation((callback: any) => {
        callback();
        return 0 as any;
      });
    });

    afterEach(() => {
      jest.restoreAllMocks();
    });

    it("should execute ARK agent query successfully", async () => {
      const mockFunctions = createMockExecuteFunctions({
        nodeParameters: {
          agentName: "test-agent",
          namespace: "default",
          timeout: "30s",
          memory: "",
          sessionId: "",
        },
        credentials: {
          arkApi: {
            baseUrl: "http://ark-api:8000",
          },
        },
        inputData: [{ json: { input: "Test query" } }],
      });

      // Mock POST /queries (create query)
      const mockPost = jest.fn().mockResolvedValue({
        name: "tool-query-123",
      });

      // Mock GET /queries/{name} (poll status)
      const mockGet = jest.fn().mockResolvedValue({
        status: {
          phase: "done",
          response: {
            content: "Agent response",
          },
          duration: "2s",
        },
      });

      mockFunctions.helpers.request = jest
        .fn()
        .mockImplementation((options: any) => {
          if (options.method === "POST") {
            return mockPost(options);
          } else if (options.method === "GET") {
            return mockGet(options);
          }
          return Promise.reject(new Error("Unexpected method"));
        });

      const result = await arkAgentTool.execute.call(mockFunctions);

      // Verify POST was called to create query
      expect(mockPost).toHaveBeenCalled();

      expect(result[0]).toHaveLength(1);
      expect(result[0][0].json).toMatchObject({
        response: "Agent response",
        status: "done",
        agentName: "test-agent",
        duration: "2s",
      });
      expect(result[0][0].json.queryName).toContain("tool-query-");
    });

    it("should handle input from previous node JSON", async () => {
      const mockFunctions = createMockExecuteFunctions({
        nodeParameters: {
          agentName: "test-agent",
          namespace: "default",
          timeout: "30s",
          memory: "",
          sessionId: "",
        },
        credentials: {
          arkApi: {
            baseUrl: "http://ark-api:8000",
          },
        },
        inputData: [{ json: { data: "some data", value: 42 } }],
      });

      const mockPost = jest.fn().mockResolvedValue({});
      const mockGet = jest.fn().mockResolvedValue({
        status: {
          phase: "done",
          response: { content: "Response" },
        },
      });

      mockFunctions.helpers.request = jest
        .fn()
        .mockImplementation((options: any) => {
          if (options.method === "POST") {
            // Verify input was stringified JSON
            expect(options.body.input).toBe(
              JSON.stringify({ data: "some data", value: 42 }),
            );
            return mockPost(options);
          }
          return mockGet(options);
        });

      await arkAgentTool.execute.call(mockFunctions);

      expect(mockPost).toHaveBeenCalled();
    });

    it.skip("should support memory and session ID", async () => {
      const mockFunctions = createMockExecuteFunctions({
        nodeParameters: {
          agentName: "support-agent",
          namespace: "default",
          timeout: "30s",
          memory: "conversation-memory",
          sessionId: "user-123-session",
        },
        credentials: {
          arkApi: {
            baseUrl: "http://ark-api:8000",
          },
        },
        inputData: [{ json: { input: "What did we discuss?" } }],
      });

      const mockPost = jest.fn().mockResolvedValue({});
      const mockGet = jest.fn().mockResolvedValue({
        status: {
          phase: "done",
          response: { content: "We discussed X" },
        },
      });

      mockFunctions.helpers.request = jest
        .fn()
        .mockImplementation((options: any) => {
          if (options.method === "POST") {
            // Verify memory and session ID were included
            expect(options.body.memory).toEqual({
              name: "conversation-memory",
              namespace: "default",
            });
            expect(options.body.sessionId).toBe("user-123-session");
            return mockPost(options);
          }
          return mockGet(options);
        });

      const result = await arkAgentTool.execute.call(mockFunctions);

      expect(result[0][0].json.sessionId).toBe("user-123-session");
    });

    it("should handle query timeout", async () => {
      const mockFunctions = createMockExecuteFunctions({
        nodeParameters: {
          agentName: "slow-agent",
          namespace: "default",
          timeout: "5s",
          memory: "",
          sessionId: "",
        },
        credentials: {
          arkApi: {
            baseUrl: "http://ark-api:8000",
          },
        },
        inputData: [{ json: { input: "Slow query" } }],
      });

      let pollCount = 0;
      const mockPost = jest.fn().mockResolvedValue({});
      const mockGet = jest.fn().mockImplementation(() => {
        pollCount++;
        // After 60 attempts, should timeout
        return Promise.resolve({
          status: {
            phase: "running", // Never completes
          },
        });
      });

      mockFunctions.helpers.request = jest
        .fn()
        .mockImplementation((options: any) => {
          if (options.method === "POST") {
            return mockPost(options);
          }
          return mockGet(options);
        });

      await expect(
        arkAgentTool.execute.call(mockFunctions),
      ).rejects.toThrow("timed out");
      expect(pollCount).toBe(60); // Verify it tried 60 times
    });

    it("should handle query errors", async () => {
      const mockFunctions = createMockExecuteFunctions({
        nodeParameters: {
          agentName: "error-agent",
          namespace: "default",
          timeout: "30s",
          memory: "",
          sessionId: "",
        },
        credentials: {
          arkApi: {
            baseUrl: "http://ark-api:8000",
          },
        },
        inputData: [{ json: { input: "Error query" } }],
      });

      const mockPost = jest.fn().mockResolvedValue({});
      const mockGet = jest.fn().mockResolvedValue({
        status: {
          phase: "error",
          response: {
            content: "Agent execution failed",
          },
        },
      });

      mockFunctions.helpers.request = jest
        .fn()
        .mockImplementation((options: any) => {
          if (options.method === "POST") {
            return mockPost(options);
          }
          return mockGet(options);
        });

      await expect(
        arkAgentTool.execute.call(mockFunctions),
      ).rejects.toThrow("Query failed");
    });

    it("should continue on fail when enabled", async () => {
      const mockFunctions = createMockExecuteFunctions({
        nodeParameters: {
          agentName: "error-agent",
          namespace: "default",
          timeout: "30s",
          memory: "",
          sessionId: "",
        },
        credentials: {
          arkApi: {
            baseUrl: "http://ark-api:8000",
          },
        },
        inputData: [{ json: { input: "Error query" } }],
      });

      mockFunctions.continueOnFail = jest.fn().mockReturnValue(true);

      const mockPost = jest.fn().mockResolvedValue({});
      const mockGet = jest.fn().mockResolvedValue({
        status: {
          phase: "error",
          response: { content: "Failed" },
        },
      });

      mockFunctions.helpers.request = jest
        .fn()
        .mockImplementation((options: any) => {
          if (options.method === "POST") {
            return mockPost(options);
          }
          return mockGet(options);
        });

      const result = await arkAgentTool.execute.call(mockFunctions);

      expect(result[0]).toHaveLength(1);
      expect(result[0][0].json).toMatchObject({
        error: expect.stringContaining("Query failed"),
        agentName: "error-agent",
      });
    });
  });
});
