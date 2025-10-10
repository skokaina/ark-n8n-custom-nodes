ARG N8N_VERSION=latest
FROM docker.n8n.io/n8nio/n8n:${N8N_VERSION}

USER root

# Copy pre-built nodes to temporary location
COPY nodes/package.json /tmp/n8n-nodes-ark/
COPY nodes/dist /tmp/n8n-nodes-ark/dist/

# Install the package globally so n8n can discover it
WORKDIR /tmp/n8n-nodes-ark
RUN npm install -g .

# Set environment variable to allow external modules
ENV N8N_CUSTOM_EXTENSIONS="/usr/local/lib/node_modules/n8n-nodes-ark"

USER node

WORKDIR /home/node
