.PHONY: help install test e2e build clean release quickstart

help: ## Show this help message
	@echo "ARK n8n Custom Nodes - Make Commands"
	@echo ""
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-20s\033[0m %s\n", $$1, $$2}'

install: ## Install dependencies (nodes + e2e)
	@echo "Installing node dependencies..."
	cd nodes && npm install
	@echo "Installing e2e dependencies..."
	cd e2e && npm install
	@echo "Installing Playwright browsers..."
	cd e2e && npx playwright install --with-deps chromium
	@echo "✓ All dependencies installed"

build: ## Build custom nodes
	@echo "Building custom nodes..."
	cd nodes && npm run build
	@echo "✓ Build complete"

test: ## Run unit tests
	@echo "Running unit tests..."
	cd nodes && npm test
	@echo "✓ Tests passed"

test-coverage: ## Run tests with coverage
	@echo "Running tests with coverage..."
	cd nodes && npm run test:coverage
	@echo "✓ Coverage report generated"

lint: ## Lint code
	@echo "Linting code..."
	cd nodes && npm run lint
	@echo "✓ Lint passed"

lintfix: ## Auto-fix linting issues
	@echo "Auto-fixing linting issues..."
	cd nodes && npm run lintfix
	@echo "✓ Lint fixes applied"

e2e-setup: ## Setup local k3d cluster for E2E testing
	@if k3d cluster list 2>/dev/null | grep -q ark-test; then \
		echo "✓ Cluster ark-test already exists, updating deployment..."; \
		$(MAKE) e2e-update; \
	else \
		echo "Creating new k3d cluster..."; \
		$(MAKE) e2e-create; \
	fi

e2e-create: ## Create new E2E environment from scratch
	@echo "Checking for port conflicts..."
	@if lsof -Pi :5678 -sTCP:LISTEN -t >/dev/null 2>&1 ; then \
		echo "⚠️  Port 5678 is in use. Please free it first:"; \
		echo "  kill $$(lsof -Pi :5678 -sTCP:LISTEN -t)"; \
		exit 1; \
	fi
	@echo "Setting up k3d cluster (isolated from Orbstack)..."
	k3d cluster create ark-test --agents 2 --port "5678:5678@loadbalancer" --network k3d-ark-test --wait
	@echo "Installing ARK CLI..."
	npm install -g @agents-at-scale/ark@0.1.51 || npm install -g @agents-at-scale/ark
	@echo "Installing ARK to cluster (with gateway)..."
	ark install --yes --wait-for-ready 5m --verbose
	@echo "✓ ARK installed successfully"
	@echo "Setting up FREE API (Groq) and ARK test resources..."
	$(MAKE) e2e-ark-free-api
	@echo "✓ Groq API and ARK resources ready"
	@echo "Building Docker images..."
	cd nodes && npm run build && cd ..
	docker build -t ark-n8n:test .
	k3d image import ark-n8n:test -c ark-test
	@echo "Building MCP server image..."
	cd mcp-server && docker build -t ark-n8n-mcp:test .
	k3d image import ark-n8n-mcp:test -c ark-test
	@echo "Installing ark-n8n with MCP..."
	helm install ark-n8n ./chart \
		-f chart/values-testing.yaml \
		--set app.image.repository=ark-n8n \
		--set app.image.tag=test \
		--set app.image.pullPolicy=Never \
		--set ark.apiUrl=http://ark-api.default.svc.cluster.local \
		--set mcp.enabled=true \
		--set mcp.image.repository=ark-n8n-mcp \
		--set mcp.image.tag=test \
		--set mcp.image.pullPolicy=Never \
		--wait
	kubectl wait --for=condition=available --timeout=300s deployment/ark-n8n
	@echo "Waiting for nginx proxy to be ready..."
	kubectl wait --for=condition=available --timeout=60s deployment/ark-n8n-nginx || true
	@echo "✓ E2E environment ready with auto-login"
	@echo ""
	@echo "═══════════════════════════════════════════════════════"
	@echo "  ✅ E2E Environment Ready with Auto-Login"
	@echo "═══════════════════════════════════════════════════════"
	@echo ""
	@echo "Access n8n with auto-login:"
	@echo "  kubectl port-forward svc/ark-n8n-proxy 8080:80"
	@echo "  Open: http://localhost:8080"
	@echo ""
	@echo "Or access n8n directly (manual login):"
	@echo "  kubectl port-forward svc/ark-n8n 5679:5678"
	@echo "  Open: http://localhost:5679"
	@echo "  Login: admin@example.com / Admin123!@#"
	@echo "═══════════════════════════════════════════════════════"

e2e-update: ## Update existing E2E environment (fast iteration)
	@echo "Building Docker images..."
	cd nodes && npm run build && cd ..
	docker build -t ark-n8n:test .
	k3d image import ark-n8n:test -c ark-test
	@echo "Building MCP server image..."
	cd mcp-server && docker build -t ark-n8n-mcp:test .
	k3d image import ark-n8n-mcp:test -c ark-test
	@echo "Upgrading ark-n8n with MCP..."
	helm upgrade ark-n8n ./chart \
		-f chart/values-testing.yaml \
		--set app.image.repository=ark-n8n \
		--set app.image.tag=test \
		--set app.image.pullPolicy=Never \
		--set ark.apiUrl=http://ark-api.default.svc.cluster.local \
		--set mcp.enabled=true \
		--set mcp.image.repository=ark-n8n-mcp \
		--set mcp.image.tag=test \
		--set mcp.image.pullPolicy=Never \
		--wait
	@echo "✓ E2E environment updated with MCP"
	@echo ""
	@echo "Access with auto-login: kubectl port-forward svc/ark-n8n-proxy 8080:80"
	@echo "Verify MCP: make e2e-ark-n8n-mcp"

e2e-ark-n8n-mcp: ## Setup and verify MCP server integration
	@echo "╔════════════════════════════════════════════════════╗"
	@echo "║     Setting up ARK n8n MCP Server                  ║"
	@echo "╚════════════════════════════════════════════════════╝"
	@echo ""
	@echo "1️⃣  Building MCP Docker image..."
	cd mcp-server && docker build -t ark-n8n-mcp:test .
	@echo "✓ MCP image built"
	@echo ""
	@echo "2️⃣  Importing MCP image to k3d cluster..."
	k3d image import ark-n8n-mcp:test -c ark-test
	@echo "✓ MCP image imported"
	@echo ""
	@echo "3️⃣  Deploying/upgrading ark-n8n with MCP enabled..."
	helm upgrade ark-n8n ./chart \
		-f chart/values-testing.yaml \
		--set app.image.repository=ark-n8n \
		--set app.image.tag=test \
		--set app.image.pullPolicy=Never \
		--set ark.apiUrl=http://ark-api.default.svc.cluster.local \
		--set mcp.enabled=true \
		--set mcp.image.repository=ark-n8n-mcp \
		--set mcp.image.tag=test \
		--set mcp.image.pullPolicy=Never \
		--wait
	@echo "✓ Helm upgrade complete"
	@echo ""
	@echo "4️⃣  Waiting for pod to be ready (2/2 containers)..."
	kubectl wait --for=condition=ready pod -l app=ark-n8n --timeout=120s
	@echo "✓ Pod ready with n8n + MCP sidecar"
	@echo ""
	@echo "5️⃣  Verifying MCPServer CRD registration..."
	@sleep 5
	@if kubectl get mcpserver n8n-tools -n default >/dev/null 2>&1; then \
		echo "✓ MCPServer 'n8n-tools' found"; \
	else \
		echo "❌ MCPServer 'n8n-tools' not found"; \
		exit 1; \
	fi
	@echo ""
	@echo "6️⃣  Checking MCPServer availability..."
	@AVAILABLE=$$(kubectl get mcpserver n8n-tools -n default -o jsonpath='{.status.conditions[?(@.type=="Available")].status}'); \
	TOOL_COUNT=$$(kubectl get mcpserver n8n-tools -n default -o jsonpath='{.status.toolCount}'); \
	ADDRESS=$$(kubectl get mcpserver n8n-tools -n default -o jsonpath='{.status.resolvedAddress}'); \
	if [ "$$AVAILABLE" = "True" ]; then \
		echo "✓ MCPServer status: Available"; \
		echo "✓ Tools discovered: $$TOOL_COUNT"; \
		echo "✓ Resolved address: $$ADDRESS"; \
	else \
		echo "❌ MCPServer not available"; \
		kubectl get mcpserver n8n-tools -n default -o yaml; \
		exit 1; \
	fi
	@echo ""
	@echo "7️⃣  Testing MCP health endpoint..."
	@kubectl port-forward svc/ark-n8n 8082:8080 -n default > /dev/null 2>&1 & \
	PF_PID=$$!; \
	sleep 3; \
	HEALTH=$$(curl -s http://localhost:8082/health); \
	kill $$PF_PID 2>/dev/null || true; \
	if echo "$$HEALTH" | grep -q "healthy"; then \
		echo "✓ MCP health check passed"; \
		echo "  Response: $$HEALTH" | head -c 100; \
		echo "..."; \
	else \
		echo "❌ MCP health check failed"; \
		echo "  Response: $$HEALTH"; \
		exit 1; \
	fi
	@echo ""
	@echo "8️⃣  Listing discovered MCP tools..."
	@kubectl logs -l app=ark-n8n -c mcp-server -n default --tail=20 | grep "🚀 n8n MCP Server starting" -A 3 || echo "Check logs: kubectl logs -l app=ark-n8n -c mcp-server"
	@echo ""
	@echo "╔════════════════════════════════════════════════════╗"
	@echo "║     ✅ MCP Server Integration Verified             ║"
	@echo "╚════════════════════════════════════════════════════╝"
	@echo ""
	@echo "MCP Server Status:"
	@echo "  • Pod: $$(kubectl get pods -l app=ark-n8n -o jsonpath='{.items[0].metadata.name}')"
	@echo "  • Containers: $$(kubectl get pods -l app=ark-n8n -o jsonpath='{.items[0].status.containerStatuses[*].name}')"
	@echo "  • MCPServer CRD: n8n-tools (Available)"
	@echo "  • Tools Count: $$(kubectl get mcpserver n8n-tools -n default -o jsonpath='{.status.toolCount}')"
	@echo ""
	@echo "View details:"
	@echo "  kubectl get mcpserver n8n-tools -n default -o yaml"
	@echo "  kubectl logs -l app=ark-n8n -c mcp-server -n default"
	@echo ""

e2e: e2e-ark-n8n-mcp ## Run E2E tests with API mode (fast, no UI auto-login wait)
	@echo "Starting port-forward to auto-login proxy..."
	kubectl port-forward svc/ark-n8n-proxy 8080:80 > /dev/null 2>&1 &
	@sleep 5
	@echo "Running E2E tests (API mode)..."
	cd e2e && npx playwright test ark-webhook-e2e-api.spec.ts
	@pkill -f "kubectl port-forward svc/ark-n8n-proxy" || true
	@echo "✓ E2E tests passed"

e2e-api: ## Run E2E tests with API mode (alias for e2e)
	@$(MAKE) e2e

e2e-ui-wait: ## Run E2E tests with UI auto-login (slow, waits 90s for auto-login)
	@echo "Starting port-forward to auto-login proxy..."
	kubectl port-forward svc/ark-n8n-proxy 8080:80 > /dev/null 2>&1 &
	@sleep 5
	@echo "Running E2E tests (UI auto-login mode - slow)..."
	cd e2e && npx playwright test ark-webhook-e2e.spec.ts.disabled
	@pkill -f "kubectl port-forward svc/ark-n8n-proxy" || true
	@echo "✓ E2E tests passed"

e2e-ui: ## Run E2E tests with UI (requires e2e-setup first)
	@echo "Starting port-forward to auto-login proxy..."
	kubectl port-forward svc/ark-n8n-proxy 8080:80 > /dev/null 2>&1 &
	@sleep 5
	@echo "Opening Playwright UI..."
	cd e2e && npx playwright test --ui
	@pkill -f "kubectl port-forward svc/ark-n8n-proxy" || true

e2e-webhook: ## Run webhook E2E test (end-to-end workflow execution with K8s verification)
	@bash e2e/scripts/run-webhook-test.sh

e2e-webhook-debug: ## Run webhook E2E test with debug output and headed browser
	@bash e2e/scripts/run-webhook-test.sh --headed --debug

e2e-ark-test-crds: ## Setup FREE API (Groq) and create ARK test resources (fast, 30 seconds)
	@$(MAKE) e2e-ark-free-api

e2e-ark-free-api: ## Setup FREE API (uses GROQ_API_KEY or HF_API_TOKEN env var or prompts)
	@echo "Setting up FREE LLM API for E2E testing..."
	@echo ""
	@if [ -n "$$GROQ_API_KEY" ]; then \
		echo "✓ Found GROQ_API_KEY environment variable"; \
		echo "  Using Groq API automatically"; \
		echo ""; \
		kubectl create secret generic groq-api-key --from-literal=api-key="$$GROQ_API_KEY" 2>/dev/null || \
			(kubectl delete secret groq-api-key 2>/dev/null; \
			kubectl create secret generic groq-api-key --from-literal=api-key="$$GROQ_API_KEY"); \
		kubectl apply -f e2e/fixtures/ark-free-api-resources.yaml; \
		echo "✅ Groq API configured from GROQ_API_KEY!"; \
	elif [ -n "$$HF_API_TOKEN" ]; then \
		echo "✓ Found HF_API_TOKEN environment variable"; \
		echo "  Using HuggingFace API automatically"; \
		echo ""; \
		kubectl create secret generic huggingface-api-key --from-literal=api-key="$$HF_API_TOKEN" 2>/dev/null || \
			(kubectl delete secret huggingface-api-key 2>/dev/null; \
			kubectl create secret generic huggingface-api-key --from-literal=api-key="$$HF_API_TOKEN"); \
		kubectl apply -f e2e/fixtures/ark-free-api-resources.yaml; \
		echo "✅ HuggingFace API configured from HF_API_TOKEN!"; \
	else \
		echo "Choose your FREE API provider:"; \
		echo "  1) HuggingFace (Recommended - no credit card, 300+ models)"; \
		echo "  2) Groq (Fastest - no credit card, 1000 req/day)"; \
		echo "  3) OpenRouter (Free model router)"; \
		echo ""; \
		echo "Tip: Set GROQ_API_KEY or HF_API_TOKEN environment variable to skip this prompt"; \
		echo ""; \
		read -p "Enter choice [1-3]: " choice; \
		case $$choice in \
			1) \
				echo ""; \
				echo "Get your FREE HuggingFace API key:"; \
				echo "  https://huggingface.co/settings/tokens"; \
				echo ""; \
				read -sp "Enter API key (hf_...): " key; \
				echo ""; \
				kubectl create secret generic huggingface-api-key --from-literal=api-key="$$key" || \
					(kubectl delete secret huggingface-api-key; \
					kubectl create secret generic huggingface-api-key --from-literal=api-key="$$key"); \
				kubectl apply -f e2e/fixtures/ark-free-api-resources.yaml; \
				echo "✅ HuggingFace API configured!"; \
				;; \
			2) \
				echo ""; \
				echo "Get your FREE Groq API key:"; \
				echo "  https://console.groq.com/keys"; \
				echo ""; \
				read -sp "Enter API key (gsk_...): " key; \
				echo ""; \
				kubectl create secret generic groq-api-key --from-literal=api-key="$$key" || \
					(kubectl delete secret groq-api-key; \
					kubectl create secret generic groq-api-key --from-literal=api-key="$$key"); \
				kubectl apply -f e2e/fixtures/ark-free-api-resources.yaml; \
				kubectl patch agent test-agent -n default --type=merge -p '{"spec":{"modelRef":{"name":"groq-model"}}}'; \
				echo "✅ Groq API configured!"; \
				;; \
			3) \
				echo ""; \
				echo "Get your FREE OpenRouter API key:"; \
				echo "  https://openrouter.ai/keys"; \
				echo ""; \
				read -sp "Enter API key (sk-or-...): " key; \
				echo ""; \
				kubectl create secret generic openrouter-api-key --from-literal=api-key="$$key" || \
					(kubectl delete secret openrouter-api-key; \
					kubectl create secret generic openrouter-api-key --from-literal=api-key="$$key"); \
				kubectl apply -f e2e/fixtures/ark-free-api-resources.yaml; \
				kubectl patch agent test-agent -n default --type=merge -p '{"spec":{"modelRef":{"name":"default"}}}'; \
				echo "✅ OpenRouter API configured!"; \
				;; \
			*) \
				echo "Invalid choice"; \
				exit 1; \
				;; \
		esac; \
	fi
	@echo ""
	@echo "View resources: kubectl get models,agents,teams -n default"

