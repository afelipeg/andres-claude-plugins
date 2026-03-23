#!/bin/bash
set -e

# Only start connectors that have credentials configured
# The MCP server gracefully handles missing credentials

PORT=${AIRBYTE_MCP_PORT:-8080}

echo "Starting Airbyte Agent MCP server on port $PORT..."
exec agent-engine mcp serve config.yaml --http --port $PORT
