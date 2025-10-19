import { ArkMemory } from "../ArkMemory.node";
import { createMockExecuteFunctions } from "../../../test-helpers/mocks";

describe("ArkMemory Node", () => {
  let node: ArkMemory;

  beforeEach(() => {
    node = new ArkMemory();
    jest.clearAllMocks();
  });

  describe("Node Properties", () => {
    it("should have correct basic properties", () => {
      expect(node.description.displayName).toBe("ARK Memory");
      expect(node.description.name).toBe("arkMemory");
      expect(node.description.group).toContain("transform");
      expect(node.description.version).toBe(1);
    });

    it("should have ai_memory output type", () => {
      expect(node.description.outputs).toEqual([
        {
          displayName: "Memory",
          type: "ai_memory",
        },
      ]);
    });

    it("should have memory property", () => {
      const memoryProperty = node.description.properties?.find(
        (p) => p.name === "memory"
      );

      expect(memoryProperty).toBeDefined();
      expect(memoryProperty?.type).toBe("options");
      expect(memoryProperty?.required).toBe(true);
    });
  });

  describe("loadOptions Methods", () => {
    it("should load memories from namespaced API", async () => {
      const mockContext = createMockExecuteFunctions({
        credentials: {
          arkApi: {
            baseUrl: "http://ark-api:8000",
            namespace: "default",
          },
        },
        helpers: {
          request: jest.fn().mockResolvedValue({
            items: [
              {
                metadata: { name: "memory1" },
                spec: { type: "buffer" },
              },
              {
                metadata: { name: "memory2" },
                spec: { type: "redis" },
              },
            ],
          }),
        },
      });

      const memories = await node.methods.loadOptions.getMemories.call(mockContext);

      expect(memories).toHaveLength(2);
      expect(memories[0]).toEqual({
        name: "memory1 (buffer)",
        value: "memory1",
      });
      expect(memories[1]).toEqual({
        name: "memory2 (redis)",
        value: "memory2",
      });
      expect(mockContext.helpers.request).toHaveBeenCalledWith({
        method: "GET",
        url: "http://ark-api:8000/v1/namespaces/default/memories",
        json: true,
      });
    });

    it("should fallback to non-namespaced API on failure", async () => {
      const mockContext = createMockExecuteFunctions({
        credentials: {
          arkApi: {
            baseUrl: "http://ark-api:8000",
            namespace: "default",
          },
        },
        helpers: {
          request: jest
            .fn()
            .mockRejectedValueOnce(new Error("Namespaced endpoint not found"))
            .mockResolvedValueOnce({
              items: [
                {
                  name: "memory1",
                  spec: { type: "buffer" },
                },
              ],
            }),
        },
      });

      const memories = await node.methods.loadOptions.getMemories.call(mockContext);

      expect(memories).toHaveLength(1);
      expect(memories[0]).toEqual({
        name: "memory1 (buffer)",
        value: "memory1",
      });

      // Should have tried both endpoints
      expect(mockContext.helpers.request).toHaveBeenCalledTimes(2);
      expect(mockContext.helpers.request).toHaveBeenCalledWith({
        method: "GET",
        url: "http://ark-api:8000/v1/memories",
        json: true,
      });
    });

    it("should handle empty memory list", async () => {
      const mockContext = createMockExecuteFunctions({
        credentials: {
          arkApi: {
            baseUrl: "http://ark-api:8000",
            namespace: "default",
          },
        },
        helpers: {
          request: jest.fn().mockResolvedValue({
            items: [],
          }),
        },
      });

      const memories = await node.methods.loadOptions.getMemories.call(mockContext);

      expect(memories).toHaveLength(0);
    });

    it("should return empty array if both endpoints fail", async () => {
      const mockContext = createMockExecuteFunctions({
        credentials: {
          arkApi: {
            baseUrl: "http://ark-api:8000",
            namespace: "default",
          },
        },
        helpers: {
          request: jest.fn().mockRejectedValue(new Error("API error")),
        },
      });

      const memories = await node.methods.loadOptions.getMemories.call(mockContext);

      expect(memories).toHaveLength(0);
    });
  });

  describe("execute() Method", () => {
    it("should fetch and return memory details", async () => {
      const mockContext = createMockExecuteFunctions({
        inputData: [{ json: {} }],
        parameters: {
          memory: "test-memory",
        },
        credentials: {
          arkApi: {
            baseUrl: "http://ark-api:8000",
            namespace: "default",
          },
        },
        helpers: {
          request: jest.fn().mockResolvedValue({
            spec: {
              type: "redis",
              maxMessages: 50,
            },
          }),
        },
      });

      const result = await node.execute.call(mockContext);

      expect(result).toHaveLength(1);
      expect(result[0]).toHaveLength(1);
      expect(result[0][0].json).toMatchObject({
        name: "test-memory",
        namespace: "default",
        type: "redis",
        maxMessages: 50,
        memoryName: "test-memory",
      });

      expect(mockContext.helpers.request).toHaveBeenCalledWith({
        method: "GET",
        url: "http://ark-api:8000/v1/namespaces/default/memories/test-memory",
        json: true,
      });
    });

    it("should use default values if fetch fails", async () => {
      const mockContext = createMockExecuteFunctions({
        inputData: [{ json: {} }],
        parameters: {
          memory: "test-memory",
        },
        credentials: {
          arkApi: {
            baseUrl: "http://ark-api:8000",
            namespace: "default",
          },
        },
        helpers: {
          request: jest.fn().mockRejectedValue(new Error("API error")),
        },
      });

      const result = await node.execute.call(mockContext);

      expect(result[0][0].json).toMatchObject({
        name: "test-memory",
        namespace: "default",
        type: "buffer",
        maxMessages: 20,
      });
    });

    it("should process multiple input items", async () => {
      const mockContext = createMockExecuteFunctions({
        inputData: [{ json: {} }, { json: {} }],
        parameters: {
          memory: "test-memory",
        },
        credentials: {
          arkApi: {
            baseUrl: "http://ark-api:8000",
            namespace: "default",
          },
        },
        helpers: {
          request: jest.fn().mockResolvedValue({
            spec: {
              type: "buffer",
              maxMessages: 20,
            },
          }),
        },
      });

      const result = await node.execute.call(mockContext);

      expect(result[0]).toHaveLength(2);
      expect(mockContext.helpers.request).toHaveBeenCalledTimes(2);
    });

    it("should include pairedItem in output", async () => {
      const mockContext = createMockExecuteFunctions({
        inputData: [{ json: {} }],
        parameters: {
          memory: "test-memory",
        },
        credentials: {
          arkApi: {
            baseUrl: "http://ark-api:8000",
            namespace: "default",
          },
        },
        helpers: {
          request: jest.fn().mockResolvedValue({
            spec: {
              type: "buffer",
              maxMessages: 20,
            },
          }),
        },
      });

      const result = await node.execute.call(mockContext);

      expect(result[0][0].pairedItem).toEqual({ item: 0 });
    });
  });
});
