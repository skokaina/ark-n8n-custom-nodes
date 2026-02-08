# Troubleshooting Guide

## Installation Issues

### Helm install fails

**Check Kubernetes connection:**
```bash
kubectl cluster-info
kubectl get nodes
```

**Verify Helm version:**
```bash
helm version  # Should be 3.x
```

**Check namespace:**
```bash
kubectl get namespace default
```

### ARK API not accessible

**Verify ARK is running:**
```bash
kubectl get pods -n ark-system
kubectl get svc -n ark-system
```

**Test ARK API:**
```bash
kubectl exec deployment/ark-n8n -- curl http://ark-api.ark-system.svc.cluster.local/health
```

**Common fixes:**
- Wrong namespace: Update `ark.apiUrl` in values.yaml
- ARK not installed: See [ARK quickstart](https://mckinsey.github.io/agents-at-scale-ark/quickstart/)
- Network policy blocking: Check Kubernetes NetworkPolicies

## n8n Access Issues

### Cannot access n8n UI

**Check pod status:**
```bash
kubectl get pods -l app.kubernetes.io/name=ark-n8n
kubectl logs deployment/ark-n8n --tail=50
```

**Verify port-forward:**
```bash
# Kill existing port-forwards
pkill -f "port-forward"

# Start new port-forward
kubectl port-forward svc/ark-n8n 5678:5678
```

**Check if port is in use:**
```bash
lsof -i :5678
```

### Authentication issues

**Disable auth for testing:**
```bash
helm upgrade ark-n8n oci://ghcr.io/skokaina/charts/ark-n8n \
  --reuse-values \
  --set app.env.N8N_BASIC_AUTH_ACTIVE=false
```

**Check auth settings:**
```bash
kubectl exec deployment/ark-n8n -- env | grep N8N_BASIC_AUTH
```

## Custom Node Issues

### Nodes not appearing in n8n

**Verify nodes are loaded:**
```bash
kubectl exec deployment/ark-n8n -- npm list -g n8n-nodes-ark
kubectl exec deployment/ark-n8n -- env | grep N8N_CUSTOM_EXTENSIONS
```

**Check logs for errors:**
```bash
kubectl logs deployment/ark-n8n | grep -i error
```

**Rebuild and redeploy:**
```bash
cd nodes
npm run build
docker build -t ark-n8n:fix .
# Update deployment with new image
```

### ARK credentials error

**Verify ARK API URL:**
```bash
# Should be accessible from pod
kubectl exec deployment/ark-n8n -- curl http://ark-api.ark-system.svc.cluster.local
```

**Common mistakes:**
- Missing `http://` prefix
- Wrong port (ARK API usually on port 80)
- Wrong namespace
- ARK not running

### Node execution fails

**Check ARK logs:**
```bash
kubectl logs deployment/ark-controller -n ark-system --tail=100
```

**Verify ARK resources exist:**
```bash
kubectl get agents,models,teams -n default
```

**Test ARK API directly:**
```bash
kubectl exec deployment/ark-n8n -- curl -X POST \
  http://ark-api.ark-system.svc.cluster.local/v1/namespaces/default/queries \
  -H "Content-Type: application/json" \
  -d '{"spec":{"input":"test","targets":[{"type":"agent","name":"your-agent"}]}}'
```

## Development Issues

### DevSpace fails to start

**Check Docker:**
```bash
docker info
```

**Clean DevSpace cache:**
```bash
devspace purge
devspace clean
```

**Rebuild:**
```bash
cd nodes && npm run build
devspace dev
```

### Tests failing

**Install dependencies:**
```bash
cd nodes
rm -rf node_modules package-lock.json
npm install
```

**Run with verbose output:**
```bash
npm test -- --verbose
```

**Check coverage:**
```bash
npm run test:coverage
```

## E2E Test Issues

### k3d cluster creation fails

**Port conflict:**
```bash
lsof -i :5678
# Stop conflicting service
```

**Docker issues:**
```bash
docker ps
docker system prune  # Clean up resources
```

**Start fresh:**
```bash
make e2e-cleanup
make e2e-setup
```

### ARK installation fails in E2E

**Check ark CLI:**
```bash
ark --version
npm list -g @agents-at-scale/ark
```

**Reinstall ark CLI:**
```bash
npm uninstall -g @agents-at-scale/ark
npm install -g @agents-at-scale/ark
```

**Manual installation:**
```bash
kubectl create namespace ark-system
ark install --yes --verbose
```

### Playwright tests timeout

**Increase timeout:**

Edit `e2e/playwright.config.ts`:
```typescript
timeout: 120000,  // 2 minutes
```

**Check n8n logs:**
```bash
kubectl logs deployment/ark-n8n
```

**Verify n8n is ready:**
```bash
curl http://localhost:5678
```

## Performance Issues

### High memory usage

**Check pod resources:**
```bash
kubectl top pod -l app.kubernetes.io/name=ark-n8n
```

**Increase limits:**
```yaml
app:
  resources:
    limits:
      memory: 1Gi
```

### Slow workflow execution

**Check ARK performance:**
```bash
kubectl logs deployment/ark-controller -n ark-system
```

**Enable n8n caching:**
```yaml
app:
  env:
    EXECUTIONS_DATA_SAVE_ON_SUCCESS: "none"
```

## Common Error Messages

### "ARK API not found"
- Check `ark.apiUrl` in values.yaml
- Verify ARK is running: `kubectl get pods -n ark-system`

### "Agent 'xyz' not found"
- List agents: `kubectl get agents -n default`
- Create agent in ARK first

### "Insufficient permissions"
- Check RBAC settings
- Verify service account has correct permissions

### "Connection refused"
- ARK API not running
- Network policy blocking traffic
- Wrong port/URL

## Getting Help

1. **Check logs:**
   ```bash
   kubectl logs deployment/ark-n8n --tail=100
   kubectl logs deployment/ark-controller -n ark-system --tail=100
   ```

2. **Describe resources:**
   ```bash
   kubectl describe pod <pod-name>
   kubectl describe deployment ark-n8n
   ```

3. **Check events:**
   ```bash
   kubectl get events --sort-by='.lastTimestamp'
   ```

4. **Open issue:** https://github.com/skokaina/ark-n8n-custom-nodes/issues

Include:
- Output of above commands
- Steps to reproduce
- Expected vs actual behavior
- Versions (n8n, ARK, Kubernetes)
