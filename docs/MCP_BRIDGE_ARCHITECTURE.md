# MCP Bridge Architecture for n8n ↔ ARK Tool Integration

**Version**: 1.0
**Date**: 2026-02-10
**Status**: ✅ Design Complete - Ready for Implementation

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [MCP Protocol Overview](#mcp-protocol-overview)
3. [Architecture Design](#architecture-design)
4. [Component Specifications](#component-specifications)
5. [API Contracts](#api-contracts)
6. [Deployment Strategy](#deployment-strategy)
7. [Security Considerations](#security-considerations)
8. [Implementation Roadmap](#implementation-roadmap)

---

## Executive Summary

This document defines the architecture for bridging n8n AI tools with ARK agents using the **Model Context Protocol (MCP)**. The solution deploys an MCP server as a sidecar container in the n8n pod, discovering n8n AI tools dynamically and exposing them to ARK agents via the standard MCP protocol.

### Key Benefits

- ✅ **Standards-Based**: Uses [MCP specification](https://modelcontextprotocol.io/specification/2025-06-18/basic/transports)
- ✅ **ARK Native**: ARK already supports MCP tool type
- ✅ **Zero ARK Changes**: No modifications to ARK API needed
- ✅ **Clean Separation**: n8n and ARK remain decoupled
- ✅ **Dynamic Discovery**: Tools discovered automatically from workflows
- ✅ **Scalable**: Sidecar pattern allows independent scaling

---

## MCP Protocol Overview

### What is MCP?

[Model Context Protocol (MCP)](https://modelcontextprotocol.io/) is an open standard created by Anthropic for connecting AI models to external tools and data sources. It uses JSON-RPC 2.0 over multiple transport mechanisms.

**Key Resources**:
- [Official MCP Specification](https://modelcontextprotocol.io/specification/2025-06-18/basic/transports)
- [MCP Tools Specification](https://modelcontextprotocol.io/specification/2025-11-25/server/tools)
- [MCP Message Types Guide](https://portkey.ai/blog/mcp-message-types-complete-json-rpc-reference-guide/)
- [MCP Server Development Guide](https://github.com/cyanheads/model-context-protocol-resources/blob/main/guides/mcp-server-development-guide.md)

### Transport Mechanisms

MCP supports three transport types:

1. **stdio** - Standard input/output (subprocess communication)
2. **Streamable HTTP** - HTTP POST/GET with optional SSE streaming
3. **Custom** - Pluggable transport implementations

**For our use case**: We'll use **Streamable HTTP** with SSE (Server-Sent Events) for bidirectional communication between ARK and the MCP server.

### JSON-RPC 2.0 Format

All MCP messages use [JSON-RPC 2.0](https://www.jsonrpc.org/specification):

```json
{
  "jsonrpc": "2.0",
  "method": "tools/list",
  "id": 1,
  "params": {}
}
```

**Message Types**:
- **Request**: Client → Server (expects response)
- **Response**: Server → Client (in response to request)
- **Notification**: Either direction (no response expected)

---

## Architecture Design

### High-Level Architecture

```
┌──────────────────────────────────────────────────────────────┐
│                     n8n Pod (Kubernetes)                     │
│                                                              │
│  ┌────────────────────────┐      ┌────────────────────────┐ │
│  │  n8n Main Container    │      │  MCP Server (Sidecar)  │ │
│  │                        │      │                        │ │
│  │  - Workflows           │      │  - Tool Discovery      │ │
│  │  - AI Tool Nodes       │◄─────┤  - MCP Protocol        │ │
│  │  - Execution Engine    │      │  - SSE Endpoint        │ │
│  │                        │      │  - Tool Execution      │ │
│  └────────────────────────┘      └────────────┬───────────┘ │
│                                                │             │
└────────────────────────────────────────────────┼─────────────┘
                                                 │
                          ClusterIP Service      │
                          (ark-n8n-mcp:8080)     │
                                                 │
                                MCP Protocol     │
                           (JSON-RPC over SSE)   │
                                                 │
┌────────────────────────────────────────────────┼─────────────┐
│                    ARK Cluster                 │             │
│                                                ▼             │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  ARK Agent CRD                                       │   │
│  │                                                      │   │
│  │  apiVersion: ark.mckinsey.com/v1alpha1              │   │
│  │  kind: Agent                                         │   │
│  │  metadata:                                           │   │
│  │    name: n8n-tools-agent                            │   │
│  │  spec:                                               │   │
│  │    modelRef:                                         │   │
│  │      name: gpt-4                                     │   │
│  │    tools:                                            │   │
│  │      - type: mcp                                     │   │
│  │        server:                                       │   │
│  │          url: http://ark-n8n-mcp:8080/sse           │   │
│  │          transport: sse                              │   │
│  └──────────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────────┘
```

### Data Flow

#### 1. Tool Discovery Flow

```
ARK Agent Startup
  ↓
1. ARK connects to MCP server (GET /sse)
  ↓
2. ARK sends: tools/list request
   {
     "jsonrpc": "2.0",
     "method": "tools/list",
     "id": 1
   }
  ↓
3. MCP Server:
   - Scans n8n workflows for AI tool nodes
   - Calls getInputConnectionData('ai_tool', 0)
   - Discovers: Calculator, HTTP Request, Web Search tools
  ↓
4. MCP Server converts tools to MCP format:
   - name: "calculator"
   - description: "Perform calculations"
   - inputSchema: { type: "object", properties: {...} }
  ↓
5. MCP Server responds:
   {
     "jsonrpc": "2.0",
     "id": 1,
     "result": {
       "tools": [
         {
           "name": "calculator",
           "description": "Perform mathematical calculations",
           "inputSchema": {...}
         },
         ...
       ]
     }
   }
  ↓
6. ARK Agent now knows available n8n tools
```

#### 2. Tool Execution Flow

```
User Query: "What is 25 * 42?"
  ↓
1. ARK Agent (via LLM) decides to use calculator tool
  ↓
2. ARK sends: tools/call request (POST /sse)
   {
     "jsonrpc": "2.0",
     "method": "tools/call",
     "id": 2,
     "params": {
       "name": "calculator",
       "arguments": {
         "expression": "25 * 42"
       }
     }
   }
  ↓
3. MCP Server:
   - Finds calculator tool from discovered n8n tools
   - Calls tool.call('{"expression": "25 * 42"}')
   - n8n Calculator node executes
   - Result: "1050"
  ↓
4. MCP Server responds (via SSE):
   {
     "jsonrpc": "2.0",
     "id": 2,
     "result": {
       "content": [
         {
           "type": "text",
           "text": "1050"
         }
       ]
     }
   }
  ↓
5. ARK Agent receives result
  ↓
6. ARK Agent (via LLM) generates response:
   "The answer to 25 * 42 is 1,050."
```

---

## Component Specifications

### 1. MCP Server (Node.js/TypeScript)

**Purpose**: Expose n8n AI tools via MCP protocol

**Tech Stack**:
- **Runtime**: Node.js 20+
- **Language**: TypeScript
- **Framework**: Express (HTTP server)
- **SSE Library**: `express-sse` or `@socket.io/sse`
- **JSON-RPC**: Custom implementation

**Directory Structure**:
```
mcp-server/
├── src/
│   ├── server.ts              # Express server + SSE endpoint
│   ├── mcp/
│   │   ├── protocol.ts        # JSON-RPC message handlers
│   │   ├── tools-list.ts      # tools/list handler
│   │   └── tools-call.ts      # tools/call handler
│   ├── n8n/
│   │   ├── tool-discovery.ts  # Discover n8n tools
│   │   ├── tool-converter.ts  # LangChain → MCP format
│   │   └── tool-executor.ts   # Execute n8n tools
│   ├── types/
│   │   ├── mcp.ts            # MCP message types
│   │   └── n8n.ts            # n8n tool types
│   └── utils/
│       ├── logger.ts          # Winston logger
│       └── errors.ts          # Error handling
├── tests/
│   ├── unit/                  # Unit tests
│   └── integration/           # Integration tests
├── Dockerfile
├── package.json
└── tsconfig.json
```

**Key Interfaces**:

```typescript
// MCP Tool Format (per spec)
interface MCPTool {
  name: string;                    // Tool identifier (1-128 chars)
  description: string;             // Human-readable description
  inputSchema: JSONSchema;         // JSON Schema for parameters
  outputSchema?: JSONSchema;       // Optional output validation
}

// n8n LangChain Tool (from getInputConnectionData)
interface N8nTool {
  name: string;
  description: string;
  schema: ZodSchema;               // Zod validation schema
  call(input: string): Promise<string>;  // Execution function
}

// MCP JSON-RPC Messages
interface MCPRequest {
  jsonrpc: "2.0";
  method: string;
  id: number | string;
  params?: any;
}

interface MCPResponse {
  jsonrpc: "2.0";
  id: number | string;
  result?: any;
  error?: {
    code: number;
    message: string;
    data?: any;
  };
}
```

### 2. n8n Integration Points

**Tool Discovery**:
```typescript
// In MCP server, query n8n for tools
import { IExecuteFunctions } from 'n8n-workflow';

async function discoverN8nTools(): Promise<N8nTool[]> {
  // Access n8n runtime context (injected via shared volume or API)
  const executeFunctions = getN8nExecuteFunctions();

  // Get connected AI tools
  const tools = await executeFunctions.getInputConnectionData('ai_tool', 0);

  return tools as N8nTool[];
}
```

**Options for Discovery**:

**Option A**: Shared Volume (Simplest)
- n8n writes tool metadata to `/tmp/n8n-tools.json`
- MCP server reads from shared volume
- Updates on workflow changes

**Option B**: n8n Internal API (Better)
- MCP server queries n8n via localhost
- Endpoint: `GET http://localhost:5678/internal/ai-tools`
- Requires n8n patch to expose endpoint

**Option C**: Workflow Hooks (Best)
- n8n emits events on workflow save/update
- MCP server listens via webhook
- Real-time tool discovery

**Recommendation**: Start with **Option A** (shared volume), migrate to **Option C** (hooks) in future.

### 3. ARK Agent Configuration

**Agent CRD with MCP Tools**:

```yaml
apiVersion: ark.mckinsey.com/v1alpha1
kind: Agent
metadata:
  name: n8n-calculator-agent
  namespace: default
spec:
  modelRef:
    name: gpt-4
    namespace: default

  tools:
    # MCP tool type (ARK native support)
    - type: mcp
      server:
        url: http://ark-n8n-mcp.default.svc.cluster.local:8080/sse
        transport: sse
      # Optional: Authentication
      auth:
        type: bearer
        secretRef:
          name: mcp-auth-token
          key: token

  prompt: |
    You are a helpful assistant with access to n8n tools.
    Use the calculator tool for mathematical operations.
```

**ARK Query Example**:

```yaml
apiVersion: ark.mckinsey.com/v1alpha1
kind: Query
metadata:
  name: test-calculator-query
  namespace: default
spec:
  input: "What is the square root of 144?"
  targets:
    - type: agent
      name: n8n-calculator-agent
  wait: true
  timeout: "60s"
```

---

## API Contracts

### MCP Server Endpoints

#### 1. GET /sse

**Purpose**: Open SSE stream for server → client messages

**Headers**:
- `Accept: text/event-stream`
- `MCP-Protocol-Version: 2025-06-18`
- `Mcp-Session-Id: <session-id>` (after initialization)

**Response**:
- **Status**: 200 OK
- **Content-Type**: `text/event-stream`
- **Body**: SSE stream with JSON-RPC messages

**Example**:
```http
GET /sse HTTP/1.1
Host: ark-n8n-mcp:8080
Accept: text/event-stream
MCP-Protocol-Version: 2025-06-18

HTTP/1.1 200 OK
Content-Type: text/event-stream
Cache-Control: no-cache
Connection: keep-alive

data: {"jsonrpc":"2.0","method":"tools/list","id":1}\n\n
```

#### 2. POST /sse

**Purpose**: Send JSON-RPC request/notification/response

**Headers**:
- `Content-Type: application/json`
- `Accept: application/json, text/event-stream`
- `MCP-Protocol-Version: 2025-06-18`
- `Mcp-Session-Id: <session-id>` (after initialization)

**Request Body**: Single JSON-RPC message

**Response**:
- **For notifications/responses**: 202 Accepted (no body)
- **For requests**: Either JSON response OR SSE stream

**Example (tools/list)**:
```http
POST /sse HTTP/1.1
Host: ark-n8n-mcp:8080
Content-Type: application/json
Accept: application/json, text/event-stream
MCP-Protocol-Version: 2025-06-18

{
  "jsonrpc": "2.0",
  "method": "tools/list",
  "id": 1
}

HTTP/1.1 200 OK
Content-Type: application/json

{
  "jsonrpc": "2.0",
  "id": 1,
  "result": {
    "tools": [
      {
        "name": "calculator",
        "description": "Perform mathematical calculations",
        "inputSchema": {
          "type": "object",
          "properties": {
            "expression": {
              "type": "string",
              "description": "Mathematical expression"
            }
          },
          "required": ["expression"]
        }
      }
    ]
  }
}
```

### MCP Protocol Messages

#### 1. tools/list

**Request**:
```json
{
  "jsonrpc": "2.0",
  "method": "tools/list",
  "id": 1,
  "params": {
    "cursor": "optional-pagination-cursor"
  }
}
```

**Response**:
```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": {
    "tools": [
      {
        "name": "calculator",
        "description": "Perform calculations",
        "inputSchema": {
          "type": "object",
          "properties": {
            "expression": {
              "type": "string",
              "description": "Math expression to evaluate"
            }
          },
          "required": ["expression"]
        }
      },
      {
        "name": "web_search",
        "description": "Search the web",
        "inputSchema": {
          "type": "object",
          "properties": {
            "query": {
              "type": "string",
              "description": "Search query"
            }
          },
          "required": ["query"]
        }
      }
    ],
    "nextCursor": "optional-next-page-cursor"
  }
}
```

#### 2. tools/call

**Request**:
```json
{
  "jsonrpc": "2.0",
  "method": "tools/call",
  "id": 2,
  "params": {
    "name": "calculator",
    "arguments": {
      "expression": "25 * 42"
    }
  }
}
```

**Response**:
```json
{
  "jsonrpc": "2.0",
  "id": 2,
  "result": {
    "content": [
      {
        "type": "text",
        "text": "1050"
      }
    ],
    "isError": false
  }
}
```

**Error Response**:
```json
{
  "jsonrpc": "2.0",
  "id": 2,
  "error": {
    "code": -32603,
    "message": "Tool execution failed",
    "data": {
      "toolName": "calculator",
      "error": "Division by zero"
    }
  }
}
```

---

## Deployment Strategy

### Kubernetes Deployment

**Sidecar Pattern**:

```yaml
# chart/templates/deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: {{ include "ark-n8n.fullname" . }}
spec:
  template:
    spec:
      containers:
        # Main n8n container
        - name: n8n
          image: "{{ .Values.app.image.repository }}:{{ .Values.app.image.tag }}"
          ports:
            - name: http
              containerPort: 5678
          volumeMounts:
            - name: n8n-data
              mountPath: /home/node/.n8n
            - name: tools-shared
              mountPath: /tmp/tools  # Shared volume for tool discovery

        # MCP Server sidecar
        - name: mcp-server
          image: "{{ .Values.mcp.image.repository }}:{{ .Values.mcp.image.tag }}"
          ports:
            - name: mcp
              containerPort: 8080
          env:
            - name: N8N_INTERNAL_URL
              value: "http://localhost:5678"
            - name: TOOLS_SHARED_PATH
              value: "/tmp/tools"
            - name: LOG_LEVEL
              value: "{{ .Values.mcp.logLevel }}"
          volumeMounts:
            - name: tools-shared
              mountPath: /tmp/tools
          resources:
            limits:
              memory: "{{ .Values.mcp.resources.limits.memory }}"
              cpu: "{{ .Values.mcp.resources.limits.cpu }}"
            requests:
              memory: "{{ .Values.mcp.resources.requests.memory }}"
              cpu: "{{ .Values.mcp.resources.requests.cpu }}"
          livenessProbe:
            httpGet:
              path: /health
              port: 8080
            initialDelaySeconds: 10
            periodSeconds: 30
          readinessProbe:
            httpGet:
              path: /ready
              port: 8080
            initialDelaySeconds: 5
            periodSeconds: 10

      volumes:
        - name: n8n-data
          persistentVolumeClaim:
            claimName: {{ include "ark-n8n.fullname" . }}-data
        - name: tools-shared
          emptyDir: {}
```

**MCP Service**:

```yaml
# chart/templates/service-mcp.yaml
apiVersion: v1
kind: Service
metadata:
  name: {{ include "ark-n8n.fullname" . }}-mcp
  labels:
    {{- include "ark-n8n.labels" . | nindent 4 }}
    app.kubernetes.io/component: mcp-server
spec:
  type: ClusterIP
  ports:
    - port: 8080
      targetPort: mcp
      protocol: TCP
      name: mcp
  selector:
    {{- include "ark-n8n.selectorLabels" . | nindent 4 }}
```

**Values Configuration**:

```yaml
# chart/values.yaml
mcp:
  enabled: true
  image:
    repository: ghcr.io/skokaina/ark-n8n-mcp
    tag: "0.1.0"
    pullPolicy: IfNotPresent

  logLevel: "info"  # debug, info, warn, error

  resources:
    limits:
      memory: "512Mi"
      cpu: "500m"
    requests:
      memory: "256Mi"
      cpu: "200m"

  # Tool discovery method
  discovery:
    method: "shared-volume"  # shared-volume, api, hooks
    refreshInterval: "30s"   # How often to re-scan for tools

  # Security
  auth:
    enabled: false  # Enable bearer token auth
    secretName: "mcp-auth-token"
```

---

## Security Considerations

### 1. Authentication & Authorization

**Bearer Token Authentication**:

```typescript
// In MCP server
import { Request, Response, NextFunction } from 'express';

function authMiddleware(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      jsonrpc: "2.0",
      error: {
        code: -32600,
        message: "Unauthorized: Missing or invalid bearer token"
      }
    });
  }

  const token = authHeader.substring(7);
  const expectedToken = process.env.MCP_AUTH_TOKEN;

  if (token !== expectedToken) {
    return res.status(401).json({
      jsonrpc: "2.0",
      error: {
        code: -32600,
        message: "Unauthorized: Invalid token"
      }
    });
  }

  next();
}
```

**ARK Agent with Auth**:

```yaml
spec:
  tools:
    - type: mcp
      server:
        url: http://ark-n8n-mcp:8080/sse
      auth:
        type: bearer
        secretRef:
          name: mcp-auth-token
          key: token
```

### 2. Origin Validation

From [MCP security guidelines](https://modelcontextprotocol.io/specification/2025-06-18/basic/transports):

```typescript
// Prevent DNS rebinding attacks
function validateOrigin(req: Request, res: Response, next: NextFunction) {
  const origin = req.headers.origin;
  const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost'];

  if (origin && !allowedOrigins.includes(origin)) {
    return res.status(403).json({
      jsonrpc: "2.0",
      error: {
        code: -32600,
        message: "Forbidden: Invalid origin"
      }
    });
  }

  next();
}
```

### 3. Network Policies

**Restrict MCP server access to ARK pods only**:

```yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: ark-n8n-mcp-policy
spec:
  podSelector:
    matchLabels:
      app.kubernetes.io/name: ark-n8n
      app.kubernetes.io/component: mcp-server
  policyTypes:
    - Ingress
  ingress:
    # Allow from ARK controller pods
    - from:
        - namespaceSelector:
            matchLabels:
              name: ark-system
        - podSelector:
            matchLabels:
              app.kubernetes.io/name: ark-controller
      ports:
        - protocol: TCP
          port: 8080
```

### 4. Input Validation

**Tool argument validation**:

```typescript
import Ajv from 'ajv';

async function executeToolCall(toolName: string, args: any): Promise<any> {
  const tool = discoveredTools.find(t => t.name === toolName);

  if (!tool) {
    throw new Error(`Tool not found: ${toolName}`);
  }

  // Validate arguments against tool's input schema
  const ajv = new Ajv();
  const validate = ajv.compile(tool.inputSchema);

  if (!validate(args)) {
    throw new Error(`Invalid arguments: ${ajv.errorsText(validate.errors)}`);
  }

  // Execute tool
  return await tool.call(JSON.stringify(args));
}
```

---

## Implementation Roadmap

### Phase 1: MCP Server Foundation (Week 1)

**Tasks**:
1. Set up Express server with SSE endpoint
2. Implement JSON-RPC message parsing
3. Implement `tools/list` handler (with mock tools)
4. Implement `tools/call` handler (with mock execution)
5. Add unit tests for MCP protocol handling

**Deliverables**:
- MCP server responds to basic protocol messages
- Unit tests pass
- Docker image builds

### Phase 2: n8n Tool Discovery (Week 2)

**Tasks**:
1. Implement shared volume tool discovery
2. Parse n8n tool metadata from shared file
3. Convert n8n LangChain tools to MCP format (Zod → JSON Schema)
4. Test with sample n8n workflow

**Deliverables**:
- MCP server discovers real n8n tools
- Tool conversion working
- Integration tests pass

### Phase 3: Tool Execution (Week 3)

**Tasks**:
1. Implement tool execution bridge to n8n
2. Handle tool call results
3. Error handling and timeouts
4. Add execution logging

**Deliverables**:
- End-to-end tool execution works
- Errors handled gracefully
- Execution metrics logged

### Phase 4: Deployment & Testing (Week 4)

**Tasks**:
1. Add MCP server to Helm chart
2. Configure sidecar deployment
3. Create sample ARK Agent CRD
4. E2E test with Calculator tool
5. Documentation

**Deliverables**:
- Deployed to k3d cluster
- E2E tests pass
- Documentation complete

---

## References

- [MCP Official Specification](https://modelcontextprotocol.io/specification/2025-06-18/basic/transports)
- [MCP Tools Specification](https://modelcontextprotocol.io/specification/2025-11-25/server/tools)
- [MCP Message Types Guide](https://portkey.ai/blog/mcp-message-types-complete-json-rpc-reference-guide/)
- [n8n LangChain Documentation](https://docs.n8n.io/advanced-ai/langchain/langchain-n8n/)
- [ARK Documentation](https://mckinsey.github.io/agents-at-scale-ark/)
- [JSON-RPC 2.0 Specification](https://www.jsonrpc.org/specification)

---

**Status**: ✅ Architecture Complete - Ready for Task #6 (Implementation)
