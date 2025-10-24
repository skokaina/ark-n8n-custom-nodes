## Troubleshooting

### Nodes Not Appearing

If ARK nodes don't appear in n8n:

```bash
# Check if custom nodes are installed
kubectl exec -it deployment/ark-n8n -- npm list -g n8n-nodes-ark

# Verify environment variable
kubectl exec -it deployment/ark-n8n -- env | grep N8N_CUSTOM_EXTENSIONS

# Check n8n logs
kubectl logs deployment/ark-n8n -f
```

### ARK API Connection Issues

Test connectivity from n8n pod:

```bash
# Test ARK API connection
kubectl exec -it deployment/ark-n8n -- wget -qO- http://ark-api.default.svc.cluster.local:80/v1/agents

# Check ARK API service
kubectl get svc ark-api
kubectl get pods -l app=ark-api
```

### Workflows Failing

Debug workflow execution:

```bash
# Check n8n execution logs
kubectl logs deployment/ark-n8n -f

# Verify ARK resources exist
kubectl get agents,models
```

### Performance Issues

Monitor and optimize:

```bash
# Check resource usage
kubectl top pods -l app=ark-n8n

# Monitor ARK API performance
kubectl logs -l app=ark-api -f

# Review workflow execution times in n8n UI
```