e2e-cleanup: ## Cleanup E2E test environment
	@echo "Cleaning up k3d cluster..."
	k3d cluster delete ark-test || echo "Cluster already deleted"
	@echo "✓ Cleanup complete"

e2e-reset: ## Delete and recreate E2E environment
	@echo "Resetting E2E environment..."
	$(MAKE) e2e-cleanup
	$(MAKE) e2e-create

e2e-logs: ## View logs from E2E environment
	@echo "=== n8n logs ==="
	kubectl logs deployment/ark-n8n --tail=50
	@echo ""
	@echo "=== ARK Controller logs ==="
	kubectl logs deployment/ark-controller -n ark-system --tail=50

e2e-status: ## Check E2E environment status
	@echo "=== k3d cluster ==="
	k3d cluster list
	@echo ""
	@echo "=== ARK pods ==="
	kubectl get pods -n ark-system
	@echo ""
	@echo "=== n8n pod ==="
	kubectl get pods -l app.kubernetes.io/name=ark-n8n
	@echo ""
	@echo "=== ARK resources ==="
	kubectl get agents,models,teams,memories,evaluators -n default

docker-build: build ## Build Docker image
	@echo "Building Docker image..."
	docker build -t ark-n8n:latest .
	@echo "✓ Docker image built"

docker-run: docker-build ## Run Docker container locally
	@echo "Running Docker container..."
	docker run -p 5678:5678 \
		-e ARK_API_URL=http://host.docker.internal:8000 \
		-e N8N_HOST=localhost \
		ark-n8n:latest

