import { ArkModelSelector } from "../ArkModelSelector.node";
import { createMockExecuteFunctions } from "../../../test-helpers/mocks";

describe("ArkModelSelector Node", () => {
  let node: ArkModelSelector;

  beforeEach(() => {
    node = new ArkModelSelector();
    jest.clearAllMocks();
  });

  describe("Node Properties", () => {
    it("should have correct basic properties", () => {
      expect(node.description.displayName).toBe("ARK Model Selector");
      expect(node.description.name).toBe("arkModelSelector");
      expect(node.description.group).toContain("transform");
      expect(node.description.version).toBe(1);
    });

    it("should have ai_languageModel output type", () => {
      expect(node.description.outputs).toEqual([
        {
          displayName: "Model",
          type: "ai_languageModel",
        },
      ]);
    });

    it("should have model property", () => {
      const modelProperty = node.description.properties?.find(
        (p) => p.name === "model"
      );

      expect(modelProperty).toBeDefined();
      expect(modelProperty?.type).toBe("options");
      expect(modelProperty?.required).toBe(true);
    });
  });

  describe("loadOptions Methods", () => {
    it("should load models from namespaced API", async () => {
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
                metadata: { name: "gpt-4" },
                spec: { provider: "openai" },
              },
              {
                metadata: { name: "claude-3" },
                spec: { provider: "anthropic" },
              },
            ],
          }),
        },
      });

      const models = await node.methods.loadOptions.getModels.call(mockContext);

      expect(models).toHaveLength(2);
      expect(models[0]).toEqual({
        name: "gpt-4 (openai: undefined)",
        value: "gpt-4",
      });
      expect(models[1]).toEqual({
        name: "claude-3 (anthropic: undefined)",
        value: "claude-3",
      });
      expect(mockContext.helpers.request).toHaveBeenCalledWith({
        method: "GET",
        url: "http://ark-api:8000/v1/namespaces/default/models",
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
                  name: "gpt-4",
                  spec: { provider: "openai" },
                },
              ],
            }),
        },
      });

      const models = await node.methods.loadOptions.getModels.call(mockContext);

      expect(models).toHaveLength(1);
      expect(models[0]).toEqual({
        name: "gpt-4 (openai: undefined)",
        value: "gpt-4",
      });

      // Should have tried both endpoints
      expect(mockContext.helpers.request).toHaveBeenCalledTimes(2);
      expect(mockContext.helpers.request).toHaveBeenCalledWith({
        method: "GET",
        url: "http://ark-api:8000/v1/models",
        json: true,
      });
    });

    it("should return default models when API returns empty list", async () => {
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

      const models = await node.methods.loadOptions.getModels.call(mockContext);

      // When empty list is returned, it throws and falls back to defaults
      expect(models).toHaveLength(2);
      expect(models).toEqual([
        { name: "GPT-4", value: "gpt-4" },
        { name: "Default", value: "default" },
      ]);
    });

    it("should return default models if both endpoints fail", async () => {
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

      const models = await node.methods.loadOptions.getModels.call(mockContext);

      // Falls back to default models
      expect(models).toHaveLength(2);
      expect(models).toEqual([
        { name: "GPT-4", value: "gpt-4" },
        { name: "Default", value: "default" },
      ]);
    });
  });

  describe("execute() Method", () => {
    it("should fetch and return model details", async () => {
      const mockContext = createMockExecuteFunctions({
        inputData: [{ json: {} }],
        parameters: {
          model: "gpt-4",
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
              provider: "openai",
              endpoint: "https://api.openai.com/v1",
              modelName: "gpt-4",
            },
          }),
        },
      });

      const result = await node.execute.call(mockContext);

      expect(result).toHaveLength(1);
      expect(result[0]).toHaveLength(1);
      expect(result[0][0].json).toMatchObject({
        name: "gpt-4",
        namespace: "default",
        provider: "openai",
        modelName: "gpt-4",
        model: "gpt-4",
      });

      expect(mockContext.helpers.request).toHaveBeenCalledWith({
        method: "GET",
        url: "http://ark-api:8000/v1/namespaces/default/models/gpt-4",
        json: true,
      });
    });

    it("should use default values if fetch fails", async () => {
      const mockContext = createMockExecuteFunctions({
        inputData: [{ json: {} }],
        parameters: {
          model: "gpt-4",
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
        name: "gpt-4",
        namespace: "default",
        provider: "openai", // Default value from implementation
        temperature: 0.7, // Default value
      });
    });

    it("should process multiple input items", async () => {
      const mockContext = createMockExecuteFunctions({
        inputData: [{ json: {} }, { json: {} }],
        parameters: {
          model: "gpt-4",
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
              provider: "openai",
              modelName: "gpt-4",
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
          model: "gpt-4",
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
              provider: "openai",
              modelName: "gpt-4",
            },
          }),
        },
      });

      const result = await node.execute.call(mockContext);

      expect(result[0][0].pairedItem).toEqual({ item: 0 });
    });
  });
});
