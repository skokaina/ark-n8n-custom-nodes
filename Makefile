.PHONY: help install test e2e build clean release

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
	@echo "Building Docker image..."
	cd nodes && npm run build && cd ..
	docker build -t ark-n8n:test .
	k3d image import ark-n8n:test -c ark-test
	@echo "Installing ark-n8n..."
	helm install ark-n8n ./chart \
		-f chart/values-testing.yaml \
		--set app.image.repository=ark-n8n \
		--set app.image.tag=test \
		--set app.image.pullPolicy=Never \
		--set ark.apiUrl=http://ark-api.ark-system.svc.cluster.local \
		--wait
	kubectl wait --for=condition=available --timeout=300s deployment/ark-n8n
	@echo "Waiting for nginx proxy to be ready..."
	kubectl wait --for=condition=available --timeout=60s deployment/ark-n8n-nginx || true
	@echo "✓ E2E environment ready"
	@echo ""
	@echo "Setting up n8n account..."
	@kubectl port-forward svc/ark-n8n 5678:5678 > /dev/null 2>&1 & \
	sleep 5 && \
	cd e2e && node scripts/setup-n8n-account.js && \
	pkill -f "kubectl port-forward svc/ark-n8n" || true
	@echo ""
	@echo "═══════════════════════════════════════════════════════"
	@echo "  ✅ E2E Environment Ready with Auto-Login"
	@echo "═══════════════════════════════════════════════════════"
	@echo ""
	@echo "Access n8n with auto-login:"
	@echo "  kubectl port-forward svc/ark-n8n-proxy 5678:80"
	@echo "  Open: http://localhost:5678"
	@echo ""
	@echo "Or access n8n directly (manual login):"
	@echo "  kubectl port-forward svc/ark-n8n 5679:5678"
	@echo "  Open: http://localhost:5679"
	@echo "  Login: admin@example.com / Admin123!@#"
	@echo "═══════════════════════════════════════════════════════"

e2e-update: ## Update existing E2E environment (fast iteration)
	@echo "Building Docker image..."
	cd nodes && npm run build && cd ..
	docker build -t ark-n8n:test .
	k3d image import ark-n8n:test -c ark-test
	@echo "Upgrading ark-n8n..."
	helm upgrade ark-n8n ./chart \
		-f chart/values-testing.yaml \
		--set app.image.repository=ark-n8n \
		--set app.image.tag=test \
		--set app.image.pullPolicy=Never \
		--set ark.apiUrl=http://ark-api.ark-system.svc.cluster.local \
		--wait
	@echo "✓ E2E environment updated"
	@echo ""
	@echo "Access with auto-login: kubectl port-forward svc/ark-n8n-proxy 5678:80"
	@echo "Credentials: cat /tmp/n8n-default-creds.json"

e2e: ## Run E2E tests (requires e2e-setup first)
	@echo "Starting port-forward to auto-login proxy..."
	kubectl port-forward svc/ark-n8n-proxy 5678:80 > /dev/null 2>&1 &
	@sleep 5
	@echo "Running E2E tests..."
	cd e2e && npx playwright test
	@pkill -f "kubectl port-forward svc/ark-n8n-proxy" || true
	@echo "✓ E2E tests passed"

e2e-ui: ## Run E2E tests with UI (requires e2e-setup first)
	@echo "Starting port-forward to auto-login proxy..."
	kubectl port-forward svc/ark-n8n-proxy 5678:80 > /dev/null 2>&1 &
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