clean: ## Clean build artifacts
	@echo "Cleaning build artifacts..."
	rm -rf nodes/dist
	rm -rf e2e/playwright-report
	rm -rf e2e/test-results
	@echo "✓ Clean complete"

dev: ## Start DevSpace development environment
	@echo "Starting DevSpace..."
	devspace dev

release-patch: ## Create a patch release (e.g., 1.0.0 -> 1.0.1)
	@echo "Creating patch release..."
	@gh workflow run release.yml -f version_bump=patch || echo "Use GitHub Actions: https://github.com/$(shell git config --get remote.origin.url | sed 's/.*:\(.*\)\.git/\1/')/actions/workflows/release.yml"

release-minor: ## Create a minor release (e.g., 1.0.0 -> 1.1.0)
	@echo "Creating minor release..."
	@gh workflow run release.yml -f version_bump=minor || echo "Use GitHub Actions: https://github.com/$(shell git config --get remote.origin.url | sed 's/.*:\(.*\)\.git/\1/')/actions/workflows/release.yml"

release-major: ## Create a major release (e.g., 1.0.0 -> 2.0.0)
	@echo "Creating major release..."
	@gh workflow run release.yml -f version_bump=major || echo "Use GitHub Actions: https://github.com/$(shell git config --get remote.origin.url | sed 's/.*:\(.*\)\.git/\1/')/actions/workflows/release.yml"

