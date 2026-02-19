"""
n8n MCP Server - Exposes n8n AI tools to ARK agents via MCP protocol

This server discovers n8n AI tools dynamically and exposes them using FastMCP,
allowing ARK agents to use n8n tools seamlessly.
"""

import json
import os
from pathlib import Path
from typing import Annotated, Any, Dict

import httpx
from fastmcp import FastMCP
from starlette.responses import JSONResponse

# Configuration
TOOLS_SHARED_PATH = os.getenv("TOOLS_SHARED_PATH", "/tmp/tools")
N8N_INTERNAL_URL = os.getenv("N8N_INTERNAL_URL", "http://localhost:5678")

# N8N_API_KEY is optional but recommended for production
N8N_API_KEY = os.getenv("N8N_API_KEY", "")

if not N8N_API_KEY:
    print("\n" + "=" * 60)
    print("⚠️  WARNING: N8N_API_KEY not configured!")
    print("   n8n tool calls will fail with 401 Unauthorized")
    print("   Set N8N_API_KEY environment variable to enable authentication")
    print("   See docs/N8N_API_KEY_SETUP.md for setup instructions")
    print("=" * 60 + "\n")
else:
    print(f"✅ N8N_API_KEY configured")

# Initialize MCP server
mcp = FastMCP("n8n-tools 🔧")


def load_n8n_tools() -> list[dict[str, Any]]:
    """
    Load n8n tool metadata from shared volume.

    n8n writes tool metadata to: /tmp/tools/tools.json

    Format:
    {
      "tools": [
        {
          "name": "calculator",
          "description": "Perform mathematical calculations",
          "schema": {...},
          "workflowId": "workflow-123",
          "nodeId": "node-456"
        }
      ],
      "lastUpdated": "2026-02-10T12:00:00Z"
    }
    """
    tools_file = Path(TOOLS_SHARED_PATH) / "tools.json"

    if not tools_file.exists():
        print(f"⚠️  Tools file not found: {tools_file}")
        print("   Using demo tools instead (calculator, word_count)")
        return get_demo_tools()

    try:
        with open(tools_file) as f:
            data = json.load(f)
            tools = data.get("tools", [])
            print(f"✅ Loaded {len(tools)} tools from {tools_file}")
            return tools
    except Exception as e:
        print(f"❌ Error loading tools: {e}")
        return get_demo_tools()


def get_demo_tools() -> list[dict[str, Any]]:
    """Return demo tools for testing when n8n tools aren't available."""
    return [
        {
            "name": "calculator",
            "description": "Perform mathematical calculations",
            "schema": {
                "type": "object",
                "properties": {
                    "expression": {
                        "type": "string",
                        "description": "Mathematical expression to evaluate",
                    }
                },
                "required": ["expression"],
            },
        },
        {
            "name": "word_count",
            "description": "Count words in text",
            "schema": {
                "type": "object",
                "properties": {
                    "text": {
                        "type": "string",
                        "description": "Text to analyze",
                    }
                },
                "required": ["text"],
            },
        },
    ]


# Global HTTP client for tool execution
http_client = httpx.AsyncClient(timeout=30.0)


async def execute_n8n_tool(tool_name: str, tool_config: Dict[str, Any], params: Dict[str, Any]) -> Any:
    """
    Execute n8n tool via webhook endpoint.

    Args:
        tool_name: Name of the tool to execute
        tool_config: Tool configuration with webhookPath or executionEndpoint
        params: Tool parameters as dictionary

    Returns:
        Tool execution result
    """
    # Build endpoint URL from environment variable + webhook path
    # Support both new format (webhookPath) and legacy format (executionEndpoint)
    webhook_path = tool_config.get("webhookPath")
    if webhook_path:
        # New format: Use N8N_INTERNAL_URL from env + webhookPath from config
        endpoint = f"{N8N_INTERNAL_URL}{webhook_path}"
    else:
        # Legacy format: Use full executionEndpoint (for backwards compatibility)
        endpoint = tool_config.get("executionEndpoint")
        if not endpoint:
            # Fallback: construct default webhook path
            endpoint = f"{N8N_INTERNAL_URL}/webhook/tool/{tool_name}"

    print(f"🔧 Executing tool '{tool_name}' via {endpoint}")
    print(f"   Base URL: {N8N_INTERNAL_URL}")

    # Build headers with optional authentication
    headers = {"Content-Type": "application/json"}
    if N8N_API_KEY:
        headers["X-N8N-API-KEY"] = N8N_API_KEY
        print(f"   Authentication: ✅ API Key")
    else:
        print(f"   Authentication: ⚠️  None (tool calls may fail)")

    print(f"   Parameters: {params}")

    try:
        response = await http_client.post(
            endpoint,
            json=params,
            headers=headers
        )
        response.raise_for_status()
        result = response.json()
        print(f"✅ Tool '{tool_name}' executed successfully")

        # If result is a dict with 'result' key, return just the result for cleaner output
        if isinstance(result, dict) and "result" in result and "success" in result:
            return str(result["result"]) if result.get("success") else result
        return result
    except httpx.HTTPStatusError as e:
        error_msg = f"Tool execution failed: {e.response.status_code} - {e.response.text}"
        print(f"❌ {error_msg}")
        return {"error": error_msg, "success": False}
    except Exception as e:
        error_msg = f"Tool execution error: {str(e)}"
        print(f"❌ {error_msg}")
        return {"error": error_msg, "success": False}


