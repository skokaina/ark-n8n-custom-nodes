import { IExecuteFunctions } from "n8n-workflow";

/**
 * Build the Authorization header based on the configured auth scheme.
 * Returns undefined if authScheme is "none" or not set.
 */
export function getAuthHeader(credentials: {
  authScheme?: string;
  apiKey?: string;
  bearerToken?: string;
}): string | undefined {
  const scheme = credentials.authScheme || "none";

  if (scheme === "basic" && credentials.apiKey) {
    return `Basic ${Buffer.from(credentials.apiKey).toString("base64")}`;
  }

  if (scheme === "bearer" && credentials.bearerToken) {
    return `Bearer ${credentials.bearerToken}`;
  }

  return undefined;
}

/**
 * Sanitize a string to be a valid Kubernetes label value.
 * Strips leading/trailing characters that are not alphanumeric.
 * Enforces the 63-character max length limit.
 * Regex rule: (([A-Za-z0-9][-A-Za-z0-9_.]*)?[A-Za-z0-9])?
 */
export function sanitizeK8sLabel(value: string): string {
  return value
    .replace(/^[^A-Za-z0-9]+/, "")
    .replace(/[^A-Za-z0-9]+$/, "")
    .slice(0, 63);
}

/**
 * Get or generate session ID for conversation continuity
 */
export function getSessionId(
  context: IExecuteFunctions,
  itemIndex: number,
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

  // Strip leading/trailing chars that violate Kubernetes label rules
  return sanitizeK8sLabel(sessionId.trim());
}

/**
 * Extract model reference from connected model node
 */
export async function extractModelRef(
  context: IExecuteFunctions,
  itemIndex: number,
): Promise<{ name: string; namespace: string } | null> {
  try {
    // Attempt to get connected language model node data
    const connectedModel = await context.getInputConnectionData(
      "ai_languageModel",
      itemIndex,
    );

    // Extract model information from connected node
    return extractModelFromData(connectedModel);
  } catch (error) {
    return null;
  }
}

function extractModelFromData(
  modelData: any,
): { name: string; namespace: string } | null {
  if (!modelData) return null;

  // Try to extract model name from various possible fields
  const modelName =
    modelData.model || modelData.modelName || modelData.name || "default";

  return {
    name: modelName,
    namespace: modelData.namespace || "default",
  };
}

/**
 * Extract tools configuration from connected tool nodes
 */
export async function extractToolsConfig(
  context: IExecuteFunctions,
  itemIndex: number,
): Promise<Array<{ type: string; name: string }> | null> {
  try {
    // Attempt to get connected tool nodes data
    const connectedTools = await context.getInputConnectionData(
      "ai_tool",
      itemIndex,
    );

    if (!connectedTools) {
      return null;
    }

    // Handle both single tool and array of tools
    const toolsArray = Array.isArray(connectedTools)
      ? connectedTools
      : [connectedTools];

    // Filter out tools that are not valid
    const validTools = toolsArray.filter((tool: any) => tool && tool.name);

    const tools = validTools.map((tool: any) => {
      // Extract tool information from ArkTool supplyData response
      const toolName = tool.name || tool.toolName || "unknown";

      // Use the tool type from the ArkTool node's supplyData function
      // This comes from either the ARK API response or user manual input
      const toolType = tool.type || "custom";

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
  itemIndex: number,
): Promise<{ name: string; namespace: string } | null> {
  try {
    const connectedMemory = await context.getInputConnectionData(
      "ai_memory",
      itemIndex,
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
  },
): Promise<void> {
  const credentials = await context.getCredentials("arkApi");

  const putBody: any = {};

  if (config.modelRef) {
    putBody.modelRef = config.modelRef;
  }

  if (config.tools && config.tools.length > 0) {
    putBody.tools = config.tools;
  }

  // Only proceed if we have something to update
  if (Object.keys(putBody).length === 0) {
    return;
  }

  const requestOptions: any = {
    method: "PUT",
    url: `${baseUrl}/v1/agents/${agentName}`,
    headers: {
      "Content-Type": "application/json",
    },
    body: putBody,
    json: true,
  };

  const authHeader = getAuthHeader(credentials as any);
  if (authHeader) {
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
  querySpec: any,
): Promise<void> {
  const credentials = await context.getCredentials("arkApi");

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

  const authHeader = getAuthHeader(credentials as any);
  if (authHeader) {
    requestOptions.headers.Authorization = authHeader;
  }

  await context.helpers.request(requestOptions);
}

/**
 * Extract the response content from a query result.
 * ARK API returns a single response per query (not an array).
 * Supports both legacy (responses array) and current (response string) formats.
 */
export function extractResponseContent(queryResult: any): string {
  // Current ARK API: single response object with content field
  if (queryResult.status?.response?.content) {
    return queryResult.status.response.content;
  }
  // Fallback: response as string (older format)
  if (typeof queryResult.status?.response === "string") {
    return queryResult.status.response;
  }
  // Legacy ARK API: responses array with first element
  if (Array.isArray(queryResult.status?.responses)) {
    return queryResult.status.responses[0]?.content || "";
  }
  return "";
}

/**
 * Poll query status until completion or timeout using exponential backoff.
 * Starts at 1s, doubles each attempt, capped at 10s per interval.
 */
export async function pollQueryStatus(
  context: IExecuteFunctions,
  baseUrl: string,
  namespace: string,
  queryName: string,
  maxAttempts: number = 60,
): Promise<any> {
  const credentials = await context.getCredentials("arkApi");

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

  const authHeader = getAuthHeader(credentials as any);
  if (authHeader) {
    requestOptions.headers.Authorization = authHeader;
  }

  while (attempts < maxAttempts) {
    // Exponential backoff: 1s, 2s, 4s, 8s, capped at 10s
    const delay = Math.min(1000 * Math.pow(2, attempts), 10000);
    await new Promise((resolve) => setTimeout(resolve, delay));

    const queryStatus = await context.helpers.request(requestOptions);

    if (queryStatus.status?.phase === "done") {
      response = queryStatus;
      break;
    } else if (queryStatus.status?.phase === "error") {
      throw new Error(
        `Query failed: ${extractResponseContent(queryStatus) || "Unknown error"}`,
      );
    }

    attempts++;
  }

  if (!response) {
    throw new Error(`Query timed out after ${maxAttempts} polling attempts`);
  }

  return response;
}