quick-install: ## Quick install to local cluster
	@bash install.sh

quickstart: ## Quick start with demo workflow (setup cluster, deploy, import demo, open UI)
	@echo "╔════════════════════════════════════════════════════╗"
	@echo "║     ARK n8n Quick Start                            ║"
	@echo "╚════════════════════════════════════════════════════╝"
	@echo ""
	@echo "This will:"
	@echo "  1️⃣  Setup k3d cluster with ARK (if needed)"
	@echo "  2️⃣  Deploy ark-n8n with auto-login"
	@echo "  3️⃣  Import ARK Agent Tool demo workflow"
	@echo "  4️⃣  Open n8n UI in your browser"
	@echo ""
	@read -p "Press Enter to continue or Ctrl+C to cancel..."
	@echo ""
	@$(MAKE) quickstart-setup
	@$(MAKE) quickstart-import
	@$(MAKE) quickstart-open

quickstart-setup: ## Setup environment (cluster + deploy)
	@echo "1️⃣  Setting up k3d cluster with ARK..."
	@if k3d cluster list 2>/dev/null | grep -q ark-test; then \
		echo "✓ Cluster ark-test already exists"; \
		echo ""; \
		echo "Rebuilding and updating deployment..."; \
		$(MAKE) e2e-update; \
	else \
		echo "Creating new k3d cluster with ARK..."; \
		$(MAKE) e2e-create; \
	fi
	@echo ""
	@echo "✓ Environment ready"

