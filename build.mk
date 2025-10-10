# n8n service build configuration

N8N_SERVICE_NAME := n8n
N8N_SERVICE_DIR := services/$(N8N_SERVICE_NAME)
N8N_NODES_DIR := $(N8N_SERVICE_DIR)/nodes
N8N_OUT := $(OUT)/$(N8N_SERVICE_NAME)

# Service-specific variables
N8N_IMAGE := ark-n8n
N8N_TAG ?= latest
N8N_NAMESPACE ?= default
N8N_VERSION ?= latest

# Pre-calculate all stamp paths
N8N_STAMP_DEPS := $(N8N_OUT)/stamp-deps
N8N_STAMP_TEST := $(N8N_OUT)/stamp-test
N8N_STAMP_BUILD := $(N8N_OUT)/stamp-build
N8N_STAMP_INSTALL := $(N8N_OUT)/stamp-install

# Add install stamp to global install targets
INSTALL_TARGETS += $(N8N_STAMP_INSTALL)

CLEAN_TARGETS += $(N8N_OUT)
CLEAN_TARGETS += $(N8N_NODES_DIR)/node_modules
CLEAN_TARGETS += $(N8N_NODES_DIR)/dist
CLEAN_TARGETS += $(N8N_NODES_DIR)/coverage
CLEAN_TARGETS += $(N8N_NODES_DIR)/.eslintcache

# Define phony targets
.PHONY: $(N8N_SERVICE_NAME)-build $(N8N_SERVICE_NAME)-install $(N8N_SERVICE_NAME)-uninstall $(N8N_SERVICE_NAME)-dev $(N8N_SERVICE_NAME)-test $(N8N_SERVICE_NAME)-clean-stamps

# Generate clean-stamps target
$(eval $(call CLEAN_STAMPS_TEMPLATE,$(N8N_SERVICE_NAME)))

# Dependencies
$(N8N_SERVICE_NAME)-deps: $(N8N_STAMP_DEPS)
$(N8N_STAMP_DEPS): $(N8N_NODES_DIR)/package.json | $(OUT)
	@mkdir -p $(dir $@)
	cd $(N8N_NODES_DIR) && npm ci
	@touch $@

# Test target
$(N8N_SERVICE_NAME)-test: $(N8N_STAMP_TEST) # HELP: Run n8n nodes tests
$(N8N_STAMP_TEST): $(N8N_STAMP_DEPS)
	cd $(N8N_NODES_DIR) && npm test
	@touch $@

# Build target
$(N8N_SERVICE_NAME)-build: $(N8N_STAMP_BUILD) # HELP: Build n8n Docker image with ARK nodes
$(N8N_STAMP_BUILD): $(N8N_STAMP_TEST)
	cd $(N8N_NODES_DIR) && npm run build
	cd $(N8N_SERVICE_DIR) && docker build \
		--build-arg N8N_VERSION=$(N8N_VERSION) \
		-t $(N8N_IMAGE):$(N8N_TAG) .
	@touch $@

# Install target
$(N8N_SERVICE_NAME)-install: $(N8N_STAMP_INSTALL) # HELP: Deploy n8n with ARK nodes to cluster
$(N8N_STAMP_INSTALL): $(N8N_STAMP_BUILD) $$(ARK_API_STAMP_INSTALL)
	@echo "Installing n8n with ARK nodes..."
	./scripts/build-and-push.sh -i $(N8N_IMAGE) -t $(N8N_TAG) -f $(N8N_SERVICE_DIR)/Dockerfile -c $(N8N_SERVICE_DIR)
	helm upgrade --install $(N8N_SERVICE_NAME) $(N8N_SERVICE_DIR)/chart \
		--namespace $(N8N_NAMESPACE) \
		--create-namespace \
		--set app.image.repository=$(N8N_IMAGE) \
		--set app.image.tag=$(N8N_TAG) \
		--set httpRoute.enabled=true \
		--wait \
		--timeout=5m
	@echo "n8n installed successfully"
	@echo ""
	@echo "Access n8n at: http://n8n.default.127.0.0.1.nip.io:8080"
	@echo "Run 'make routes' to see all available routes"
	@touch $@

# Uninstall target
$(N8N_SERVICE_NAME)-uninstall: # HELP: Remove n8n from cluster
	@echo "Uninstalling n8n..."
	helm uninstall $(N8N_SERVICE_NAME) --namespace $(N8N_NAMESPACE) --ignore-not-found
	@echo "n8n uninstalled successfully"
	rm -f $(N8N_STAMP_INSTALL)

# Dev target
$(N8N_SERVICE_NAME)-dev: $(N8N_STAMP_DEPS) # HELP: Run n8n nodes in development mode with watch
	cd $(N8N_NODES_DIR) && npm run dev
