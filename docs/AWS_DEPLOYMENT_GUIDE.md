# n8n on AWS EKS Behind NGINX Ingress - Deployment Guide

**Date**: December 8, 2025
**n8n Version**: Latest stable (Docker tag: `latest`)
**Status**: ✅ WORKING - Chat functionality fully operational

---

## Overview

This guide documents the working configuration for deploying n8n v2.0.0-rc.4 on AWS EKS behind NGINX Ingress Controller with AWS Network Load Balancer (NLB). All features including Chat Trigger are fully functional.

## Architecture

```
Internet
    ↓
AWS NLB (Layer 4)
    ↓
NGINX Ingress Controller
    ↓
Custom NGINX Reverse Proxy (for header control)
    ↓
n8n Pod (port 5678)
```

---

## Critical Configuration Components

### 1. n8n Environment Variables

**DO NOT MODIFY** - These match local working configuration:

```yaml
env:
  - name: N8N_EDITOR_BASE_URL
    value: http://k8s-ingressn-ingressn-b062f7f393-dd1419f8969379cd.elb.eu-west-2.amazonaws.com/n8n
  - name: N8N_HOST
    value: k8s-ingressn-ingressn-b062f7f393-dd1419f8969379cd.elb.eu-west-2.amazonaws.com
  - name: N8N_PATH
    value: /n8n/
  - name: N8N_PORT
    value: "5678"
  - name: N8N_PROTOCOL
    value: http
  - name: N8N_PUSH_BACKEND
    value: polling  # Critical for AWS ELB + Ingress stability
  - name: WEBHOOK_URL
    value: http://k8s-ingressn-ingressn-b062f7f393-dd1419f8969379cd.elb.eu-west-2.amazonaws.com/n8n/
  - name: N8N_ALLOWED_CORS_ORIGINS
    value: http://k8s-ingressn-ingressn-b062f7f393-dd1419f8969379cd.elb.eu-west-2.amazonaws.com
  - name: N8N_CORS_ENABLED
    value: "true"
  - name: N8N_LOG_LEVEL
    value: debug
  - name: N8N_LOG_OUTPUT
    value: console
```

**Key Points:**
- `N8N_PUSH_BACKEND=polling` is required for stability through AWS ELB + NGINX Ingress
- `N8N_PATH=/n8n/` tells n8n it's mounted at `/n8n/` prefix
- `N8N_EDITOR_BASE_URL` includes the full path with `/n8n` suffix

---

### 2. Custom NGINX Reverse Proxy

**Purpose**: Set `Origin` header and handle WebSocket upgrades that NGINX Ingress annotations cannot control.

**File**: `n8n-nginx-proxy.yaml`

```yaml
---
apiVersion: v1
kind: ConfigMap
metadata:
  name: n8n-nginx-proxy-config
  namespace: default
data:
  nginx.conf: |
    events {
      worker_connections 1024;
    }

    http {
      server {
        listen 8080;
        server_name _;

        location / {
          # Forward to n8n service
          proxy_pass http://ark-n8n:5678;

          # Critical: Set Origin header that n8n expects
          proxy_set_header Origin http://$host;

          # Standard proxy headers
          proxy_set_header Host $host;
          proxy_set_header X-Real-IP $remote_addr;
          proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
          proxy_set_header X-Forwarded-Proto $scheme;
          proxy_set_header X-Forwarded-Host $http_host;

          # WebSocket support
          proxy_http_version 1.1;
          proxy_set_header Upgrade $http_upgrade;
          proxy_set_header Connection "upgrade";

          # Timeouts for long-running requests
          proxy_connect_timeout 3600s;
          proxy_send_timeout 3600s;
          proxy_read_timeout 3600s;

          # Disable buffering for streaming responses
          proxy_buffering off;
          proxy_request_buffering off;
        }
      }
    }

---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: n8n-nginx-proxy
  namespace: default
spec:
  replicas: 1
  selector:
    matchLabels:
      app: n8n-nginx-proxy
  template:
    metadata:
      labels:
        app: n8n-nginx-proxy
    spec:
      containers:
      - name: nginx
        image: nginx:1.25-alpine
        ports:
        - containerPort: 8080
          name: http
        volumeMounts:
        - name: nginx-config
          mountPath: /etc/nginx/nginx.conf
          subPath: nginx.conf
      volumes:
      - name: nginx-config
        configMap:
          name: n8n-nginx-proxy-config

---
apiVersion: v1
kind: Service
metadata:
  name: n8n-nginx-proxy
  namespace: default
spec:
  type: ClusterIP
  ports:
  - port: 80
    targetPort: 8080
    protocol: TCP
    name: http
  selector:
    app: n8n-nginx-proxy
```

**Deploy**:
```bash
kubectl apply -f n8n-nginx-proxy.yaml
```

---

### 3. NGINX Ingress Configuration

**File**: `ingress-no-buffering.yaml`

**CRITICAL**: Route order matters! Chat route MUST come before catch-all dashboard route.

```yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: ark-ingress
  namespace: default
  annotations:
    # WebSocket support - point to custom proxy
    nginx.ingress.kubernetes.io/websocket-services: "n8n-nginx-proxy"
    nginx.ingress.kubernetes.io/proxy-read-timeout: "3600"
    nginx.ingress.kubernetes.io/proxy-send-timeout: "3600"
    nginx.ingress.kubernetes.io/proxy-connect-timeout: "3600"
    nginx.ingress.kubernetes.io/proxy-body-size: "0"
    nginx.ingress.kubernetes.io/ssl-redirect: "false"

    # CRITICAL: Disable buffering for webhooks and chat
    nginx.ingress.kubernetes.io/proxy-buffering: "off"
    nginx.ingress.kubernetes.io/proxy-request-buffering: "off"
    nginx.ingress.kubernetes.io/proxy-http-version: "1.1"

    # Enable streaming responses
    nginx.ingress.kubernetes.io/x-accel-buffering: "no"

    # Path rewriting
    nginx.ingress.kubernetes.io/rewrite-target: /$2
    nginx.ingress.kubernetes.io/use-regex: "true"
spec:
  ingressClassName: nginx
  rules:
  - http:
      paths:
      # n8n routes - strip /n8n prefix and route through NGINX proxy
      - path: /n8n(/|$)(.*)
        pathType: ImplementationSpecific
        backend:
          service:
            name: n8n-nginx-proxy
            port:
              number: 80

      # ARK API routes - pass through v1 prefix
      - path: /()(v1.*)
        pathType: ImplementationSpecific
        backend:
          service:
            name: ark-api
            port:
              number: 80

      # Chat WebSocket endpoint - route to n8n without rewriting
      # MUST come BEFORE catch-all dashboard route
      - path: /()(chat.*)
        pathType: ImplementationSpecific
        backend:
          service:
            name: n8n-nginx-proxy
            port:
              number: 80

      # ARK Dashboard with /dashboard prefix stripped
      - path: /dashboard(/|$)(.*)
        pathType: ImplementationSpecific
        backend:
          service:
            name: ark-dashboard
            port:
              number: 3000

      # Default route to dashboard (catch-all)
      - path: /()(.*)
        pathType: ImplementationSpecific
        backend:
          service:
            name: ark-dashboard
            port:
              number: 3000
```

**Deploy**:
```bash
kubectl apply -f ingress-no-buffering.yaml
```

**Key Routing Logic**:
1. `/n8n/*` → n8n-nginx-proxy (n8n UI and API)
2. `/v1*` → ark-api (ARK API endpoints)
3. `/chat*` → n8n-nginx-proxy (Chat WebSocket - **CRITICAL FIX**)
4. `/dashboard/*` → ark-dashboard
5. `/*` → ark-dashboard (catch-all)

---

## Why Chat Was Broken

### Root Cause

**Problem**: n8n's frontend JavaScript generates WebSocket URLs for chat as `/chat` (without `/n8n` prefix), even when `N8N_PATH=/n8n/` is set.

**What Was Happening**:
1. Browser initiates WebSocket: `ws://.../chat?sessionId=...`
2. NGINX Ingress matches catch-all route `/()(.*)`
3. Request routed to **dashboard service** instead of n8n
4. Chat connection fails, workflow enters "waiting until year 3000" state

### The Fix

**Added specific Ingress route** for `/chat` requests BEFORE the catch-all dashboard route:

```yaml
- path: /()(chat.*)
  pathType: ImplementationSpecific
  backend:
    service:
      name: n8n-nginx-proxy
      port:
        number: 80
```

**Result**:
- Browser sends `/chat` → Ingress routes to n8n-nginx-proxy
- NGINX proxy forwards to n8n with correct `Origin` header
- Chat WebSocket connection succeeds
- Workflow executes and responds immediately

---

## Testing the Deployment

### 1. Verify n8n is Running

```bash
kubectl get pods -n default -l app=ark-n8n
kubectl logs -n default deployment/ark-n8n --tail=50
```

Expected: Pod running, no errors in logs.

### 2. Verify NGINX Proxy is Running

```bash
kubectl get pods -n default -l app=n8n-nginx-proxy
kubectl logs -n default deployment/n8n-nginx-proxy --tail=50
```

Expected: NGINX access logs showing proxied requests.

### 3. Test n8n UI Access

```bash
curl -I http://YOUR_ELB_HOSTNAME/n8n/
```

Expected: HTTP 200 with n8n HTML response.

### 4. Test Chat Functionality

1. Open n8n: `http://YOUR_ELB_HOSTNAME/n8n/`
2. Create workflow with "When chat message received" trigger
3. Add "Respond to Chat" node
4. Click "Test workflow"
5. Send chat message in test UI

**Expected**: Immediate response, NO "waiting" status.

### 5. Monitor Logs During Chat Test

```bash
# Terminal 1: n8n logs
kubectl logs -n default deployment/ark-n8n -f | grep -E "(chat|Chat|execution)"

# Terminal 2: NGINX proxy logs
kubectl logs -n default deployment/n8n-nginx-proxy -f

# Terminal 3: Ingress logs
kubectl logs -n ingress-nginx deployment/ingress-nginx-controller -f | grep "/chat"
```