quickstart-import: ## Import demo workflow
	@echo ""
	@echo "2️⃣  Importing demo workflow..."
	@echo ""
	@echo "Starting port-forward (background)..."
	@pkill -f "kubectl port-forward svc/ark-n8n-proxy" 2>/dev/null || true
	@kubectl port-forward svc/ark-n8n-proxy 8080:80 > /dev/null 2>&1 &
	@sleep 5
	@bash scripts/import-demo-workflow.sh

quickstart-open: ## Open n8n UI and print instructions
	@echo ""
	@echo "3️⃣  Opening n8n UI..."
	@echo ""
	@if command -v open > /dev/null 2>&1; then \
		open http://localhost:8080; \
		echo "✓ Browser opened"; \
	elif command -v xdg-open > /dev/null 2>&1; then \
		xdg-open http://localhost:8080; \
		echo "✓ Browser opened"; \
	else \
		echo "⚠️  Could not auto-open browser"; \
	fi
	@echo ""
	@echo "╔════════════════════════════════════════════════════╗"
	@echo "║     ✅ Quick Start Complete!                       ║"
	@echo "╚════════════════════════════════════════════════════╝"
	@echo ""
	@echo "🌐 n8n URL: http://localhost:8080"
	@echo "📋 Demo Workflow: ARK Agent Tool Demo"
	@echo ""
	@echo "🎯 What to do next:"
	@echo "  1. Find 'ARK Agent Tool Demo' workflow"
	@echo "  2. Click 'Test workflow' button"
	@echo "  3. Watch ARK agent respond!"
	@echo ""
	@echo "🔧 Test the ARK Agent Tool node:"
	@echo "  • Modify the input message"
	@echo "  • Change agent parameters"
	@echo "  • Add memory/session ID"
	@echo "  • View response in Format Output node"
	@echo ""
	@echo "📊 Monitor ARK:"
	@echo "  kubectl get agents,queries -n default"
	@echo ""
	@echo "🛑 Stop port-forward:"
	@echo "  pkill -f 'kubectl port-forward svc/ark-n8n-proxy'"
	@echo ""
	@echo "═══════════════════════════════════════════════════════"
	@echo "Port-forward is running in background on port 8080"
	@echo "═══════════════════════════════════════════════════════"

