import { ArkTool } from "../ArkTool.node";
import { createMockExecuteFunctions, createMockSupplyDataFunctions } from "../../../test-helpers/mocks";

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
        url: "http://ark-api:8000/v1/tools/web-search?namespace=default",
        json: true,
      });
    });

    it("should fetch and return custom tool details", async () => {
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
          request: jest.fn().mockResolvedValue({
            spec: {
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
        name: "custom-tool",
        type: "custom",
        description: "Search the web",
        toolName: "custom-tool",
      });

      expect(mockContext.helpers.request).toHaveBeenCalledWith({
        method: "GET",
        url: "http://ark-api:8000/v1/tools/custom-tool?namespace=default",
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
      expect(result.length).toEqual(0);
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

      expect(result.length).toEqual(0);
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

      expect(result.length).toEqual(0);
    });

    it("should process multiple input items", async () => {
      const mockContext = createMockExecuteFunctions({
        inputData: [{ json: {} }], { json: {} }],
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
          tool: "mcp-example",
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
              mcp: true,
            },
          }),
        },
      });

      const result = await node.execute.call(mockContext);

      expect(result[0][0].pairedItem).toEqual({ item: 0 });
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
  });

  describe("supplyData() Method", () => {
    it("should return tool data for select mode with builtin tool", async () => {
      const mockContext = createMockSupplyDataFunctions({
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
              description: "Search the web for information",
            },
          }),
        },
      });

      const result = await node.supplyData.call(mockContext, 0);

      expect(result.response).toMatchObject({
        name: "web-search",
        namespace: "default",
        type: "builtin",
        description: "Search the web for information",
      });

      expect(mockContext.helpers.request).toHaveBeenCalledWith({
        method: "GET",
        url: "http://ark-api:8000/v1/tools/web-search?namespace=default",
        json: true,
      });
    });

    it("should return tool data for select mode with MCP tool", async () => {
      const mockContext = createMockSupplyDataFunctions({
        parameters: {
          selectionMode: "select",
          tool: "mcp-example",
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
              mcp: true,
              description: "MCP server tool",
            },
          }),
        },
      });

      const result = await node.supplyData.call(mockContext, 0);

      expect(result.response).toMatchObject({
        name: "mcp-example",
        namespace: "default",
        type: "mcp",
        description: "MCP server tool",
      });
    });

    it("should return tool data for select mode with custom tool", async () => {
      const mockContext = createMockSupplyDataFunctions({
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
          request: jest.fn().mockResolvedValue({
            spec: {
              description: "Custom tool implementation",
            },
          }),
        },
      });

      const result = await node.supplyData.call(mockContext, 0);

      expect(result.response).toMatchObject({
        name: "custom-tool",
        namespace: "default",
        type: "custom",
        description: "Custom tool implementation",
      });
    });

    it("should return tool data for manual mode", async () => {
      const mockContext = createMockSupplyDataFunctions({
        parameters: {
          selectionMode: "manual",
          toolName: "manual-tool",
          toolType: "builtin",
        },
        credentials: {
          arkApi: {
            baseUrl: "http://ark-api:8000",
            namespace: "custom",
          },
        },
        helpers: {
          request: jest.fn().mockResolvedValue({
            spec: {
              builtin: true,
              description: "Manually specified tool",
            },
          }),
        },
      });

      const result = await node.supplyData.call(mockContext, 0);

      expect(result.response).toMatchObject({
        name: "manual-tool",
        namespace: "custom",
        type: "builtin",
        description: "Manually specified tool",
      });
    });

    it("should handle API errors gracefully for builtin tools", async () => {
      const mockContext = createMockSupplyDataFunctions({
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
          request: jest.fn().mockRejectedValue(new Error("API unavailable")),
        },
      });

      const result = await node.supplyData.call(mockContext, 0);

      // Should fallback to builtin type for known tools
      expect(result.response).toBeNull();
    });

    it("should handle API errors gracefully for unknown tools", async () => {
      const mockContext = createMockSupplyDataFunctions({
        parameters: {
          selectionMode: "select",
          tool: "unknown-tool",
        },
        credentials: {
          arkApi: {
            baseUrl: "http://ark-api:8000",
            namespace: "default",
          },
        },
        helpers: {
          request: jest.fn().mockRejectedValue(new Error("Tool not found")),
        },
      });

      const result = await node.supplyData.call(mockContext, 0);

      // Should fallback to custom type for unknown tools
      expect(result.response).toBeNull();
    });

    it("should handle different builtin tool names correctly", async () => {
      const builtinTools = ["web-search", "code-interpreter", "calculator"];
      
      for (const toolName of builtinTools) {
        const mockContext = createMockSupplyDataFunctions({
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

        const result = await node.supplyData.call(mockContext, 0);

        expect(result.response).toBeNull()
      }
    });

    it("should use custom namespace from credentials", async () => {
      const mockContext = createMockSupplyDataFunctions({
        parameters: {
          selectionMode: "select",
          tool: "test-tool",
        },
        credentials: {
          arkApi: {
            baseUrl: "http://ark-api:8000",
            namespace: "custom-namespace",
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

      const result = await node.supplyData.call(mockContext, 0);

      expect(result.response.namespace).toBe("custom-namespace");
      expect(mockContext.helpers.request).toHaveBeenCalledWith({
        method: "GET",
        url: "http://ark-api:8000/v1/tools/test-tool?namespace=custom-namespace",
        json: true,
      });
    });

    it("should default to 'default' namespace when not specified", async () => {
      const mockContext = createMockSupplyDataFunctions({
        parameters: {
          selectionMode: "select",
          tool: "test-tool",
        },
        credentials: {
          arkApi: {
            baseUrl: "http://ark-api:8000",
            // namespace not specified
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

      const result = await node.supplyData.call(mockContext, 0);

      expect(result.response.namespace).toBe("default");
      expect(mockContext.helpers.request).toHaveBeenCalledWith({
        method: "GET",
        url: "http://ark-api:8000/v1/tools/test-tool?namespace=default",
        json: true,
      });
    });
  });

});
