#!/bin/bash
set -e

# ARK n8n Custom Nodes - Quick Install Script
# Installs ARK n8n custom nodes via Helm

echo "🚀 Installing ARK n8n Custom Nodes..."
echo ""

# Check if helm is installed
if ! command -v helm &> /dev/null; then
    echo "❌ Error: Helm is not installed"
    echo "   Install Helm: https://helm.sh/docs/intro/install/"
    exit 1
fi

# Check if kubectl is installed
if ! command -v kubectl &> /dev/null; then
    echo "❌ Error: kubectl is not installed"
    echo "   Install kubectl: https://kubernetes.io/docs/tasks/tools/"
    exit 1
fi

# Check if connected to a cluster
if ! kubectl cluster-info &> /dev/null; then
    echo "❌ Error: Not connected to a Kubernetes cluster"
    echo "   Configure kubectl to connect to your cluster"
    exit 1
fi

# Get latest version from GitHub API
LATEST_VERSION=$(curl -s https://api.github.com/repos/skokaina/ark-n8n-custom-nodes/releases/latest | grep '"tag_name"' | sed -E 's/.*"v([^"]+)".*/\1/')

if [ -z "$LATEST_VERSION" ]; then
    echo "⚠️  Could not fetch latest version, using 'latest'"
    VERSION_FLAG=""
else
    echo "📦 Latest version: v$LATEST_VERSION"
    VERSION_FLAG="--version $LATEST_VERSION"
fi

# Install or upgrade
echo ""
echo "Installing ARK n8n..."
helm upgrade --install ark-n8n \
  oci://ghcr.io/skokaina/charts/ark-n8n \
  $VERSION_FLAG \
  --wait \
  --timeout 5m

echo ""
echo "✅ ARK n8n installed successfully!"
echo ""
echo "📝 Next steps:"
echo "   1. Port-forward to access n8n:"
echo "      kubectl port-forward svc/ark-n8n-proxy 8080:80"
echo ""
echo "   2. Open in browser:"
echo "      http://localhost:8080"
echo ""
echo "   3. Default credentials (demo mode):"
echo "      Email: admin@example.com"
echo "      Password: Admin123!@#"
echo ""
echo "   For production setup, see: https://github.com/skokaina/ark-n8n-custom-nodes#readme"
echo ""
