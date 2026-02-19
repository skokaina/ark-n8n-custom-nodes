#!/bin/bash
set -e

# ARK n8n Custom Nodes - Quick Install Script
# Installs ARK n8n with auto-configuring nginx proxy

echo "🚀 Installing ARK n8n Custom Nodes..."
echo ""

# Check prerequisites
if ! command -v helm &> /dev/null; then
    echo "❌ Error: Helm is not installed"
    echo "   Install: https://helm.sh/docs/intro/install/"
    exit 1
fi

if ! command -v kubectl &> /dev/null; then
    echo "❌ Error: kubectl is not installed"
    echo "   Install: https://kubernetes.io/docs/tasks/tools/"
    exit 1
fi

if ! kubectl cluster-info &> /dev/null; then
    echo "❌ Error: Not connected to a Kubernetes cluster"
    echo "   Configure kubectl first"
    exit 1
fi

# Get latest version
echo "🔍 Fetching latest version..."
LATEST_VERSION=$(curl -s https://api.github.com/repos/skokaina/ark-n8n-custom-nodes/releases/latest | grep '"tag_name"' | sed -E 's/.*"v([^"]+)".*/\1/')

if [ -z "$LATEST_VERSION" ]; then
    echo "⚠️  Could not fetch latest version, using 'latest'"
    VERSION_FLAG=""
else
    echo "📦 Latest version: v$LATEST_VERSION"
    VERSION_FLAG="--version $LATEST_VERSION"
fi

# Install
echo ""
echo "🔧 Installing ARK n8n..."
echo "   • Storage: 1Gi PVC (always enabled)"
echo "   • Auto-login: Enabled (demo mode)"
echo "   • Domain: Auto-configured (works with any domain)"
echo ""

helm upgrade --install ark-n8n \
  oci://ghcr.io/skokaina/charts/ark-n8n \
  $VERSION_FLAG \
  --wait \
  --timeout 5m

echo ""
echo "✅ ARK n8n installed successfully!"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Quick Start"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "📝 Access n8n:"
echo "   kubectl port-forward svc/ark-n8n-proxy 8080:80"
echo "   Open: http://localhost:8080"
echo ""
echo "🔐 Default credentials (demo mode):"
echo "   Email: admin@example.com"
echo "   Password: Admin123!@#"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Production Setup"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "📍 The nginx proxy auto-configures for any domain!"
echo "   Just point your LoadBalancer/Ingress to:"
echo "   • Service: ark-n8n-proxy"
echo "   • Port: 80"
echo ""
echo "🔒 Disable demo mode for production:"
echo "   helm upgrade ark-n8n oci://ghcr.io/skokaina/charts/ark-n8n \\"
echo "     --set demo.enabled=false \\"
echo "     --reuse-values"
echo ""
echo "📦 Storage:"
echo "   • 1Gi PVC created automatically"
echo "   • Resize: kubectl edit pvc ark-n8n-pvc"
echo ""
echo "📚 Documentation:"
echo "   https://github.com/skokaina/ark-n8n-custom-nodes#readme"
echo ""
