FROM python:3.12-slim

WORKDIR /app

# Install uv for fast dependency management
RUN pip install uv && \
    mkdir -p /home/appuser/.cache/uv && \
    groupadd -r appuser && \
    useradd -r -g appuser appuser

# Copy dependency files
COPY pyproject.toml ./

# Install dependencies
RUN uv pip install --system -e .

# Copy source code
COPY src/ ./src/

# Change ownership
RUN chown -R appuser:appuser /app /home/appuser/.cache

USER appuser

# Expose MCP server port
EXPOSE 8000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:8000/health').read()" || exit 1

# Run MCP server
CMD ["python", "-m", "src.main"]