def create_tool_function(tool_config: Dict[str, Any]):
    """
    Create a tool function dynamically from tool configuration.

    FastMCP requires explicit parameter definitions, so we create a function
    that takes a single 'params' argument containing all tool parameters.

    Args:
        tool_config: Tool metadata including name, description, schema

    Returns:
        Async function that executes the tool
    """
    tool_name = tool_config["name"]
    tool_description = tool_config["description"]

    # Get schema properties for parameter description
    schema = tool_config.get("schema", {})
    properties = schema.get("properties", {})

    # Create a description that includes parameter info
    param_desc = "Parameters as JSON object with fields: " + ", ".join(
        f"{k} ({v.get('type', 'any')}): {v.get('description', 'No description')}"
        for k, v in properties.items()
    ) if properties else "No parameters required"

    async def tool_func(params: Annotated[str, param_desc]) -> str:
        """Dynamically created tool function."""
        # Parse params string as JSON
        try:
            params_dict = json.loads(params) if isinstance(params, str) else params
        except json.JSONDecodeError:
            # If not JSON, treat as single parameter for tools with one param
            if len(properties) == 1:
                param_name = list(properties.keys())[0]
                params_dict = {param_name: params}
            else:
                return json.dumps({"error": "Invalid JSON parameters", "success": False})

        result = await execute_n8n_tool(tool_name, tool_config, params_dict)

        # Return as JSON string for MCP
        if isinstance(result, (dict, list)):
            return json.dumps(result)
        return str(result)

    # Set function metadata for MCP
    tool_func.__name__ = tool_name
    tool_func.__doc__ = f"{tool_description}\n\n{param_desc}"

    return tool_func


def register_n8n_tools():
    """
    Register n8n tools dynamically with FastMCP.

    Reads tools from n8n_tools list and registers each as an MCP tool.
    """
    if not n8n_tools:
        print("⚠️  No tools to register")
        return

    for tool_config in n8n_tools:
        tool_name = tool_config.get("name")
        if not tool_name:
            print(f"⚠️  Skipping tool with no name: {tool_config}")
            continue

        try:
            # Create and register tool function
            tool_func = create_tool_function(tool_config)
            mcp.tool(tool_func)
            print(f"✅ Registered tool: {tool_name}")
        except Exception as e:
            print(f"❌ Failed to register tool '{tool_name}': {e}")


# Load tools on startup
n8n_tools = load_n8n_tools()
print(f"\n🚀 n8n MCP Server starting with {len(n8n_tools)} tools:")
for tool in n8n_tools:
    print(f"   - {tool['name']}: {tool['description']}")

# Register all tools dynamically
print("\n📝 Registering tools with MCP...")
register_n8n_tools()


# Health check endpoint for Kubernetes probes
@mcp.custom_route("/", methods=["GET"])
@mcp.custom_route("/health", methods=["GET"])
async def health_check(request):
    """Health check endpoint for Kubernetes liveness/readiness probes."""
    return JSONResponse({
        "status": "healthy",
        "server": "n8n-tools MCP Server",
        "tools_count": len(n8n_tools),
        "mcp_endpoint": "/mcp"
    })


if __name__ == "__main__":
    # Run MCP server with HTTP transport on /mcp endpoint
    port = int(os.getenv("PORT", "8080"))  # Use 8080, configurable via PORT env var
    print("\n" + "=" * 60)
    print(f"🎯 Starting MCP server on http://0.0.0.0:{port}/mcp")
    print("=" * 60 + "\n")

    mcp.run(
        transport="http",
        host="0.0.0.0",
        port=port,
        path="/mcp",  # Use /mcp endpoint as requested
    )
