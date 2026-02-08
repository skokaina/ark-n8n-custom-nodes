# Auto-Login Solution for Demo Deployments

## Problem

n8n requires owner account setup on first use, and subsequent logins. For demo environments, we want users to access n8n without seeing any login screens.

## Solution

Nginx reverse proxy with auto-login landing page:

```
User → nginx proxy → Auto-login page → n8n API login → n8n workflows
```

## How It Works

1. **User visits the URL**
   - Hits nginx proxy at `/`
   - Sees beautiful landing page with spinner

2. **JavaScript auto-login**
   - Fetches credentials from template
   - Posts to `/api/v1/login`
   - Receives authentication cookie

3. **Redirect to n8n**
   - Automatically redirected to `/workflows`
   - Fully authenticated session
   - No manual login required!

4. **WebSocket support**
   - nginx configured for WebSocket passthrough
   - Real-time workflow updates work correctly

## Features

✅ **Zero-click access** - Users never see login screen
✅ **WebSocket support** - Real-time updates work
✅ **Fallback option** - Manual login link if auto-login fails
✅ **Credentials displayed** - Users know how to login manually if needed
✅ **Session persistence** - Cookies maintained across requests

## Deployment

### Enable Demo Mode

```bash
helm install ark-n8n oci://ghcr.io/skokaina/charts/ark-n8n \
  -f chart/values-demo.yaml
```

This deploys:
- n8n with default account (created via setup script)
- nginx proxy with auto-login page
- HTTPRoute pointing to nginx (not n8n directly)

### Architecture

```
┌─────────────┐
│   User      │
└──────┬──────┘
       │
       ▼
┌─────────────────────────────┐
│  nginx Proxy                │
│  ┌───────────────────────┐  │
│  │ Auto-login HTML page  │  │
│  │ - Shows spinner       │  │
│  │ - JavaScript login    │  │
│  │ - Redirects to /workflows │
│  └───────────────────────┘  │
│                              │
│  WebSocket passthrough       │
│  Cookie forwarding           │
└──────────┬───────────────────┘
           │
           ▼
    ┌──────────────┐
    │    n8n       │
    │ (with account)│
    └──────────────┘
```

### Custom Credentials

Update `values-demo.yaml`:

```yaml
demo:
  enabled: true
  email: "custom@example.com"
  password: "CustomPass123!"
```

## nginx Configuration

### WebSocket Support

```nginx
proxy_http_version 1.1;
proxy_set_header Upgrade $http_upgrade;
proxy_set_header Connection $connection_upgrade;

# Timeouts for long-running workflows
proxy_connect_timeout 3600s;
proxy_send_timeout 3600s;
proxy_read_timeout 3600s;
```

### Auto-Login Page

Served at `/` (root):
- Beautiful spinner animation
- Credentials displayed
- JavaScript auto-login
- Fallback manual login link

### Proxy Passthrough

All other requests (`/api/*`, `/workflows`, `/signin`, etc.) proxied directly to n8n.

## Testing

1. **Deploy with demo mode:**
   ```bash
   helm install ark-n8n ./chart -f chart/values-demo.yaml
   ```

2. **Create account (first time):**
   ```bash
   kubectl port-forward svc/ark-n8n 5678:5678 &
   node e2e/scripts/setup-n8n-account.js
   ```

3. **Access via proxy:**
   ```bash
   kubectl port-forward svc/ark-n8n-proxy 8080:80
   # Open http://localhost:8080
   # Should auto-login and redirect to workflows!
   ```

## Troubleshooting

### Auto-login fails

**Check n8n account exists:**
```bash
kubectl exec deployment/ark-n8n -- n8n user:list
```

**Check credentials match:**
```bash
# In nginx ConfigMap
kubectl get cm ark-n8n-nginx -o yaml | grep email
```

**Manual login:**
Users can always click "Click here to login manually" on the auto-login page.

### WebSocket not working

**Check nginx logs:**
```bash
kubectl logs deployment/ark-n8n-nginx
```

**Verify connection upgrade:**
```bash
curl -i -N -H "Connection: Upgrade" -H "Upgrade: websocket" http://localhost:8080/
```

### Session not persisting

**Check cookies:**
- Ensure `credentials: 'include'` in fetch call
- Verify nginx forwards `Set-Cookie` headers
- Check browser dev tools → Application → Cookies

## Security Considerations

⚠️ **Demo/Test Only!**

This auto-login approach is **NOT SECURE** for production:
- Credentials visible in HTML source
- No protection against unauthorized access
- Shared account (not multi-user)

**For production:**
- Use real authentication (see [Production Guide](./PRODUCTION.md))
- Enable SSO/SAML
- Use proper user management
- Enable HTTPS/TLS

## Alternatives Considered

| Approach | Works? | Notes |
|----------|--------|-------|
| `N8N_USER_MANAGEMENT_DISABLED=true` | ❌ | Ignored by n8n |
| Server-side auth passthrough | ⚠️ | Complex, session handling issues |
| Browser extension | ⚠️ | Requires user install |
| **nginx + JavaScript auto-login** | ✅ | **Simple, reliable, transparent** |

The nginx proxy approach is transparent, simple, and gives users a professional experience while clearly showing it's a demo environment.
