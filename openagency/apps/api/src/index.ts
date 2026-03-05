// ─── OpenAgency API Server ──────────────────────────────────────────

import { serve } from '@hono/node-server';
import { createApp } from './app.js';

const port = parseInt(process.env['PORT'] ?? '3100', 10);

async function main() {
  const app = await createApp();

  console.log(`[openagency] API server starting on port ${port}`);

  serve({ fetch: app.fetch, port }, (info) => {
    console.log(`[openagency] Listening on http://localhost:${info.port}`);
    console.log(`[openagency] Health:     http://localhost:${info.port}/health`);
    console.log(`[openagency] OpenAPI:    http://localhost:${info.port}/v1/openapi.json`);
    console.log(`[openagency] Agent Card: http://localhost:${info.port}/.well-known/agent.json`);
    console.log(`[openagency] MCP:        http://localhost:${info.port}/v1/mcp`);
  });
}

main().catch((err) => {
  console.error('[openagency] Failed to start:', err);
  process.exit(1);
});
