# Deployment Modes

ARK n8n supports multiple deployment modes for different use cases.

## Overview

| Mode | Authentication | Use Case | Security Level |
|------|---------------|----------|----------------|
| **Production** | ✅ Required | Production deployments | 🔒 High |
| **Demo** | ❌ Disabled | Demos, evaluations | ⚠️ Low |
| **Testing** | ❌ Disabled | E2E tests, CI/CD | ⚠️ Low |

## Production Mode (Default)

**Default behavior** - Requires user authentication.

### Installation

```bash
# Standard install - requires login
helm install ark-n8n oci://ghcr.io/skokaina/charts/ark-n8n
```

### Configuration

Set credentials in `values.yaml`:

```yaml
app:
  env:
    N8N_BASIC_AUTH_ACTIVE: "true"
    N8N_BASIC_AUTH_USER: "admin"
    N8N_BASIC_AUTH_PASSWORD: "changeme"
```

Or via Helm:

```bash
helm install ark-n8n oci://ghcr.io/skokaina/charts/ark-n8n \
  --set app.env.N8N_BASIC_AUTH_USER=admin \
  --set app.env.N8N_BASIC_AUTH_PASSWORD=secure-password
```

### First-Time Setup

On first access, n8n will prompt to create an owner account:
1. Visit n8n UI
2. Create owner account (email + password)
3. Configure workflows and credentials

---

## Demo Mode

**Pre-configured demo account** - Easy access for demonstrations.

⚠️ **WARNING**: Only use in secure, isolated environments!

### Installation

**Using Helm with demo values:**

```bash
helm install ark-n8n oci://ghcr.io/skokaina/charts/ark-n8n \
  -f https://raw.githubusercontent.com/skokaina/ark-n8n-custom-nodes/main/chart/values-demo.yaml
```

**Default Demo Credentials:**
```
Email:    admin@example.com
Password: Admin123!@#
```

### Auto-Setup Process

On first deployment:
1. n8n shows owner account setup page
2. Run auto-setup script: `node e2e/scripts/setup-n8n-account.js`
3. Account is created with default credentials
4. Credentials displayed and saved to `/tmp/n8n-default-creds.json`

### For E2E Testing

```bash
make e2e-setup
# Automatically creates account with default credentials
# Access at http://localhost:5678
```

### Use Cases

- **Product demos**: Show ARK capabilities without login friction
- **Workshops**: Quick setup for training sessions
- **Proof of concepts**: Rapid prototyping
- **Internal testing**: Non-production environments

### Security Considerations

When using demo mode:

1. **Network isolation**: Deploy in private networks only
2. **Firewall rules**: Restrict access to trusted IPs
3. **Kubernetes Network Policies**: Limit pod access
4. **Temporary deployments**: Delete when demo is complete

Example NetworkPolicy:

```yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: ark-n8n-demo-access
spec:
  podSelector:
    matchLabels:
      app: ark-n8n
  policyTypes:
  - Ingress
  ingress:
  - from:
    - ipBlock:
        cidr: 10.0.0.0/8  # Internal network only
```

---

## Testing Mode

**No authentication** - Optimized for CI/CD and automated tests.

### Installation

**Local E2E testing:**

```bash
make e2e-setup  # Uses values-testing.yaml automatically
```

**CI/CD (GitHub Actions):**

Already configured in `.github/workflows/e2e.yml`

### Configuration

`chart/values-testing.yaml` includes:

```yaml
app:
  env:
    # Disable authentication
    N8N_BASIC_AUTH_ACTIVE: "false"

    # Simple URLs for testing
    N8N_HOST: localhost
    N8N_EDITOR_BASE_URL: http://localhost:5678

    # Verbose logging
    N8N_LOG_LEVEL: debug
    N8N_LOG_OUTPUT: console

# Disable HTTPRoute (use port-forward)
httpRoute:
  enabled: false

# Smaller resources for testing
ark:
  resources:
    limits:
      cpu: 200m
      memory: 256Mi
```

### Isolation from Orbstack/Docker Desktop

**Issue**: k3d may conflict with existing Docker environments.

**Solution**: The Makefile checks for port conflicts:

```bash
make e2e-setup
# Checks if port 5678 is in use
# Creates isolated k3d network: k3d-ark-test
```

If port 5678 is busy:

```bash
# Option 1: Stop conflicting service
docker ps | grep 5678
docker stop <container-id>

# Option 2: Use different port (future enhancement)
make e2e-setup E2E_PORT=5679
```

**k3d isolation features:**

- Uses custom Docker network: `k3d-ark-test`
- Separate from Orbstack networks
- Automatically cleaned up with `make e2e-cleanup`

### Port Conflict Resolution

```bash
# Check what's using port 5678
lsof -i :5678

# If Orbstack n8n is running:
# 1. Stop it temporarily
# 2. Run tests
# 3. Restart it

# Or: Use port-forward to different local port
kubectl port-forward svc/ark-n8n 5679:5678
# Access at http://localhost:5679
```

---

## Switching Between Modes

