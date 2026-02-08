import { ArkAgentAdvanced } from "../ArkAgentAdvanced.node";
import { createMockExecuteFunctions } from "../../../test-helpers/mocks";
import * as arkHelpers from "../../../utils/arkHelpers";

// Mock the arkHelpers module
jest.mock("../../../utils/arkHelpers");

describe("ArkAgentAdvanced Node", () => {
  let node: ArkAgentAdvanced;

  beforeEach(() => {
    node = new ArkAgentAdvanced();
    jest.clearAllMocks();
  });

  describe("Node Properties", () => {
    it("should have correct basic properties", () => {
      expect(node.description.displayName).toBe("ARK Agent Advanced");
      expect(node.description.name).toBe("arkAgentAdvanced");
      expect(node.description.group).toContain("transform");
      expect(node.description.version).toBe(1);
    });

    it("should have correct input configuration", () => {
      expect(node.description.inputs).toBeDefined();
      expect(Array.isArray(node.description.inputs)).toBe(true);

      const inputs = node.description.inputs as any[];
      expect(inputs.length).toBe(4); // main + 3 AI inputs

      // Check AI inputs
      const chatModelInput = inputs.find((i: any) => i.type === "ai_languageModel");
      const memoryInput = inputs.find((i: any) => i.type === "ai_memory");
      const toolsInput = inputs.find((i: any) => i.type === "ai_tool");

      expect(chatModelInput).toBeDefined();
      expect(chatModelInput?.filter?.nodes).toEqual(["CUSTOM.arkModelSelector"]);

      expect(memoryInput).toBeDefined();
      expect(memoryInput?.filter?.nodes).toEqual(["CUSTOM.arkMemory"]);

      expect(toolsInput).toBeDefined();
      expect(toolsInput?.filter?.nodes).toEqual(["CUSTOM.arkTool"]);
    });

    it("should have configuration mode property", () => {
      const configModeProperty = node.description.properties?.find(
        (p) => p.name === "configMode"
      );

      expect(configModeProperty).toBeDefined();
      expect(configModeProperty?.type).toBe("options");
      expect(configModeProperty?.options).toHaveLength(2);
    });

    it("should have agent property", () => {
      const agentProperty = node.description.properties?.find(
        (p) => p.name === "agent"
      );

      expect(agentProperty).toBeDefined();
      expect(agentProperty?.type).toBe("options");
      expect(agentProperty?.required).toBe(true);
    });

    it("should have input property", () => {
      const inputProperty = node.description.properties?.find(
        (p) => p.name === "input"
      );

      expect(inputProperty).toBeDefined();
      expect(inputProperty?.type).toBe("string");
      expect(inputProperty?.required).toBe(true);
    });

    it("should have sessionId property", () => {
      const sessionIdProperty = node.description.properties?.find(
        (p) => p.name === "sessionId"
      );

      expect(sessionIdProperty).toBeDefined();
      expect(sessionIdProperty?.type).toBe("string");
    });

    it("should have wait property", () => {
      const waitProperty = node.description.properties?.find(
        (p) => p.name === "wait"
      );

      expect(waitProperty).toBeDefined();
      expect(waitProperty?.type).toBe("boolean");
      expect(waitProperty?.default).toBe(true);
    });
  });

  describe("loadOptions Methods", () => {
    it("should load agents from API", async () => {
      const mockContext = createMockExecuteFunctions({
        credentials: {
          arkApi: {
            baseUrl: "http://ark-api:8000",
          },
        },
        helpers: {
          request: jest.fn().mockResolvedValue({
            items: [
              { name: "agent1", description: "Test Agent 1" },
              { name: "agent2", description: "Test Agent 2" },
            ],
          }),
        },
      });

      const agents = await node.methods.loadOptions.getAgents.call(mockContext);

      expect(agents).toHaveLength(2);
      expect(agents[0]).toEqual({
        name: "agent1",
        value: "agent1",
        description: "Test Agent 1",
      });
      expect(mockContext.helpers.request).toHaveBeenCalledWith({
        method: "GET",
        url: "http://ark-api:8000/v1/agents",
        json: true,
      });
    });
  });

  describe("execute() Method - Static Mode", () => {
    it("should execute agent in static mode without sub-nodes", async () => {
      const mockContext = createMockExecuteFunctions({
        inputData: [{ json: {} }],
        parameters: {
          configMode: "static",
          agent: "test-agent",
          input: "Hello, agent!",
          sessionId: "test-session-123",
          wait: true,
          timeout: "30s",
        },
        credentials: {
          arkApi: {
            baseUrl: "http://ark-api:8000",
            namespace: "default",
          },
        },
      });

      // Mock helper functions
      (arkHelpers.getSessionId as jest.Mock).mockReturnValue("test-session-123");
      (arkHelpers.extractMemoryRef as jest.Mock).mockResolvedValue(null);
      (arkHelpers.postQuery as jest.Mock).mockResolvedValue(undefined);
      (arkHelpers.pollQueryStatus as jest.Mock).mockResolvedValue({
        status: {
          phase: "done",
          response: { content: "Hello! How can I help?" },
          duration: "1.5s",
        },
      });

      const result = await node.execute.call(mockContext);

      expect(result).toHaveLength(1);
      expect(result[0]).toHaveLength(1);
      expect(result[0][0].json).toMatchObject({
        status: "done",
        input: "Hello, agent!",
        response: "Hello! How can I help?",
        sessionId: "test-session-123",
        agentName: "test-agent",
      });

      // Should not call patchAgent in static mode
      expect(arkHelpers.patchAgent).not.toHaveBeenCalled();
      expect(arkHelpers.postQuery).toHaveBeenCalled();
    });

    it("should handle async execution (wait=false)", async () => {
      const mockContext = createMockExecuteFunctions({
        inputData: [{ json: {} }],
        parameters: {
          configMode: "static",
          agent: "test-agent",
          input: "Hello, agent!",
          sessionId: "test-session-123",
          wait: false,
          timeout: "30s",
        },
        credentials: {
          arkApi: {
            baseUrl: "http://ark-api:8000",
            namespace: "default",
          },
        },
      });

      (arkHelpers.getSessionId as jest.Mock).mockReturnValue("test-session-123");
      (arkHelpers.extractMemoryRef as jest.Mock).mockResolvedValue(null);
      (arkHelpers.postQuery as jest.Mock).mockResolvedValue(undefined);

      const result = await node.execute.call(mockContext);

      expect(result[0][0].json).toMatchObject({
        status: "pending",
        message: "Query created, not waiting for completion",
        sessionId: "test-session-123",
      });

      // Should not poll for status
      expect(arkHelpers.pollQueryStatus).not.toHaveBeenCalled();
    });
  });

  describe("execute() Method - Dynamic Mode", () => {
    it("should update agent configuration with model and tools", async () => {
      const mockContext = createMockExecuteFunctions({
        inputData: [{ json: {} }],
        parameters: {
          configMode: "dynamic",
          agent: "test-agent",
          input: "Hello, agent!",
          sessionId: "test-session-123",
          wait: true,
          timeout: "30s",
        },
        credentials: {
          arkApi: {
            baseUrl: "http://ark-api:8000",
            namespace: "default",
          },
        },
      });

      const mockModelRef = { name: "gpt-4", namespace: "default" };
      const mockTools = [{ type: "custom", name: "web-search" }];

      (arkHelpers.getSessionId as jest.Mock).mockReturnValue("test-session-123");
      (arkHelpers.extractMemoryRef as jest.Mock).mockResolvedValue(null);
      (arkHelpers.extractModelRef as jest.Mock).mockResolvedValue(mockModelRef);
      (arkHelpers.extractToolsConfig as jest.Mock).mockResolvedValue(mockTools);
      (arkHelpers.patchAgent as jest.Mock).mockResolvedValue(undefined);
      (arkHelpers.postQuery as jest.Mock).mockResolvedValue(undefined);
      (arkHelpers.pollQueryStatus as jest.Mock).mockResolvedValue({
        status: {
          phase: "done",
          response: { content: "Response" },
          duration: "2s",
        },
      });

      await node.execute.call(mockContext);

      // Should call patchAgent with model and tools
      expect(arkHelpers.patchAgent).toHaveBeenCalledWith(
        mockContext,
        "http://ark-api:8000",
        "default",
        "test-agent",
        {
          modelRef: mockModelRef,
          tools: mockTools,
        }
      );
    });

    it("should skip patching if no model or tools connected", async () => {
      const mockContext = createMockExecuteFunctions({
        inputData: [{ json: {} }],
        parameters: {
          configMode: "dynamic",
          agent: "test-agent",
          input: "Hello, agent!",
          sessionId: "test-session-123",
          wait: true,
          timeout: "30s",
        },
        credentials: {
          arkApi: {
            baseUrl: "http://ark-api:8000",
            namespace: "default",
          },
        },
      });

      (arkHelpers.getSessionId as jest.Mock).mockReturnValue("test-session-123");
      (arkHelpers.extractMemoryRef as jest.Mock).mockResolvedValue(null);
      (arkHelpers.extractModelRef as jest.Mock).mockResolvedValue(null);
      (arkHelpers.extractToolsConfig as jest.Mock).mockResolvedValue(null);
      (arkHelpers.postQuery as jest.Mock).mockResolvedValue(undefined);
      (arkHelpers.pollQueryStatus as jest.Mock).mockResolvedValue({
        status: { phase: "done", response: { content: "Response" }},
      });

      await node.execute.call(mockContext);

      // Should not call patchAgent
      expect(arkHelpers.patchAgent).not.toHaveBeenCalled();
    });
  });

  describe("execute() Method - Memory Support", () => {
    it("should include memory and sessionId when memory is connected", async () => {
      const mockContext = createMockExecuteFunctions({
        inputData: [{ json: {} }],
        parameters: {
          configMode: "static",
          agent: "test-agent",
          input: "Hello, agent!",
          sessionId: "test-session-123",
          wait: true,
          timeout: "30s",
        },
        credentials: {
          arkApi: {
            baseUrl: "http://ark-api:8000",
            namespace: "default",
          },
        },
      });

      const mockMemoryRef = { name: "default", namespace: "default" };

      (arkHelpers.getSessionId as jest.Mock).mockReturnValue("test-session-123");
      (arkHelpers.extractMemoryRef as jest.Mock).mockResolvedValue(mockMemoryRef);
      (arkHelpers.postQuery as jest.Mock).mockResolvedValue(undefined);
      (arkHelpers.pollQueryStatus as jest.Mock).mockResolvedValue({
        status: { phase: "done", response: { content: "Response" }},
      });

      await node.execute.call(mockContext);

      // Check that postQuery was called with memory and sessionId
      const postQueryCall = (arkHelpers.postQuery as jest.Mock).mock.calls[0];
      const querySpec = postQueryCall[4]; // 5th argument is querySpec

      expect(querySpec.memory).toEqual(mockMemoryRef);
      expect(querySpec.sessionId).toBe("test-session-123");
    });

    it("should always include sessionId even without memory", async () => {
      const mockContext = createMockExecuteFunctions({
        inputData: [{ json: {} }],
        parameters: {
          configMode: "static",
          agent: "test-agent",
          input: "Hello, agent!",
          sessionId: "test-session-123",
          wait: true,
          timeout: "30s",
        },
        credentials: {
          arkApi: {
            baseUrl: "http://ark-api:8000",
            namespace: "default",
          },
        },
      });

      (arkHelpers.getSessionId as jest.Mock).mockReturnValue("test-session-123");
      (arkHelpers.extractMemoryRef as jest.Mock).mockResolvedValue(null);
      (arkHelpers.postQuery as jest.Mock).mockResolvedValue(undefined);
      (arkHelpers.pollQueryStatus as jest.Mock).mockResolvedValue({
        status: { phase: "done", response: { content: "Response" }},
      });

      await node.execute.call(mockContext);

      const postQueryCall = (arkHelpers.postQuery as jest.Mock).mock.calls[0];
      const querySpec = postQueryCall[4];

      expect(querySpec.sessionId).toBe("test-session-123");
      expect(querySpec.memory).toBeUndefined();
    });
  });

  describe("execute() Method - Error Handling", () => {
    it("should handle patch agent failure in dynamic mode", async () => {
      const mockContext = createMockExecuteFunctions({
        inputData: [{ json: {} }],
        parameters: {
          configMode: "dynamic",
          agent: "test-agent",
          input: "Hello, agent!",
          sessionId: "test-session-123",
          wait: true,
          timeout: "30s",
        },
        credentials: {
          arkApi: {
            baseUrl: "http://ark-api:8000",
            namespace: "default",
          },
        },
      });

      (arkHelpers.getSessionId as jest.Mock).mockReturnValue("test-session-123");
      (arkHelpers.extractMemoryRef as jest.Mock).mockResolvedValue(null);
      (arkHelpers.extractModelRef as jest.Mock).mockResolvedValue({ name: "gpt-4", namespace: "default" });
      (arkHelpers.extractToolsConfig as jest.Mock).mockResolvedValue([]);
      (arkHelpers.patchAgent as jest.Mock).mockRejectedValue(new Error("Patch failed"));

      await expect(node.execute.call(mockContext)).rejects.toThrow(
        "Failed to update agent configuration: Patch failed"
      );
    });

    it("should handle query execution failure", async () => {
      const mockContext = createMockExecuteFunctions({
        inputData: [{ json: {} }],
        parameters: {
          configMode: "static",
          agent: "test-agent",
          input: "Hello, agent!",
          sessionId: "test-session-123",
          wait: true,
          timeout: "30s",
        },
        credentials: {
          arkApi: {
            baseUrl: "http://ark-api:8000",
            namespace: "default",
          },
        },
      });

      (arkHelpers.getSessionId as jest.Mock).mockReturnValue("test-session-123");
      (arkHelpers.extractMemoryRef as jest.Mock).mockResolvedValue(null);
      (arkHelpers.postQuery as jest.Mock).mockRejectedValue(new Error("Query failed"));

      await expect(node.execute.call(mockContext)).rejects.toThrow(
        "Query execution failed: Query failed"
      );
    });
  });

  describe("execute() Method - Multiple Items", () => {
    it("should process multiple input items", async () => {
      const mockContext = createMockExecuteFunctions({
        inputData: [{ json: {} }, { json: {} }],
        parameters: {
          configMode: "static",
          agent: "test-agent",
          input: "Hello, agent!",
          sessionId: "test-session-123",
          wait: true,
          timeout: "30s",
        },
        credentials: {
          arkApi: {
            baseUrl: "http://ark-api:8000",
            namespace: "default",
          },
        },
      });

      (arkHelpers.getSessionId as jest.Mock).mockReturnValue("test-session-123");
      (arkHelpers.extractMemoryRef as jest.Mock).mockResolvedValue(null);
      (arkHelpers.postQuery as jest.Mock).mockResolvedValue(undefined);
      (arkHelpers.pollQueryStatus as jest.Mock).mockResolvedValue({
        status: { phase: "done", response: { content: "Response" }},
      });

      const result = await node.execute.call(mockContext);

      expect(result[0]).toHaveLength(2);
      expect(arkHelpers.postQuery).toHaveBeenCalledTimes(2);
      expect(arkHelpers.pollQueryStatus).toHaveBeenCalledTimes(2);
    });
  });
});
