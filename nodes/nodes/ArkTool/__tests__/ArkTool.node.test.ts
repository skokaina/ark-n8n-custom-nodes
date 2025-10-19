import { ArkTool } from "../ArkTool.node";
import { createMockExecuteFunctions } from "../../../test-helpers/mocks";

describe("ArkTool Node", () => {
  let node: ArkTool;

  beforeEach(() => {
    node = new ArkTool();
    jest.clearAllMocks();
  });

  describe("Node Properties", () => {
    it("should have correct basic properties", () => {
      expect(node.description.displayName).toBe("ARK Tool");
      expect(node.description.name).toBe("arkTool");
      expect(node.description.group).toContain("transform");
      expect(node.description.version).toBe(1);
    });

    it("should have ai_tool output type", () => {
      expect(node.description.outputs).toEqual([
        {
          displayName: "Tool",
          type: "ai_tool",
        },
      ]);
    });

    it("should have tool property", () => {
      const toolProperty = node.description.properties?.find(
        (p) => p.name === "tool"
      );

      expect(toolProperty).toBeDefined();
      expect(toolProperty?.type).toBe("options");
      expect(toolProperty?.required).toBe(true);
    });
  });

  describe("loadOptions Methods", () => {
    it("should load tools from namespaced API", async () => {
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
                metadata: { name: "web-search" },
                spec: { type: "builtin" },
              },
              {
                metadata: { name: "code-interpreter" },
                spec: { type: "builtin" },
              },
            ],
          }),
        },
      });

      const tools = await node.methods.loadOptions.getTools.call(mockContext);

      expect(tools).toHaveLength(2);
      expect(tools[0]).toEqual({
        name: "web-search",
        value: "web-search",
        description: "",
      });
      expect(tools[1]).toEqual({
        name: "code-interpreter",
        value: "code-interpreter",
        description: "",
      });
      expect(mockContext.helpers.request).toHaveBeenCalledWith({
        method: "GET",
        url: "http://ark-api:8000/v1/namespaces/default/tools",
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
                  name: "web-search",
                  spec: { type: "builtin" },
                },
              ],
            }),
        },
      });

      const tools = await node.methods.loadOptions.getTools.call(mockContext);

      expect(tools).toHaveLength(1);
      expect(tools[0]).toEqual({
        name: "web-search",
        value: "web-search",
        description: "",
      });

      // Should have tried both endpoints
      expect(mockContext.helpers.request).toHaveBeenCalledTimes(2);
      expect(mockContext.helpers.request).toHaveBeenCalledWith({
        method: "GET",
        url: "http://ark-api:8000/v1/tools",
        json: true,
      });
    });

    it("should return default tools when API returns empty list", async () => {
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

      const tools = await node.methods.loadOptions.getTools.call(mockContext);

      // When empty list is returned, it throws and falls back to defaults
      expect(tools).toHaveLength(3);
      expect(tools[0].value).toBe("web-search");
      expect(tools[1].value).toBe("code-interpreter");
      expect(tools[2].value).toBe("calculator");
    });

    it("should return default tools if both endpoints fail", async () => {
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

      const tools = await node.methods.loadOptions.getTools.call(mockContext);

      // Falls back to default built-in tools
      expect(tools).toHaveLength(3);
      expect(tools[0].value).toBe("web-search");
      expect(tools[1].value).toBe("code-interpreter");
      expect(tools[2].value).toBe("calculator");
    });

    it("should handle tools without type field", async () => {
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
                metadata: { name: "custom-tool" },
                spec: {},
              },
            ],
          }),
        },
      });

      const tools = await node.methods.loadOptions.getTools.call(mockContext);

      expect(tools).toHaveLength(1);
      expect(tools[0]).toEqual({
        name: "custom-tool",
        value: "custom-tool",
        description: "",
      });
    });
  });

  describe("execute() Method", () => {
    it("should fetch and return tool details", async () => {
      const mockContext = createMockExecuteFunctions({
        inputData: [{ json: {} }],
        parameters: {
          selectionMode: "select",
          tool: "web-search",
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
              builtin: true,
              description: "Search the web",
              parameters: {
                query: { type: "string" },
              },
            },
          }),
        },
      });

      const result = await node.execute.call(mockContext);

      expect(result).toHaveLength(1);
      expect(result[0]).toHaveLength(1);
      expect(result[0][0].json).toMatchObject({
        name: "web-search",
        type: "builtin",
        description: "Search the web",
        toolName: "web-search",
      });

      expect(mockContext.helpers.request).toHaveBeenCalledWith({
        method: "GET",
        url: "http://ark-api:8000/v1/namespaces/default/tools/web-search",
        json: true,
      });
    });

    it("should use default values if fetch fails", async () => {
      const mockContext = createMockExecuteFunctions({
        inputData: [{ json: {} }],
        parameters: {
          selectionMode: "select",
          tool: "web-search",
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

      // If fetch fails, web-search is recognized as builtin
      expect(result[0][0].json).toMatchObject({
        name: "web-search",
        type: "builtin",
        toolName: "web-search",
      });
    });

    it("should determine tool type for builtin tools", async () => {
      const mockContext = createMockExecuteFunctions({
        inputData: [{ json: {} }],
        parameters: {
          selectionMode: "select",
          tool: "code-interpreter",
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

      expect(result[0][0].json.type).toBe("builtin");
    });

    it("should determine tool type for custom tools", async () => {
      const mockContext = createMockExecuteFunctions({
        inputData: [{ json: {} }],
        parameters: {
          selectionMode: "select",
          tool: "custom-tool",
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

      expect(result[0][0].json.type).toBe("custom");
    });

    it("should process multiple input items", async () => {
      const mockContext = createMockExecuteFunctions({
        inputData: [{ json: {} }, { json: {} }],
        parameters: {
          selectionMode: "select",
          tool: "web-search",
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
              builtin: true,
              description: "Search the web",
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
          selectionMode: "select",
          tool: "web-search",
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
              builtin: true,
            },
          }),
        },
      });

      const result = await node.execute.call(mockContext);

      expect(result[0][0].pairedItem).toEqual({ item: 0 });
    });

    it("should handle all builtin tool names", async () => {
      const builtinTools = ["web-search", "code-interpreter", "calculator"];

      for (const toolName of builtinTools) {
        const mockContext = createMockExecuteFunctions({
          inputData: [{ json: {} }],
          parameters: {
            selectionMode: "select",
            tool: toolName,
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

        expect(result[0][0].json.type).toBe("builtin");
        expect(result[0][0].json.name).toBe(toolName);
      }
    });
  });
});
