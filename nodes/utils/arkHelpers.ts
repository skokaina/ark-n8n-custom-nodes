import { IExecuteFunctions } from "n8n-workflow";

/**
 * Get or generate session ID for conversation continuity
 */
export function getSessionId(
  context: IExecuteFunctions,
  itemIndex: number
): string {
  // Get user-provided session ID (supports expressions)
  let sessionId = context.getNodeParameter("sessionId", itemIndex) as string;

  // If empty or whitespace, auto-generate
  if (!sessionId || sessionId.trim() === "") {
    const workflow = context.getWorkflow();
    const executionId = context.getExecutionId();
    const timestamp = Date.now();

    // Format: n8n-{workflowId}-{executionId}-{timestamp}
    sessionId = `n8n-${workflow.id}-${executionId}-${timestamp}`;
  }

  return sessionId.trim();
}

/**
 * Extract model reference from connected model node
 */
export async function extractModelRef(
  context: IExecuteFunctions,
  itemIndex: number
): Promise<{ name: string; namespace: string } | null> {
  try {
    // Attempt to get connected language model node data
    // Note: This is a placeholder - n8n's getInputConnectionData may work differently
    // We'll need to test and adjust based on actual n8n API
    const connectedModel = await context.getInputConnectionData(
      "ai_languageModel",
      itemIndex
    );

    if (!connectedModel) {
      return null;
    }

    // Extract model information from connected node
    // The structure depends on what n8n model nodes provide
    // This is a best-guess implementation that may need adjustment
    const modelData = connectedModel as any;

    // Try to extract model name from various possible fields
    const modelName =
      modelData.model ||
      modelData.modelName ||
      modelData.name ||
      "default";

    return {
      name: modelName,
      namespace: modelData.namespace || "default",
    };
  } catch (error) {
    // No model connected or error retrieving
    return null;
  }
}

/**
 * Extract tools configuration from connected tool nodes
 */
export async function extractToolsConfig(
  context: IExecuteFunctions,
  itemIndex: number
): Promise<Array<{ type: string; name: string }> | null> {
  try {
    // Attempt to get connected tool nodes data
    const connectedTools = await context.getInputConnectionData(
      "ai_tool",
      itemIndex
    );

    if (!connectedTools) {
      return null;
    }

    // Handle both single tool and array of tools
    const toolsArray = Array.isArray(connectedTools)
      ? connectedTools
      : [connectedTools];

    const tools = toolsArray.map((tool: any) => {
      // Extract tool information
      // This structure depends on what n8n tool nodes provide
      const toolName = tool.name || tool.toolName || "unknown";

      // Determine if it's a built-in ARK tool or custom
      // You may need to maintain a list of known ARK built-in tools
      const builtinTools = [
        "web-search",
        "code-interpreter",
        "calculator",
      ];
      const toolType = builtinTools.includes(toolName) ? "builtin" : "custom";

      return {
        type: toolType,
        name: toolName,
      };
    });

    return tools.length > 0 ? tools : null;
  } catch (error) {
    // No tools connected or error retrieving
    return null;
  }
}

/**
 * Extract memory reference from connected memory node
 * (Currently not used - memory is selected via dropdown)
 */
export async function extractMemoryRef(
  context: IExecuteFunctions,
  itemIndex: number
): Promise<{ name: string; namespace: string } | null> {
  try {
    const connectedMemory = await context.getInputConnectionData(
      "ai_memory",
      itemIndex
    );

    if (!connectedMemory) {
      return null;
    }

    const memoryData = connectedMemory as any;

    return {
      name: memoryData.name || memoryData.memoryName || "default",
      namespace: memoryData.namespace || "default",
    };
  } catch (error) {
    return null;
  }
}

/**
 * Update ARK agent configuration via PATCH API
 */
export async function patchAgent(
  context: IExecuteFunctions,
  baseUrl: string,
  namespace: string,
  agentName: string,
  config: {
    modelRef?: { name: string; namespace: string } | null;
    tools?: Array<{ type: string; name: string }> | null;
  }
): Promise<void> {
  const credentials = await context.getCredentials("arkApi");
  const apiKey = credentials.apiKey as string | undefined;

  const patchBody: any = { spec: {} };

  if (config.modelRef) {
    patchBody.spec.modelRef = config.modelRef;
  }

  if (config.tools && config.tools.length > 0) {
    patchBody.spec.tools = config.tools;
  }

  // Only proceed if we have something to patch
  if (Object.keys(patchBody.spec).length === 0) {
    return;
  }

  const requestOptions: any = {
    method: "PATCH",
    url: `${baseUrl}/v1/namespaces/${namespace}/agents/${agentName}`,
    headers: {
      "Content-Type": "application/json",
    },
    body: patchBody,
    json: true,
  };

  // Add authentication if API key is provided
  if (apiKey) {
    // Assuming API key format: "pk-ark-xxx:sk-ark-xxx"
    const authHeader = `Basic ${Buffer.from(apiKey).toString("base64")}`;
    requestOptions.headers.Authorization = authHeader;
  }

  await context.helpers.request(requestOptions);
}

/**
 * Create and execute a query via POST API
 */
export async function postQuery(
  context: IExecuteFunctions,
  baseUrl: string,
  namespace: string,
  queryName: string,
  querySpec: any
): Promise<void> {
  const credentials = await context.getCredentials("arkApi");
  const apiKey = credentials.apiKey as string | undefined;

  // ARK API uses flat structure for query body, not metadata + spec
  const queryBody: any = {
    name: queryName,
    ...querySpec,
  };

  const requestOptions: any = {
    method: "POST",
    url: `${baseUrl}/v1/queries`,
    headers: {
      "Content-Type": "application/json",
    },
    body: queryBody,
    json: true,
  };

  // Add authentication if API key is provided
  if (apiKey) {
    const authHeader = `Basic ${Buffer.from(apiKey).toString("base64")}`;
    requestOptions.headers.Authorization = authHeader;
  }

  await context.helpers.request(requestOptions);
}

/**
 * Poll query status until completion or timeout
 */
export async function pollQueryStatus(
  context: IExecuteFunctions,
  baseUrl: string,
  namespace: string,
  queryName: string,
  maxAttempts: number = 60
): Promise<any> {
  const credentials = await context.getCredentials("arkApi");
  const apiKey = credentials.apiKey as string | undefined;

  let attempts = 0;
  let response: any = null;

  const requestOptions: any = {
    method: "GET",
    url: `${baseUrl}/v1/queries/${queryName}`,
    headers: {
      "Content-Type": "application/json",
    },
    json: true,
  };

  // Add authentication if API key is provided
  if (apiKey) {
    const authHeader = `Basic ${Buffer.from(apiKey).toString("base64")}`;
    requestOptions.headers.Authorization = authHeader;
  }

  while (attempts < maxAttempts) {
    // Wait 5 seconds between attempts
    await new Promise((resolve) => setTimeout(resolve, 5000));

    const queryStatus = await context.helpers.request(requestOptions);

    if (queryStatus.status?.phase === "done") {
      response = queryStatus;
      break;
    } else if (queryStatus.status?.phase === "error") {
      throw new Error(
        `Query failed: ${queryStatus.status?.responses?.[0]?.content || "Unknown error"}`
      );
    }

    attempts++;
  }

  if (!response) {
    throw new Error(`Query timed out after ${maxAttempts * 5} seconds`);
  }

  return response;
}
