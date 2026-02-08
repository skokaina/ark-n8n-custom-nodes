# E2E Test Credentials

## Default n8n Account

When running E2E tests, n8n is automatically configured with a default owner account:

```json
{
  "email": "admin@example.com",
  "firstName": "Admin",
  "lastName": "User",
  "password": "Admin123!@#"
}
```

## Auto-Setup Process

The `make e2e-setup` command automatically:
1. Creates k3d cluster and installs ARK
2. Deploys n8n with ARK custom nodes
3. Runs `scripts/setup-n8n-account.js` to create default account
4. Saves credentials to `/tmp/n8n-default-creds.json`

## Manual Login

If you need to log in manually:

```bash
kubectl port-forward svc/ark-n8n 5678:5678
# Open http://localhost:5678
# Email: admin@example.com
# Password: Admin123!@#
```

## Custom Credentials

Set custom credentials via environment variables:

```bash
N8N_EMAIL=custom@example.com \
N8N_PASSWORD=MyPassword123! \
make e2e-setup
```

## Production Deployments

⚠️ **WARNING:** Default credentials are for testing only!

For production:
1. Use real authentication (see [Deployment Modes](./DEPLOYMENT_MODES.md))
2. Set strong passwords
3. Enable HTTPS/TLS
4. Configure user management properly

## Bypassing Authentication

We tried several approaches to bypass n8n authentication:

| Method | Works? | Notes |
|--------|--------|-------|
| `N8N_BASIC_AUTH_ACTIVE=false` | ❌ | Only disables HTTP basic auth |
| `N8N_USER_MANAGEMENT_DISABLED=true` | ❌ | Ignored in current n8n versions |
| Direct navigation to `/workflows` | ❌ | Redirects to `/setup` |
| Auto-create owner account | ✅ | **Current solution** |

The auto-setup script is the most reliable approach for E2E testing.
