# Configuration Guide

## Helm Values

Key configuration options in `chart/values.yaml`:

```yaml
ark:
  apiUrl: http://ark-api.ark-system.svc.cluster.local  # ARK API endpoint

app:
  image:
    repository: ghcr.io/skokaina/ark-n8n
    tag: latest
  resources:
    limits:
      cpu: 500m
      memory: 512Mi

storage:
  enabled: true
  size: 1Gi
  storageClass: ""  # Use default storage class
```

## Custom Deployments

### Different ARK API URL

```bash
helm install ark-n8n oci://ghcr.io/skokaina/charts/ark-n8n \
  --set ark.apiUrl=https://your-ark-api.example.com
```

### Disable HTTPRoute (port-forward only)

```bash
helm install ark-n8n oci://ghcr.io/skokaina/charts/ark-n8n \
  --set httpRoute.enabled=false
```

### Custom Domain (Production)

```bash
helm install ark-n8n oci://ghcr.io/skokaina/charts/ark-n8n \
  --set httpRoute.hostnames[0]=n8n.yourcompany.com \
  --set httpRoute.origin=n8n.yourcompany.com \
  --set app.env.N8N_PROTOCOL=https \
  --set app.env.N8N_HOST=n8n.yourcompany.com \
  --set app.env.N8N_EDITOR_BASE_URL=https://n8n.yourcompany.com \
  --set app.env.WEBHOOK_URL=https://n8n.yourcompany.com
```

## Environment Variables

### n8n Configuration

Set via `app.env` in values.yaml:

| Variable | Default | Description |
|----------|---------|-------------|
| `N8N_HOST` | - | Hostname for n8n instance |
| `N8N_PORT` | `5678` | Port for n8n server |
| `N8N_PROTOCOL` | `http` | http or https |
| `N8N_BASIC_AUTH_ACTIVE` | `true` | Enable authentication |
| `GENERIC_TIMEZONE` | `America/New_York` | Timezone for executions |

### ARK Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `ARK_API_URL` | - | ARK API endpoint (set via `ark.apiUrl`) |

## Values Files

Pre-configured values files for different scenarios:

### Production (default)
```bash
helm install ark-n8n oci://ghcr.io/skokaina/charts/ark-n8n
# Uses chart/values.yaml
```

### Demo Mode (no auth)
```bash
helm install ark-n8n oci://ghcr.io/skokaina/charts/ark-n8n \
  -f chart/values-demo.yaml
```

### Testing Mode
```bash
helm install ark-n8n ./chart \
  -f chart/values-testing.yaml
```

See [Deployment Modes](./DEPLOYMENT_MODES.md) for details.
