// ─── MCP Streamable HTTP Transport (Hono) ───────────────────────────

import { Hono } from 'hono';
import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js';
import type { OpenAgency } from '@openagency/core';
import type { OodaRuntime, MeshCoordinator, A2AClient, McpClientRegistry, PipelineScheduler } from '@openagency/agent';
import type { DynamicSkillRegistry } from '@openagency/schemas';
import type { HFLCoordinator } from '@openagency/hfl';
import type { ConnectorInfra } from '../connectors/setup.js';
import type { FileRepo, AgencyRepo, QuotaRepo } from '@openagency/memory';
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
  scheduler?: PipelineScheduler,
  fileRepo?: FileRepo | null,
  agencyRepo?: AgencyRepo,
  quotaRepo?: QuotaRepo,
) {
  const app = new Hono();

  app.post('/v1/mcp', async (c) => {
    // FIX 4: Pass auth context + quota repos to MCP server for quota enforcement
    const auth = c.get('auth') as { sub: string; role?: string } | undefined;
    const server = createMcpServer(agency, agents, mesh, connectorInfra, a2aClient, mcpClientRegistry, dynamicSkillRegistry, hflCoordinator, scheduler, fileRepo, agencyRepo, quotaRepo, auth);
    const transport = new WebStandardStreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
    });

    await server.connect(transport);
    return transport.handleRequest(c.req.raw);
  });

  return app;
}
