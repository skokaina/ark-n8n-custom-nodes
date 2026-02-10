import { ArkWorkflowTool } from "../ArkWorkflowTool.node";
import { createMockExecuteFunctions } from "../../../test-helpers/mocks";

describe("ArkWorkflowTool Node", () => {
  let node: ArkWorkflowTool;

  beforeEach(() => {
    node = new ArkWorkflowTool();
    jest.clearAllMocks();
  });

  describe("Node Properties", () => {
    it("should have correct basic properties", () => {
      expect(node.description.displayName).toBe("ARK Workflow Tool");
      expect(node.description.name).toBe("arkWorkflowTool");
      expect(node.description.group).toContain("transform");
      expect(node.description.version).toBe(1);
    });

    it("should have correct input/output configuration", () => {
      expect(node.description.inputs).toEqual(["main"]);
      expect(node.description.outputs).toEqual([
        {
          displayName: "Tool",
          type: "ai_tool",
        },
      ]);
    });

    it("should require n8nApi credentials", () => {
      const credentials = node.description.credentials;
      expect(credentials).toBeDefined();
      expect(credentials?.length).toBe(1);
      expect(credentials?.[0].name).toBe("n8nApi");
      expect(credentials?.[0].required).toBe(true);
    });

    it("should have workflow selection property", () => {
      const workflowProperty = node.description.properties?.find(
        (p) => p.name === "workflowId",
      );

      expect(workflowProperty).toBeDefined();
      expect(workflowProperty?.type).toBe("options");
      expect(workflowProperty?.required).toBe(true);
    });

    it("should have wait for completion property", () => {
      const waitProperty = node.description.properties?.find(
        (p) => p.name === "wait",
      );

      expect(waitProperty).toBeDefined();
      expect(waitProperty?.type).toBe("boolean");
      expect(waitProperty?.default).toBe(true);
    });

    it("should have pass input data property", () => {
      const passInputDataProperty = node.description.properties?.find(
        (p) => p.name === "passInputData",
      );

      expect(passInputDataProperty).toBeDefined();
      expect(passInputDataProperty?.type).toBe("boolean");
      expect(passInputDataProperty?.default).toBe(true);
    });
  });

  describe("loadOptions Methods", () => {
    it("should load workflows from n8n API", async () => {
      const mockContext = createMockExecuteFunctions({
        credentials: {
          n8nApi: {
            baseUrl: "http://n8n:5678",
            apiKey: "test-api-key",
          },
        },
        helpers: {
          request: jest.fn().mockResolvedValue({
            data: [
              {
                id: "workflow-1",
                name: "Test Workflow 1",
                tags: ["automation", "test"],
              },
              {
                id: "workflow-2",
                name: "Test Workflow 2",
                tags: [],
              },
            ],
          }),
        },
      });

      const workflows = await node.methods.loadOptions.getWorkflows.call(
        mockContext,
      );

      expect(workflows).toHaveLength(2);
      expect(workflows[0]).toEqual({
        name: "Test Workflow 1",
        value: "workflow-1",
        description: "automation, test",
      });
      expect(workflows[1]).toEqual({
        name: "Test Workflow 2",
        value: "workflow-2",
        description: "",
      });
      expect(mockContext.helpers.request).toHaveBeenCalledWith({
        method: "GET",
        url: "http://n8n:5678/api/v1/workflows",
        headers: {
          "X-N8N-API-KEY": "test-api-key",
        },
        json: true,
      });
    });

    it("should handle API errors when loading workflows", async () => {
      const mockContext = createMockExecuteFunctions({
        credentials: {
          n8nApi: {
            baseUrl: "http://n8n:5678",
            apiKey: "test-api-key",
          },
        },
        helpers: {
          request: jest.fn().mockRejectedValue(new Error("API Error")),
        },
      });

      await expect(
        node.methods.loadOptions.getWorkflows.call(mockContext),
      ).rejects.toThrow("Failed to load workflows: API Error");
    });
  });

  describe("execute() Method", () => {
    it("should execute workflow with input data", async () => {
      const mockContext = createMockExecuteFunctions({
        inputData: [{ json: { userId: "123", action: "process" } }],
        parameters: {
          workflowId: "workflow-1",
          wait: true,
          passInputData: true,
          additionalParameters: "{}",
          timeout: 60,
        },
        credentials: {
          n8nApi: {
            baseUrl: "http://n8n:5678",
            apiKey: "test-api-key",
          },
        },
        helpers: {
          request: jest.fn().mockResolvedValue({
            data: {
              executionId: "exec-123",
              finished: true,
              data: {
                resultData: {
                  runData: {
                    "Final Node": [
                      {
                        data: {
                          main: [
                            [
                              { json: { result: "success", value: 42 } },
                              { json: { result: "success", value: 43 } },
                            ],
                          ],
                        },
                      },
                    ],
                  },
                },
              },
            },
          }),
        },
      });

      const result = await node.execute.call(mockContext);

      expect(result).toHaveLength(1);
      expect(result[0]).toHaveLength(1);
      expect(result[0][0].json).toMatchObject({
        name: "workflow_workflow-1",
        type: "n8n_workflow",
        workflowId: "workflow-1",
        toolName: "workflow_workflow-1",
        executionId: "exec-123",
        status: "completed",
      });
      expect(result[0][0].json.result).toEqual([
        { result: "success", value: 42 },
        { result: "success", value: 43 },
      ]);

      expect(mockContext.helpers.request).toHaveBeenCalledWith({
        method: "POST",
        url: "http://n8n:5678/api/v1/workflows/workflow-1/execute",
        headers: {
          "X-N8N-API-KEY": "test-api-key",
          "Content-Type": "application/json",
        },
        body: {
          input: { userId: "123", action: "process" },
        },
        json: true,
        timeout: 60000,
      });
    });

    it("should execute workflow without input data", async () => {
      const mockContext = createMockExecuteFunctions({
        inputData: [{ json: { userId: "123" } }],
        parameters: {
          workflowId: "workflow-1",
          wait: true,
          passInputData: false,
          additionalParameters: '{"param1": "value1"}',
          timeout: 60,
        },
        credentials: {
          n8nApi: {
            baseUrl: "http://n8n:5678",
            apiKey: "test-api-key",
          },
        },
        helpers: {
          request: jest.fn().mockResolvedValue({
            data: {
              executionId: "exec-123",
              finished: true,
              data: {
                resultData: {
                  runData: {},
                },
              },
            },
          }),
        },
      });

      await node.execute.call(mockContext);

      expect(mockContext.helpers.request).toHaveBeenCalledWith(
        expect.objectContaining({
          body: {
            param1: "value1",
          },
        }),
      );
    });

    it("should handle async workflow execution", async () => {
      const mockContext = createMockExecuteFunctions({
        inputData: [{ json: { test: "data" } }],
        parameters: {
          workflowId: "workflow-1",
          wait: false,
          passInputData: true,
          additionalParameters: "{}",
          timeout: 60,
        },
        credentials: {
          n8nApi: {
            baseUrl: "http://n8n:5678",
            apiKey: "test-api-key",
          },
        },
        helpers: {
          request: jest.fn().mockResolvedValue({
            executionId: "exec-123",
          }),
        },
      });

      const result = await node.execute.call(mockContext);

      expect(result[0][0].json).toMatchObject({
        name: "workflow_workflow-1",
        type: "n8n_workflow",
        workflowId: "workflow-1",
        toolName: "workflow_workflow-1",
        executionId: "exec-123",
        status: "pending",
      });
      expect(result[0][0].json.result).toEqual({
        message: "Workflow execution started asynchronously",
      });
    });

    it("should handle multiple input items", async () => {
      const mockContext = createMockExecuteFunctions({
        inputData: [{ json: { item: 1 } }, { json: { item: 2 } }],
        parameters: {
          workflowId: "workflow-1",
          wait: true,
          passInputData: true,
          additionalParameters: "{}",
          timeout: 60,
        },
        credentials: {
          n8nApi: {
            baseUrl: "http://n8n:5678",
            apiKey: "test-api-key",
          },
        },
        helpers: {
          request: jest.fn().mockResolvedValue({
            data: {
              executionId: "exec-123",
              finished: true,
              data: { resultData: { runData: {} } },
            },
          }),
        },
      });

      const result = await node.execute.call(mockContext);

      expect(result[0]).toHaveLength(2);
      expect(mockContext.helpers.request).toHaveBeenCalledTimes(2);
    });

    it("should handle invalid JSON in additional parameters", async () => {
      const mockContext = createMockExecuteFunctions({
        inputData: [{ json: {} }],
        parameters: {
          workflowId: "workflow-1",
          wait: true,
          passInputData: false,
          additionalParameters: "{invalid json}",
          timeout: 60,
        },
        credentials: {
          n8nApi: {
            baseUrl: "http://n8n:5678",
            apiKey: "test-api-key",
          },
        },
      });

      await expect(node.execute.call(mockContext)).rejects.toThrow(
        "Invalid JSON in Additional Parameters",
      );
    });

    it("should handle workflow execution errors", async () => {
      const mockContext = createMockExecuteFunctions({
        inputData: [{ json: {} }],
        parameters: {
          workflowId: "workflow-1",
          wait: true,
          passInputData: true,
          additionalParameters: "{}",
          timeout: 60,
        },
        credentials: {
          n8nApi: {
            baseUrl: "http://n8n:5678",
            apiKey: "test-api-key",
          },
        },
        helpers: {
          request: jest
            .fn()
            .mockRejectedValue(new Error("Workflow not found")),
        },
      });

      await expect(node.execute.call(mockContext)).rejects.toThrow(
        "Workflow execution failed: Workflow not found",
      );
    });

    it("should continue on fail when enabled", async () => {
      const mockContext = createMockExecuteFunctions({
        inputData: [{ json: {} }],
        parameters: {
          workflowId: "workflow-1",
          wait: true,
          passInputData: true,
          additionalParameters: "{}",
          timeout: 60,
        },
        credentials: {
          n8nApi: {
            baseUrl: "http://n8n:5678",
            apiKey: "test-api-key",
          },
        },
        helpers: {
          request: jest
            .fn()
            .mockRejectedValue(new Error("Execution failed")),
        },
      });

      // Mock continueOnFail to return true
      mockContext.continueOnFail = jest.fn().mockReturnValue(true);

      const result = await node.execute.call(mockContext);

      expect(result[0][0].json).toMatchObject({
        name: "workflow_workflow-1",
        type: "n8n_workflow",
        workflowId: "workflow-1",
        toolName: "workflow_workflow-1",
        error: "Execution failed",
        status: "error",
      });
    });
  });

  describe("supplyData() Method", () => {
    it("should supply tool data with workflow information", async () => {
      const mockContext = createMockExecuteFunctions({
        parameters: {
          workflowId: "workflow-123",
        },
        credentials: {
          n8nApi: {
            baseUrl: "http://n8n:5678",
            apiKey: "test-api-key",
          },
        },
        helpers: {
          request: jest.fn().mockResolvedValue({
            id: "workflow-123",
            name: "Data Processing Pipeline",
            meta: {
              description: "Processes and transforms data",
            },
          }),
        },
      });

      const result = await node.supplyData.call(mockContext, 0);

      expect(result.response).toEqual({
        name: "workflow_workflow-123",
        type: "n8n_workflow",
        description: "Processes and transforms data",
        workflowId: "workflow-123",
        workflowName: "Data Processing Pipeline",
      });

      expect(mockContext.helpers.request).toHaveBeenCalledWith({
        method: "GET",
        url: "http://n8n:5678/api/v1/workflows/workflow-123",
        headers: {
          "X-N8N-API-KEY": "test-api-key",
        },
        json: true,
      });
    });

    it("should handle errors when fetching workflow details", async () => {
      const mockContext = createMockExecuteFunctions({
        parameters: {
          workflowId: "workflow-456",
        },
        credentials: {
          n8nApi: {
            baseUrl: "http://n8n:5678",
            apiKey: "test-api-key",
          },
        },
        helpers: {
          request: jest.fn().mockRejectedValue(new Error("Workflow not found")),
        },
      });

      const result = await node.supplyData.call(mockContext, 0);

      expect(result.response).toEqual({
        name: "workflow_workflow-456",
        type: "n8n_workflow",
        description: "Execute workflow: workflow-456",
        workflowId: "workflow-456",
        workflowName: "workflow-456",
      });
    });
  });
});
