# Plinth Airbyte MCP Sidecar

Standalone Python service that runs the Airbyte Agent Connectors MCP server.
Plinth (Node.js API) connects to this service via MCP HTTP to access ad platform data.

## Supported Connectors

| Platform           | Required Env Vars                                                              |
|--------------------|--------------------------------------------------------------------------------|
| Google Ads         | GOOGLE_ADS_CLIENT_ID, GOOGLE_ADS_CLIENT_SECRET, GOOGLE_ADS_REFRESH_TOKEN, GOOGLE_ADS_DEVELOPER_TOKEN |
| Facebook/Meta Ads  | META_ACCESS_TOKEN, META_APP_ID, META_APP_SECRET                                |
| TikTok Marketing   | TIKTOK_ACCESS_TOKEN                                                            |
| Amazon Ads         | AMAZON_ADS_CLIENT_ID, AMAZON_ADS_CLIENT_SECRET, AMAZON_ADS_REFRESH_TOKEN       |
| LinkedIn Ads       | LINKEDIN_ACCESS_TOKEN                                                          |
| Snapchat Marketing | SNAPCHAT_ACCESS_TOKEN                                                          |
| Pinterest Ads      | PINTEREST_ACCESS_TOKEN                                                         |

Only configure env vars for the platforms you need. The MCP server gracefully handles missing credentials.

## Deploy to Railway

1. Create a new service in your Railway project
2. Set the root directory to `services/airbyte-mcp`
3. Set env vars for the platforms you want to connect
4. Deploy (Railway auto-detects the Dockerfile)

The service exposes port 8080 by default (override with `AIRBYTE_MCP_PORT`).

## Connect from Plinth

Set `AIRBYTE_MCP_URL` in the Plinth API service env vars:

```
AIRBYTE_MCP_URL=http://airbyte-mcp.railway.internal:8080/mcp
```

Use Railway's private networking hostname. Plinth auto-connects on startup when this var is set.

## Local Development

```bash
# Install dependencies
pip install uv
uv pip install --system -r pyproject.toml

# Run
AIRBYTE_MCP_PORT=8080 ./start.sh
```

Then set `AIRBYTE_MCP_URL=http://localhost:8080/mcp` in your Plinth .env.
