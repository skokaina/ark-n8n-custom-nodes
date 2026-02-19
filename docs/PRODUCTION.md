# Production Guide

This guide covers deploying ARK n8n in production with security, monitoring, scaling, and high availability.

## Quick Production Setup

### Prerequisites
- Kubernetes cluster with ARK installed
- kubectl and Helm 3.x configured
- LoadBalancer or Ingress controller
- (Optional) cert-manager for HTTPS

### Installation

**One-line install:**
```bash
curl -fsSL https://raw.githubusercontent.com/skokaina/ark-n8n-custom-nodes/main/install.sh | bash
```

**Or with Helm:**
```bash
helm install ark-n8n oci://ghcr.io/skokaina/charts/ark-n8n
```

### Disable Demo Mode

**CRITICAL for production - disable auto-login:**
```bash
helm upgrade ark-n8n oci://ghcr.io/skokaina/charts/ark-n8n \
  --set demo.enabled=false \
  --reuse-values
```

After disabling demo mode, create your admin account via the n8n UI on first access.

### Domain Configuration

**The nginx proxy auto-configures for any domain!**

1. **Configure LoadBalancer or Ingress:**
   ```yaml
   # Point to the nginx proxy service
   Service: ark-n8n-proxy
   Port: 80
   ```

2. **Set DNS:**
   ```bash
   # Point your domain to the LoadBalancer IP
   n8n.example.com → <LoadBalancer-IP>
   ```

3. **Done!**
   - The proxy automatically adapts to your domain
   - No N8N_HOST configuration needed
   - Works with HTTP or HTTPS

**Example LoadBalancer:**
```yaml
apiVersion: v1
kind: Service
metadata:
  name: ark-n8n-lb
spec:
  type: LoadBalancer
  selector:
    app.kubernetes.io/component: proxy
  ports:
  - port: 80
    targetPort: 8080
    name: http
  - port: 443
    targetPort: 8080
    name: https
```

**Example Ingress:**
```yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: ark-n8n-ingress
  annotations:
    cert-manager.io/cluster-issuer: letsencrypt-prod
spec:
  ingressClassName: nginx
  tls:
  - hosts:
    - n8n.example.com
    secretName: n8n-tls
  rules:
  - host: n8n.example.com
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: ark-n8n-proxy
            port:
              number: 80
```

### Enable HTTPS (Recommended)

**Option 1: cert-manager (automatic certificates)**
```bash
# Install cert-manager
kubectl apply -f https://github.com/cert-manager/cert-manager/releases/download/v1.13.0/cert-manager.yaml

# Create ClusterIssuer
kubectl apply -f - <<EOF
apiVersion: cert-manager.io/v1
kind: ClusterIssuer
metadata:
  name: letsencrypt-prod
spec:
  acme:
    server: https://acme-v02.api.letsencrypt.org/directory
    email: admin@example.com
    privateKeySecretRef:
      name: letsencrypt-prod
    solvers:
    - http01:
        ingress:
          class: nginx
EOF

# Ingress will automatically get certificates
```

**Option 2: AWS ACM (for AWS LoadBalancer)**
```yaml
service:
  type: LoadBalancer
  annotations:
    service.beta.kubernetes.io/aws-load-balancer-ssl-cert: "arn:aws:acm:..."
    service.beta.kubernetes.io/aws-load-balancer-backend-protocol: "http"
    service.beta.kubernetes.io/aws-load-balancer-ssl-ports: "443"
```

**Option 3: Existing certificates**
```bash
kubectl create secret tls n8n-tls \
  --cert=path/to/cert.pem \
  --key=path/to/key.pem
```

### Storage Management

**Default configuration:**
- 1Gi PVC (always enabled)
- Stores workflows, credentials, and execution history
- Automatically created on install

**Resize storage:**
```bash
# Method 1: Edit PVC directly
kubectl edit pvc ark-n8n-pvc

# Method 2: During install
helm install ark-n8n oci://ghcr.io/skokaina/charts/ark-n8n \
  --set storage.size=10Gi

# Method 3: Upgrade existing deployment
helm upgrade ark-n8n oci://ghcr.io/skokaina/charts/ark-n8n \
  --set storage.size=10Gi \
  --reuse-values
```

**Monitor storage usage:**
```bash
kubectl exec deployment/ark-n8n -- df -h /home/node/.n8n
```

### Quick Security Checklist

After installation:
- ✅ Disable demo mode (`--set demo.enabled=false`)
- ✅ Create admin account via n8n UI
- ✅ Enable HTTPS with valid certificates
- ✅ Use strong passwords (12+ characters)
- ✅ Configure 2FA in n8n settings (if available)
- ✅ Restrict network access via NetworkPolicies
- ✅ Set up regular backups (see [Backup Strategy](#backup-strategy))

---

## Security

### Authentication

**Production authentication (recommended):**

```bash
# Disable demo mode to enable proper authentication
helm upgrade ark-n8n oci://ghcr.io/skokaina/charts/ark-n8n \
  --set demo.enabled=false \
  --reuse-values
```

After disabling demo mode, n8n will prompt you to create an owner account on first access with:
- Email address
- Strong password (12+ characters)
- Optional 2FA setup

**Legacy basic auth (not recommended):**
```yaml
app:
  env:
    N8N_BASIC_AUTH_ACTIVE: "true"
    N8N_BASIC_AUTH_USER: "admin"
    N8N_BASIC_AUTH_PASSWORD: "secure-password"
```

**User management:**
- Owner account created on first access
- Add additional users via Settings → Users
- Configure role-based permissions
- Enable 2FA for all users (Settings → Security)

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
