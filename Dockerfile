ARG N8N_VERSION=2.6.3
FROM docker.n8n.io/n8nio/n8n:${N8N_VERSION}

USER root

# Copy custom nodes to a permanent location
RUN mkdir -p /opt/n8n-nodes-ark
COPY nodes/package.json /opt/n8n-nodes-ark/
COPY nodes/dist /opt/n8n-nodes-ark/dist/

# Set environment variable to allow external modules
ENV N8N_CUSTOM_EXTENSIONS="/opt/n8n-nodes-ark"

USER node

WORKDIR /home/node
