// ─── MCP Streamable HTTP Transport (Hono) ───────────────────────────

import { Hono } from 'hono';
import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js';
import type { OpenAgency } from '@openagency/core';
import type { OodaRuntime, MeshCoordinator } from '@openagency/agent';
import type { ConnectorInfra } from '../connectors/setup.js';
import { createMcpServer } from './server.js';

export function mcpRoute(
  agency: OpenAgency,
  agents?: Map<string, OodaRuntime>,
  mesh?: MeshCoordinator,
  connectorInfra?: ConnectorInfra,
) {
  const app = new Hono();

  app.post('/v1/mcp', async (c) => {
    const server = createMcpServer(agency, agents, mesh, connectorInfra);
    const transport = new WebStandardStreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
    });

    await server.connect(transport);
    return transport.handleRequest(c.req.raw);
  });

  return app;
}
