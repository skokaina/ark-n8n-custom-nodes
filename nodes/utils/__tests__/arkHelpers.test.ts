import {
  getAuthHeader,
  getSessionId,
  patchAgent,
  postQuery,
  pollQueryStatus,
  extractModelRef,
  extractToolsConfig,
  extractMemoryRef,
  extractResponseContent,
} from "../arkHelpers";
import { createMockExecuteFunctions } from "../../test-helpers/mocks";

describe("arkHelpers", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("getAuthHeader", () => {
    it("should return undefined for none scheme", () => {
      expect(getAuthHeader({ authScheme: "none" })).toBeUndefined();
    });

    it("should return undefined when authScheme is not set", () => {
      expect(getAuthHeader({})).toBeUndefined();
    });

    it("should return Basic header for basic scheme", () => {
      const header = getAuthHeader({
        authScheme: "basic",
        apiKey: "pk-ark-test:sk-ark-test",
      });

      expect(header).toBe(
        `Basic ${Buffer.from("pk-ark-test:sk-ark-test").toString("base64")}`,
      );
    });

    it("should return undefined for basic scheme without apiKey", () => {
      expect(getAuthHeader({ authScheme: "basic" })).toBeUndefined();
    });

    it("should return Bearer header for bearer scheme", () => {
      const header = getAuthHeader({
        authScheme: "bearer",
        bearerToken: "eyJhbGciOiJSUzI1NiIs.test.token",
      });

      expect(header).toBe("Bearer eyJhbGciOiJSUzI1NiIs.test.token");
    });

    it("should return undefined for bearer scheme without bearerToken", () => {
      expect(getAuthHeader({ authScheme: "bearer" })).toBeUndefined();
    });
  });

  describe("extractResponseContent", () => {
    it("should extract from current ARK API single response field", () => {
      const result = extractResponseContent({
        status: { response: "Hello from agent" },
      });
      expect(result).toBe("Hello from agent");
    });

    it("should extract from legacy responses array", () => {
      const result = extractResponseContent({
        status: { responses: [{ content: "Legacy response" }] },
      });
      expect(result).toBe("Legacy response");
    });

    it("should prefer single response field over legacy array", () => {
      const result = extractResponseContent({
        status: {
          response: "Current response",
          responses: [{ content: "Legacy response" }],
        },
      });
      expect(result).toBe("Current response");
    });

    it("should return empty string if no response data", () => {
      expect(extractResponseContent({ status: {} })).toBe("");
      expect(extractResponseContent({})).toBe("");
    });
  });

  describe("getSessionId", () => {
    it("should return user-provided session ID", () => {
      const mockContext = createMockExecuteFunctions({
        parameters: {
          sessionId: "user-custom-session",
        },
      });

      const sessionId = getSessionId(mockContext, 0);

      expect(sessionId).toBe("user-custom-session");
    });

    it("should trim whitespace from session ID", () => {
      const mockContext = createMockExecuteFunctions({
        parameters: {
          sessionId: "  session-with-spaces  ",
        },
      });

      const sessionId = getSessionId(mockContext, 0);

      expect(sessionId).toBe("session-with-spaces");
    });

    it("should auto-generate session ID if empty", () => {
      const mockContext = createMockExecuteFunctions({
        parameters: {
          sessionId: "",
        },
        workflow: {
          id: "workflow-123",
        },
        executionId: "exec-456",
      });

      const sessionId = getSessionId(mockContext, 0);

      expect(sessionId).toMatch(/^n8n-workflow-123-exec-456-\d+$/);
    });

    it("should auto-generate session ID if whitespace only", () => {
      const mockContext = createMockExecuteFunctions({
        parameters: {
          sessionId: "   ",
        },
        workflow: {
          id: "workflow-123",
        },
        executionId: "exec-456",
      });

      const sessionId = getSessionId(mockContext, 0);

      expect(sessionId).toMatch(/^n8n-workflow-123-exec-456-\d+$/);
    });
  });

  describe("extractModelRef", () => {
    it("should extract model reference from connected node", async () => {
      const mockContext = createMockExecuteFunctions({});
      mockContext.getInputConnectionData = jest.fn().mockResolvedValue({
        name: "gpt-4",
        namespace: "default",
      });

      const modelRef = await extractModelRef(mockContext, 0);

      expect(modelRef).toEqual({
        name: "gpt-4",
        namespace: "default",
      });
      expect(mockContext.getInputConnectionData).toHaveBeenCalledWith(
        "ai_languageModel",
        0
      );
    });

    it("should return null if no model connected", async () => {
      const mockContext = createMockExecuteFunctions({});
      mockContext.getInputConnectionData = jest.fn().mockResolvedValue(null);

      const modelRef = await extractModelRef(mockContext, 0);

      expect(modelRef).toBeNull();
    });

    it("should handle errors gracefully", async () => {
      const mockContext = createMockExecuteFunctions({});
      mockContext.getInputConnectionData = jest
        .fn()
        .mockRejectedValue(new Error("Connection error"));

      const modelRef = await extractModelRef(mockContext, 0);

      expect(modelRef).toBeNull();
    });

    it("should extract model name from various fields", async () => {
      const mockContext = createMockExecuteFunctions({});
      mockContext.getInputConnectionData = jest.fn().mockResolvedValue({
        modelName: "claude-3",
      });

      const modelRef = await extractModelRef(mockContext, 0);

      expect(modelRef?.name).toBe("claude-3");
    });
  });

  describe("extractToolsConfig", () => {
    it("should extract tools from connected nodes (array)", async () => {
      const mockContext = createMockExecuteFunctions({});
      mockContext.getInputConnectionData = jest.fn().mockResolvedValue([
        { name: "web-search", type: "builtin" },
        { name: "calculator", type: "builtin" },
      ]);

      const tools = await extractToolsConfig(mockContext, 0);

      expect(tools).toHaveLength(2);
      expect(tools).toEqual([
        { type: "builtin", name: "web-search" },
        { type: "builtin", name: "calculator" },
      ]);
    });

    it("should extract single tool", async () => {
      const mockContext = createMockExecuteFunctions({});
      mockContext.getInputConnectionData = jest.fn().mockResolvedValue({
        name: "web-search",
        type: "builtin",
      });

      const tools = await extractToolsConfig(mockContext, 0);

      expect(tools).toHaveLength(1);
      expect(tools![0]).toEqual({ type: "builtin", name: "web-search" });
    });

    it("should identify custom tools", async () => {
      const mockContext = createMockExecuteFunctions({});
      mockContext.getInputConnectionData = jest.fn().mockResolvedValue({
        name: "my-custom-tool",
        type: "custom",
      });

      const tools = await extractToolsConfig(mockContext, 0);

      expect(tools![0].type).toBe("custom");
    });

    it("should return null if no tools connected", async () => {
      const mockContext = createMockExecuteFunctions({});
      mockContext.getInputConnectionData = jest.fn().mockResolvedValue(null);

      const tools = await extractToolsConfig(mockContext, 0);

      expect(tools).toBeNull();
    });

    it("should handle errors gracefully", async () => {
      const mockContext = createMockExecuteFunctions({});
      mockContext.getInputConnectionData = jest
        .fn()
        .mockRejectedValue(new Error("Connection error"));

      const tools = await extractToolsConfig(mockContext, 0);

      expect(tools).toBeNull();
    });
  });

  describe("extractMemoryRef", () => {
    it("should extract memory reference from connected node", async () => {
      const mockContext = createMockExecuteFunctions({});
      mockContext.getInputConnectionData = jest.fn().mockResolvedValue({
        name: "default",
        namespace: "default",
      });

      const memoryRef = await extractMemoryRef(mockContext, 0);

      expect(memoryRef).toEqual({
        name: "default",
        namespace: "default",
      });
      expect(mockContext.getInputConnectionData).toHaveBeenCalledWith(
        "ai_memory",
        0
      );
    });

    it("should return null if no memory connected", async () => {
      const mockContext = createMockExecuteFunctions({});
      mockContext.getInputConnectionData = jest.fn().mockResolvedValue(null);

      const memoryRef = await extractMemoryRef(mockContext, 0);

      expect(memoryRef).toBeNull();
    });

    it("should handle errors gracefully", async () => {
      const mockContext = createMockExecuteFunctions({});
      mockContext.getInputConnectionData = jest
        .fn()
        .mockRejectedValue(new Error("Connection error"));

      const memoryRef = await extractMemoryRef(mockContext, 0);

      expect(memoryRef).toBeNull();
    });

    it("should extract memory name from memoryName field", async () => {
      const mockContext = createMockExecuteFunctions({});
      mockContext.getInputConnectionData = jest.fn().mockResolvedValue({
        memoryName: "redis-memory",
      });

      const memoryRef = await extractMemoryRef(mockContext, 0);

      expect(memoryRef?.name).toBe("redis-memory");
    });
  });

  describe("patchAgent", () => {
    it("should patch agent with model and tools", async () => {
      const mockContext = createMockExecuteFunctions({
        credentials: {
          arkApi: {
            authScheme: "basic",
            apiKey: "pk-ark-test:sk-ark-test",
          },
        },
        helpers: {
          request: jest.fn().mockResolvedValue({}),
        },
      });

      await patchAgent(mockContext, "http://ark-api:8000", "default", "test-agent", {
        modelRef: { name: "gpt-4", namespace: "default" },
        tools: [{ type: "builtin", name: "web-search" }],
      });

      expect(mockContext.helpers.request).toHaveBeenCalledWith(
        expect.objectContaining({
          method: "PATCH",
          url: "http://ark-api:8000/v1/namespaces/default/agents/test-agent",
          body: {
            spec: {
              modelRef: { name: "gpt-4", namespace: "default" },
              tools: [{ type: "builtin", name: "web-search" }],
            },
          },
          json: true,
        })
      );
    });

    it("should include Basic auth header when authScheme is basic", async () => {
      const mockContext = createMockExecuteFunctions({
        credentials: {
          arkApi: {
            authScheme: "basic",
            apiKey: "pk-ark-test:sk-ark-test",
          },
        },
        helpers: {
          request: jest.fn().mockResolvedValue({}),
        },
      });

      await patchAgent(mockContext, "http://ark-api:8000", "default", "test-agent", {
        modelRef: { name: "gpt-4", namespace: "default" },
      });

      const requestCall = mockContext.helpers.request as jest.Mock;
      const requestOptions = requestCall.mock.calls[0][0];

      expect(requestOptions.headers.Authorization).toBeDefined();
      expect(requestOptions.headers.Authorization).toMatch(/^Basic /);
    });

    it("should include Bearer auth header when authScheme is bearer", async () => {
      const mockContext = createMockExecuteFunctions({
        credentials: {
          arkApi: {
            authScheme: "bearer",
            bearerToken: "my-jwt-token",
          },
        },
        helpers: {
          request: jest.fn().mockResolvedValue({}),
        },
      });

      await patchAgent(mockContext, "http://ark-api:8000", "default", "test-agent", {
        modelRef: { name: "gpt-4", namespace: "default" },
      });

      const requestCall = mockContext.helpers.request as jest.Mock;
      const requestOptions = requestCall.mock.calls[0][0];

      expect(requestOptions.headers.Authorization).toBe("Bearer my-jwt-token");
    });

    it("should not include auth header when authScheme is none", async () => {
      const mockContext = createMockExecuteFunctions({
        credentials: {
          arkApi: {
            authScheme: "none",
          },
        },
        helpers: {
          request: jest.fn().mockResolvedValue({}),
        },
      });

      await patchAgent(mockContext, "http://ark-api:8000", "default", "test-agent", {
        modelRef: { name: "gpt-4", namespace: "default" },
      });

      const requestCall = mockContext.helpers.request as jest.Mock;
      const requestOptions = requestCall.mock.calls[0][0];

      expect(requestOptions.headers.Authorization).toBeUndefined();
    });

    it("should not patch if no config to update", async () => {
      const mockContext = createMockExecuteFunctions({
        credentials: {
          arkApi: {},
        },
        helpers: {
          request: jest.fn().mockResolvedValue({}),
        },
      });

      await patchAgent(mockContext, "http://ark-api:8000", "default", "test-agent", {});

      expect(mockContext.helpers.request).not.toHaveBeenCalled();
    });

    it("should patch with only model ref", async () => {
      const mockContext = createMockExecuteFunctions({
        credentials: {
          arkApi: {},
        },
        helpers: {
          request: jest.fn().mockResolvedValue({}),
        },
      });

      await patchAgent(mockContext, "http://ark-api:8000", "default", "test-agent", {
        modelRef: { name: "gpt-4", namespace: "default" },
        tools: null,
      });

      expect(mockContext.helpers.request).toHaveBeenCalledWith(
        expect.objectContaining({
          body: {
            spec: {
              modelRef: { name: "gpt-4", namespace: "default" },
            },
          },
        })
      );
    });
  });

  describe("postQuery", () => {
    it("should create query with flat structure", async () => {
      const mockContext = createMockExecuteFunctions({
        credentials: {
          arkApi: {},
        },
        helpers: {
          request: jest.fn().mockResolvedValue({}),
        },
      });

      const querySpec = {
        type: "user",
        input: "Hello",
        targets: [{ type: "agent", name: "test-agent" }],
        wait: true,
        timeout: "30s",
      };

      await postQuery(
        mockContext,
        "http://ark-api:8000",
        "default",
        "test-query",
        querySpec
      );

      expect(mockContext.helpers.request).toHaveBeenCalledWith(
        expect.objectContaining({
          method: "POST",
          url: "http://ark-api:8000/v1/queries",
          body: {
            name: "test-query",
            type: "user",
            input: "Hello",
            targets: [{ type: "agent", name: "test-agent" }],
            wait: true,
            timeout: "30s",
          },
          json: true,
        })
      );
    });

    it("should include Basic auth header when authScheme is basic", async () => {
      const mockContext = createMockExecuteFunctions({
        credentials: {
          arkApi: {
            authScheme: "basic",
            apiKey: "pk-ark-test:sk-ark-test",
          },
        },
        helpers: {
          request: jest.fn().mockResolvedValue({}),
        },
      });

      await postQuery(mockContext, "http://ark-api:8000", "default", "test-query", {
        type: "user",
        input: "Hello",
        targets: [],
      });

      const requestCall = mockContext.helpers.request as jest.Mock;
      const requestOptions = requestCall.mock.calls[0][0];

      expect(requestOptions.headers.Authorization).toBeDefined();
      expect(requestOptions.headers.Authorization).toMatch(/^Basic /);
    });

    it("should include Bearer auth header when authScheme is bearer", async () => {
      const mockContext = createMockExecuteFunctions({
        credentials: {
          arkApi: {
            authScheme: "bearer",
            bearerToken: "my-jwt-token",
          },
        },
        helpers: {
          request: jest.fn().mockResolvedValue({}),
        },
      });

      await postQuery(mockContext, "http://ark-api:8000", "default", "test-query", {
        type: "user",
        input: "Hello",
        targets: [],
      });

      const requestCall = mockContext.helpers.request as jest.Mock;
      const requestOptions = requestCall.mock.calls[0][0];

      expect(requestOptions.headers.Authorization).toBe("Bearer my-jwt-token");
    });

    it("should include sessionId and memory in query", async () => {
      const mockContext = createMockExecuteFunctions({
        credentials: {
          arkApi: {},
        },
        helpers: {
          request: jest.fn().mockResolvedValue({}),
        },
      });

      const querySpec = {
        type: "user",
        input: "Hello",
        targets: [],
        sessionId: "test-session",
        memory: { name: "default", namespace: "default" },
      };

      await postQuery(
        mockContext,
        "http://ark-api:8000",
        "default",
        "test-query",
        querySpec
      );

      const requestCall = mockContext.helpers.request as jest.Mock;
      const body = requestCall.mock.calls[0][0].body;

      expect(body.sessionId).toBe("test-session");
      expect(body.memory).toEqual({ name: "default", namespace: "default" });
    });
  });

  describe("pollQueryStatus", () => {
    it("should poll until query is done", async () => {
      const mockContext = createMockExecuteFunctions({
        credentials: {
          arkApi: {},
        },
        helpers: {
          request: jest
            .fn()
            .mockResolvedValueOnce({ status: { phase: "running" } })
            .mockResolvedValueOnce({ status: { phase: "done", responses: [{ content: "Response" }] } }),
        },
      });

      jest.useFakeTimers();

      const pollPromise = pollQueryStatus(
        mockContext,
        "http://ark-api:8000",
        "default",
        "test-query",
        10
      );

      // Fast-forward time to trigger polling
      await jest.advanceTimersByTimeAsync(1000);
      await jest.advanceTimersByTimeAsync(2000);

      const result = await pollPromise;

      expect(result.status.phase).toBe("done");
      expect(mockContext.helpers.request).toHaveBeenCalledTimes(2);

      jest.useRealTimers();
    });

    it("should throw error if query fails", async () => {
      const mockContext = createMockExecuteFunctions({
        credentials: {
          arkApi: {},
        },
        helpers: {
          request: jest.fn().mockResolvedValue({
            status: {
              phase: "error",
              responses: [{ content: "Query failed" }],
            },
          }),
        },
      });

      jest.useFakeTimers();

      const pollPromise = pollQueryStatus(
        mockContext,
        "http://ark-api:8000",
        "default",
        "test-query",
        10
      );

      // Run timers and expect rejection simultaneously
      const [_] = await Promise.all([
        jest.runAllTimersAsync(),
        expect(pollPromise).rejects.toThrow("Query failed")
      ]);

      jest.useRealTimers();
    });

    it("should timeout after max attempts", async () => {
      const mockContext = createMockExecuteFunctions({
        credentials: {
          arkApi: {},
        },
        helpers: {
          request: jest.fn().mockResolvedValue({
            status: { phase: "running" },
          }),
        },
      });

      jest.useFakeTimers();

      const pollPromise = pollQueryStatus(
        mockContext,
        "http://ark-api:8000",
        "default",
        "test-query",
        2 // Only 2 attempts
      );

      // Run timers and expect rejection simultaneously
      await Promise.all([
        jest.runAllTimersAsync(),
        expect(pollPromise).rejects.toThrow("Query timed out")
      ]);

      jest.useRealTimers();
    });

    it("should include Basic auth header when authScheme is basic", async () => {
      const mockContext = createMockExecuteFunctions({
        credentials: {
          arkApi: {
            authScheme: "basic",
            apiKey: "pk-ark-test:sk-ark-test",
          },
        },
        helpers: {
          request: jest.fn().mockResolvedValue({
            status: { phase: "done" },
          }),
        },
      });

      jest.useFakeTimers();

      const pollPromise = pollQueryStatus(
        mockContext,
        "http://ark-api:8000",
        "default",
        "test-query",
        10
      );

      await jest.advanceTimersByTimeAsync(1000);
      await pollPromise;

      const requestCall = mockContext.helpers.request as jest.Mock;
      const requestOptions = requestCall.mock.calls[0][0];

      expect(requestOptions.headers.Authorization).toMatch(/^Basic /);

      jest.useRealTimers();
    });

    it("should include Bearer auth header when authScheme is bearer", async () => {
      const mockContext = createMockExecuteFunctions({
        credentials: {
          arkApi: {
            authScheme: "bearer",
            bearerToken: "my-jwt-token",
          },
        },
        helpers: {
          request: jest.fn().mockResolvedValue({
            status: { phase: "done" },
          }),
        },
      });

      jest.useFakeTimers();

      const pollPromise = pollQueryStatus(
        mockContext,
        "http://ark-api:8000",
        "default",
        "test-query",
        10
      );

      await jest.advanceTimersByTimeAsync(1000);
      await pollPromise;

      const requestCall = mockContext.helpers.request as jest.Mock;
      const requestOptions = requestCall.mock.calls[0][0];

      expect(requestOptions.headers.Authorization).toBe("Bearer my-jwt-token");

      jest.useRealTimers();
    });

    it("should not include auth header when authScheme is none", async () => {
      const mockContext = createMockExecuteFunctions({
        credentials: {
          arkApi: {
            authScheme: "none",
          },
        },
        helpers: {
          request: jest.fn().mockResolvedValue({
            status: { phase: "done" },
          }),
        },
      });

      jest.useFakeTimers();

      const pollPromise = pollQueryStatus(
        mockContext,
        "http://ark-api:8000",
        "default",
        "test-query",
        10
      );

      await jest.advanceTimersByTimeAsync(1000);
      await pollPromise;

      const requestCall = mockContext.helpers.request as jest.Mock;
      const requestOptions = requestCall.mock.calls[0][0];

      expect(requestOptions.headers.Authorization).toBeUndefined();

      jest.useRealTimers();
    });
  });
});
