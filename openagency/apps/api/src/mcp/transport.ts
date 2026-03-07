// ─── MCP Streamable HTTP Transport (Hono) ───────────────────────────

import { Hono } from 'hono';
import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js';
import type { OpenAgency } from '@openagency/core';
import type { OodaRuntime, MeshCoordinator, A2AClient, McpClientRegistry } from '@openagency/agent';
import type { DynamicSkillRegistry } from '@openagency/schemas';
import type { HFLCoordinator } from '@openagency/hfl';
import type { ConnectorInfra } from '../connectors/setup.js';
import { createMcpServer } from './server.js';

export function mcpRoute(
  agency: OpenAgency,
  agents?: Map<string, OodaRuntime>,
  mesh?: MeshCoordinator,
  connectorInfra?: ConnectorInfra,
  a2aClient?: A2AClient,
  mcpClientRegistry?: McpClientRegistry,
  dynamicSkillRegistry?: DynamicSkillRegistry,
  hflCoordinator?: HFLCoordinator,
) {
  const app = new Hono();

  app.post('/v1/mcp', async (c) => {
    const server = createMcpServer(agency, agents, mesh, connectorInfra, a2aClient, mcpClientRegistry, dynamicSkillRegistry, hflCoordinator);
    const transport = new WebStandardStreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
    });

    await server.connect(transport);
    return transport.handleRequest(c.req.raw);
  });

  return app;
}