### Production → Demo

```bash
helm upgrade ark-n8n oci://ghcr.io/skokaina/charts/ark-n8n \
  --reuse-values \
  --set app.env.N8N_BASIC_AUTH_ACTIVE=false
```

### Demo → Production

```bash
helm upgrade ark-n8n oci://ghcr.io/skokaina/charts/ark-n8n \
  --reuse-values \
  --set app.env.N8N_BASIC_AUTH_ACTIVE=true \
  --set app.env.N8N_BASIC_AUTH_USER=admin \
  --set app.env.N8N_BASIC_AUTH_PASSWORD=secure-password
```

**Note**: Switching modes requires pod restart (automatic with `helm upgrade`).

---

## Authentication Methods

### 1. Basic Auth (Default)

```yaml
N8N_BASIC_AUTH_ACTIVE: "true"
N8N_BASIC_AUTH_USER: "admin"
N8N_BASIC_AUTH_PASSWORD: "password"
```

### 2. No Auth (Demo/Testing)

```yaml
N8N_BASIC_AUTH_ACTIVE: "false"
```

### 3. Owner Account (First-time setup)

When `N8N_BASIC_AUTH_ACTIVE` is not set:
- n8n prompts for owner account creation
- Email + password required
- Multi-user support

### 4. SSO (Advanced - requires n8n Enterprise)

```yaml
N8N_AUTH_TYPE: "saml"
# Additional SAML configuration...
```

---

## Environment Variables Reference

### Authentication

| Variable | Default | Description |
|----------|---------|-------------|
| `N8N_BASIC_AUTH_ACTIVE` | `true` | Enable/disable basic auth |
| `N8N_BASIC_AUTH_USER` | - | Basic auth username |
| `N8N_BASIC_AUTH_PASSWORD` | - | Basic auth password |

### Network

| Variable | Default | Description |
|----------|---------|-------------|
| `N8N_HOST` | - | Hostname for n8n instance |
| `N8N_PORT` | `5678` | Port for n8n server |
| `N8N_PROTOCOL` | `http` | http or https |
| `N8N_EDITOR_BASE_URL` | - | Base URL for editor |
| `WEBHOOK_URL` | - | URL for webhooks |

### Logging

| Variable | Default | Description |
|----------|---------|-------------|
| `N8N_LOG_LEVEL` | `info` | error, warn, info, debug |
| `N8N_LOG_OUTPUT` | `file` | console or file |

---

## Best Practices

### Production Deployments

1. ✅ **Always use authentication**
2. ✅ **Use HTTPS** with valid certificates
3. ✅ **Set strong passwords** (rotate regularly)
4. ✅ **Enable network policies**
5. ✅ **Monitor access logs**
6. ✅ **Regular backups** of workflow data

### Demo Deployments

1. ⚠️ **Network isolation** - Private networks only
2. ⚠️ **Temporary** - Delete after use
3. ⚠️ **No sensitive data** - Demo data only
4. ⚠️ **Document clearly** - Label as "DEMO - NO AUTH"

### Testing Deployments

1. ✅ **Isolated clusters** - Separate from production
2. ✅ **Automated cleanup** - Delete after tests
3. ✅ **Mock data only** - No real credentials
4. ✅ **CI/CD integration** - Automated testing

---

## Troubleshooting

### "Cannot access n8n UI"

**Check authentication settings:**

```bash
kubectl get deployment ark-n8n -o yaml | grep N8N_BASIC_AUTH
```

**If auth is enabled, provide credentials:**

```bash
# Via browser prompt
# Or set in values.yaml
```

### "Port 5678 already in use"

**Find conflicting process:**

```bash
lsof -i :5678
# OR
docker ps | grep 5678
```

**Solutions:**

1. Stop conflicting service
2. Use different port for new deployment
3. Use k3d's isolated network (automatic in E2E tests)

### "E2E tests fail with auth error"

**Ensure testing values are used:**

```bash
# Check if auth is disabled in test pod
kubectl exec deployment/ark-n8n -- env | grep N8N_BASIC_AUTH_ACTIVE
# Should output: N8N_BASIC_AUTH_ACTIVE=false
```

**If still enabled:**

```bash
helm upgrade ark-n8n ./chart -f chart/values-testing.yaml
```

---

## Quick Reference

```bash
# Production install (with auth)
helm install ark-n8n oci://ghcr.io/skokaina/charts/ark-n8n

# Demo install (no auth)
./install.sh --demo

# Testing install (local E2E)
make e2e-setup

# Check current auth status
kubectl exec deployment/ark-n8n -- env | grep N8N_BASIC_AUTH_ACTIVE

# Enable auth
helm upgrade ark-n8n oci://ghcr.io/skokaina/charts/ark-n8n \
  --set app.env.N8N_BASIC_AUTH_ACTIVE=true

# Disable auth (TESTING ONLY)
helm upgrade ark-n8n oci://ghcr.io/skokaina/charts/ark-n8n \
  --set app.env.N8N_BASIC_AUTH_ACTIVE=false
```
