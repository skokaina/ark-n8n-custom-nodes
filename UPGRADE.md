# Upgrading ARK n8n

## Quick Upgrade

```bash
# Get latest version
helm upgrade ark-n8n oci://ghcr.io/skokaina/charts/ark-n8n \
  --version 0.1.0 \
  --reuse-values \
  --wait
```

## Upgrade with Custom Domain

If you're using a custom domain (not localhost):

```bash
helm upgrade ark-n8n oci://ghcr.io/skokaina/charts/ark-n8n \
  --version 0.1.0 \
  --set app.image.tag=0.1.0 \
  --set app.env.N8N_HOST=your-domain.com \
  --set app.env.N8N_EDITOR_BASE_URL=https://your-domain.com/n8n \
  --set app.env.WEBHOOK_URL=https://your-domain.com/n8n \
  --set demo.email=admin@your-domain.com \
  --wait
```

## Migration from v0.0.x to v0.1.0

### Breaking Changes

**HTTPRoute Defaults Changed:**
- v0.0.x: `httpRoute.enabled=true` (assumed Gateway API)
- v0.1.0: `httpRoute.enabled=false` (uses nginx proxy by default)

**If you're using HTTPRoute/Gateway API:**
```bash
helm upgrade ark-n8n oci://ghcr.io/skokaina/charts/ark-n8n \
  --version 0.1.0 \
  --set httpRoute.enabled=true \
  --reuse-values \
  --wait
```

**If you're using traditional Ingress:**
- Update your Ingress to route to `ark-n8n-proxy` service (port 80) instead of `ark-n8n` directly
- This gives you auto-login and CORS handling
- Or disable demo mode: `--set demo.enabled=false` and route directly to `ark-n8n` service

### Manual nginx Proxy Users

If you deployed a manual nginx proxy (like `n8n-nginx-proxy`):

1. **Upgrade with demo mode enabled** (uses Helm chart's proxy):
```bash
helm upgrade ark-n8n oci://ghcr.io/skokaina/charts/ark-n8n \
  --version 0.1.0 \
  --set demo.enabled=true \
  --wait
```

2. **Update your Ingress** to route to `ark-n8n-proxy` (Helm chart's service)

3. **Remove manual proxy** (after testing):
```bash
kubectl delete deployment n8n-nginx-proxy
kubectl delete service n8n-nginx-proxy
kubectl delete configmap n8n-nginx-proxy-config
```

## Verify Upgrade

```bash
# Check pod status
kubectl get pods -l app=ark-n8n

# Check version
helm list | grep ark-n8n

# Test access (adjust URL for your setup)
curl -I http://localhost:8080/  # Local
curl -I https://your-domain.com/n8n/  # Production
```

## Rollback

```bash
helm rollback ark-n8n
```