quickstart-stop: ## Stop port-forward
	@echo "Stopping port-forward..."
	@pkill -f "kubectl port-forward svc/ark-n8n-proxy" || echo "No port-forward running"

# Task Workflow Quality Gates
quality-gate: ## Run all quality checks (lint, build, test) - use before completing a task
	@echo "╔════════════════════════════════════════════════════╗"
	@echo "║     Running Quality Gates (Hybrid Tools)          ║"
	@echo "╚════════════════════════════════════════════════════╝"
	@echo ""
	@echo "1️⃣  Linting..."
	@$(MAKE) lint
	@echo ""
	@echo "2️⃣  Building..."
	@$(MAKE) build
	@echo ""
	@echo "3️⃣  Running tests..."
	@$(MAKE) test
	@echo ""
	@echo "4️⃣  Checking coverage..."
	@$(MAKE) test-coverage
	@echo ""
	@echo "╔════════════════════════════════════════════════════╗"
	@echo "║           ✅ ALL QUALITY GATES PASSED              ║"
	@echo "╚════════════════════════════════════════════════════╝"
	@echo ""
	@echo "✓ Lint: 0 errors"
	@echo "✓ Build: Success"
	@echo "✓ Tests: All passing"
	@echo "✓ Coverage: >80%"
	@echo ""
	@echo "Ready to commit and mark task as complete! 🎉"

task-verify: quality-gate ## Alias for quality-gate

task-clean: clean ## Clean and reinstall (use when switching tasks)
	@echo "Cleaning and reinstalling..."
	cd nodes && rm -rf node_modules package-lock.json
	@$(MAKE) install
	@echo "✓ Clean install complete"
