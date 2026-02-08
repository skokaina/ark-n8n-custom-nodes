# Production Guide

## Security

### Authentication

**Enable n8n authentication:**

```yaml
app:
  env:
    N8N_BASIC_AUTH_ACTIVE: "true"
    N8N_BASIC_AUTH_USER: "admin"
    N8N_BASIC_AUTH_PASSWORD: "secure-password"
```

Or on first access, create owner account via n8n UI.

### HTTPS/TLS

**Enable TLS:**

```yaml
app:
  env:
    N8N_PROTOCOL: https
    N8N_SECURE_COOKIE: "true"

httpRoute:
  tls:
    enabled: true
    certificateRef:
      name: n8n-tls-cert
```

### Network Policies

**Restrict cluster access:**

```yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: ark-n8n-access
spec:
  podSelector:
    matchLabels:
      app: ark-n8n
  policyTypes:
  - Ingress
  ingress:
  - from:
    - namespaceSelector:
        matchLabels:
          name: trusted-namespace
```

### RBAC

Implement Kubernetes RBAC for pod service accounts.

## Monitoring

### Workflow Metrics

Monitor via n8n's built-in metrics:
- Execution success/failure rates
- Workflow duration
- Active workflows

### Resource Usage

Track via Kubernetes metrics:

```bash
kubectl top pod -l app.kubernetes.io/name=ark-n8n
```

### ARK Integration Metrics

Monitor:
- Agent response times
- Query success rates
- API latency
- Token usage and costs

### Error Tracking

Set up alerting for failed workflows:

```yaml
app:
  env:
    N8N_LOG_LEVEL: error
    N8N_LOG_OUTPUT: file
```

## Scaling

### Horizontal Scaling

**Multiple n8n replicas:**

```yaml
replicaCount: 3

storage:
  enabled: true
  accessMode: ReadWriteMany  # Shared storage required
```

**Notes:**
- Requires shared storage (NFS, EFS, etc.)
- Use external database for workflow data
- Load balancer for traffic distribution

### Agent Scaling

Configure ARK agent auto-scaling based on workload.

### Evaluation Scaling

Distribute evaluation workloads across multiple evaluators.

### Database Scaling

**Use external PostgreSQL:**

```yaml
app:
  env:
    DB_TYPE: postgresdb
    DB_POSTGRESDB_HOST: postgres.example.com
    DB_POSTGRESDB_PORT: "5432"
    DB_POSTGRESDB_DATABASE: n8n
    DB_POSTGRESDB_USER: n8n
    DB_POSTGRESDB_PASSWORD: secure-password
```

## High Availability

### Pod Disruption Budgets

```yaml
apiVersion: policy/v1
kind: PodDisruptionBudget
metadata:
  name: ark-n8n-pdb
spec:
  minAvailable: 1
  selector:
    matchLabels:
      app: ark-n8n
```

### Health Checks

Configured automatically in Helm chart:

```yaml
livenessProbe:
  httpGet:
    path: /healthz
    port: 5678

readinessProbe:
  httpGet:
    path: /healthz
    port: 5678
```

### Backup Strategy

**Backup workflows:**

```bash
# Export all workflows
kubectl exec deployment/ark-n8n -- n8n export:workflow --all --output=/tmp/workflows.json

# Copy to local
kubectl cp ark-n8n:/tmp/workflows.json ./backup/workflows-$(date +%Y%m%d).json
```

**Backup credentials (encrypted):**

```bash
kubectl exec deployment/ark-n8n -- n8n export:credentials --all --output=/tmp/credentials.json
kubectl cp ark-n8n:/tmp/credentials.json ./backup/credentials-$(date +%Y%m%d).json
```

## Best Practices

1. ✅ **Always use authentication in production**
2. ✅ **Enable HTTPS with valid certificates**
3. ✅ **Set resource limits and requests**
4. ✅ **Use external database for production**
5. ✅ **Monitor execution metrics and errors**
6. ✅ **Regular backups of workflows and credentials**
7. ✅ **Network policies for pod isolation**
8. ✅ **Secrets management (not in values.yaml)**

## Disaster Recovery

### Restore from Backup

```bash
# Import workflows
kubectl cp ./backup/workflows.json ark-n8n:/tmp/workflows.json
kubectl exec deployment/ark-n8n -- n8n import:workflow --input=/tmp/workflows.json

# Import credentials
kubectl cp ./backup/credentials.json ark-n8n:/tmp/credentials.json
kubectl exec deployment/ark-n8n -- n8n import:credentials --input=/tmp/credentials.json
```

### Rolling Updates

Helm automatically handles rolling updates:

```bash
helm upgrade ark-n8n oci://ghcr.io/skokaina/charts/ark-n8n \
  --version 0.0.6 \
  --reuse-values
```

See [Troubleshooting Guide](./TROUBLESHOOTING.md) for common production issues.