**Expected**:
- Ingress logs show `/chat` requests
- NGINX proxy logs show proxied `/chat` requests
- n8n logs show chat execution completing successfully

---

## Troubleshooting

### Chat Still Not Working

1. **Verify Ingress route order**:
   ```bash
   kubectl get ingress ark-ingress -o yaml | grep -A 5 "path:"
   ```
   Ensure `/chat` route appears BEFORE catch-all `/()(.*)`

2. **Check websocket-services annotation**:
   ```bash
   kubectl get ingress ark-ingress -o jsonpath='{.metadata.annotations.nginx\.ingress\.kubernetes\.io/websocket-services}'
   ```
   Expected: `n8n-nginx-proxy`

3. **Verify NGINX proxy Origin header**:
   ```bash
   kubectl exec -it deployment/n8n-nginx-proxy -- grep "Origin" /etc/nginx/nginx.conf
   ```
   Expected: `proxy_set_header Origin http://$host;`

4. **Test direct proxy access**:
   ```bash
   kubectl run -it --rm debug --image=curlimages/curl --restart=Never -- \
     curl -v http://n8n-nginx-proxy/healthz
   ```
   Expected: HTTP 200 from n8n

### Origin Header Errors

If seeing "Invalid origin!" in logs:

1. Check custom NGINX proxy is deployed and running
2. Verify Ingress routes to `n8n-nginx-proxy`, not directly to `ark-n8n`
3. Confirm Origin header is set in NGINX proxy config

### WebSocket Connection Failed

1. **Check NLB idle timeout**:
   ```bash
   aws elbv2 describe-load-balancers \
     --names k8s-ingressn-ingressn-b062f7f393 \
     --query 'LoadBalancers[0].Attributes'
   ```
   Idle timeout should be >= 3600 seconds

2. **Verify WebSocket upgrade headers** in NGINX proxy config

3. **Test WebSocket directly** (from within cluster):
   ```bash
   kubectl run -it --rm debug --image=alpine/curl --restart=Never -- \
     curl -v -N -H "Connection: Upgrade" -H "Upgrade: websocket" \
     http://n8n-nginx-proxy/chat
   ```

---

## Key Differences: Local vs AWS

| Component | Local (OrbStack) | AWS (EKS) |
|-----------|------------------|-----------|
| **Routing** | Gateway API (HTTPRoute) | NGINX Ingress |
| **Path Handling** | Direct `/` mount | Path rewrite `/n8n` → `/` |
| **Load Balancer** | None | AWS NLB (Layer 4) |
| **Origin Header** | Set by Gateway API | Set by custom NGINX proxy |
| **Chat Route** | Implicit (Gateway handles) | Explicit Ingress route required |
| **Push Backend** | Polling | Polling (WebSocket unstable through NLB) |

**Critical Takeaway**: AWS deployment requires explicit `/chat` route in Ingress due to catch-all dashboard route. Local Gateway API doesn't have this conflict.

---

## Files Reference

| File | Purpose |
|------|---------|
| `n8n-nginx-proxy.yaml` | Custom NGINX proxy for header control |
| `ingress-no-buffering.yaml` | NGINX Ingress with correct route order |
| `aws-deployment.yaml` | n8n deployment with environment variables |
| `AWS_DEPLOYMENT_GUIDE.md` | This guide |

---

## Deployment Checklist

- [ ] Deploy custom NGINX proxy: `kubectl apply -f n8n-nginx-proxy.yaml`
- [ ] Deploy n8n with correct environment variables
- [ ] Deploy Ingress with `/chat` route BEFORE catch-all: `kubectl apply -f ingress-no-buffering.yaml`
- [ ] Verify all pods running: `kubectl get pods -n default`
- [ ] Test n8n UI access: `http://YOUR_ELB/n8n/`
- [ ] Test chat functionality in test workflow
- [ ] Monitor logs during chat test
- [ ] Confirm immediate response, no "waiting" status

---

## Summary

**What Works**:
✅ n8n UI accessible at `/n8n/`
✅ WebSocket push updates (polling mode)
✅ Chat Trigger with immediate responses
✅ Webhook triggers
✅ All standard workflow execution
✅ ARK custom nodes fully functional

**Root Cause of Chat Issue**: n8n generates `/chat` WebSocket URLs without path prefix, which were being routed to dashboard service instead of n8n.

**Solution**: Add explicit Ingress route for `/chat` that routes to n8n-nginx-proxy, positioned before catch-all dashboard route.

**Key Principle**: Keep n8n environment variables identical to local working configuration. Handle routing differences at Ingress layer, not application configuration.

---

**Last Updated**: December 8, 2025
**Tested With**: n8n latest stable, NGINX Ingress Controller, AWS EKS, AWS NLB
**Docker Image**: `ghcr.io/skokaina/ark-n8n:latest` (based on `docker.n8n.io/n8nio/n8n:latest`)
