// ─── Federation Routes ─────────────────────────────────────────────
// Discover + invoke external agents; connect + call external MCP tools.

import { Hono } from 'hono';
import type { A2AClient, McpClientRegistry } from '@openagency/agent';

export interface FederationDeps {
  a2aClient: A2AClient;
  mcpRegistry: McpClientRegistry;
}

export function federationRoutes(deps: FederationDeps) {
  const app = new Hono();

  // ─── A2A Discovery ───────────────────────────────────────────────

  /** Discover a remote agent via A2A protocol */
  app.post('/v1/federation/discover', async (c) => {
    const body = await c.req.json<{ url: string }>();
    if (!body.url) return c.json({ error: 'url is required' }, 400);

    try {
      const result = await deps.a2aClient.discover(body.url);
      return c.json(result);
    } catch (err) {
      return c.json({ error: err instanceof Error ? err.message : 'Discovery failed' }, 502);
    }
  });

  /** List all discovered remote agents */
  app.get('/v1/federation/agents', (c) => {
    return c.json(deps.a2aClient.listDiscovered());
  });

  /** Invoke a skill on a remote agent */
  app.post('/v1/federation/agents/invoke', async (c) => {
    const body = await c.req.json<{
      base_url: string;
      engine_id: string;
      skill_id: string;
      input: Record<string, unknown>;
      api_key?: string;
    }>();

    if (!body.base_url || !body.engine_id || !body.skill_id) {
      return c.json({ error: 'base_url, engine_id, and skill_id are required' }, 400);
    }

    try {
      const result = await deps.a2aClient.invokeSkill({
        base_url: body.base_url,
        engine_id: body.engine_id,
        skill_id: body.skill_id,
        input: body.input ?? {},
        api_key: body.api_key,
      });
      return c.json(result);
    } catch (err) {
      return c.json({ error: err instanceof Error ? err.message : 'Invocation failed' }, 502);
    }
  });

  /** Forget a discovered agent */
  app.delete('/v1/federation/agents', async (c) => {
    const body = await c.req.json<{ url: string }>();
    const removed = deps.a2aClient.forget(body.url);
    return c.json({ removed });
  });

  // ─── MCP Client ──────────────────────────────────────────────────

  /** Connect to an external MCP server */
  app.post('/v1/federation/mcp/connect', async (c) => {
    const body = await c.req.json<{ name: string; url: string }>();
    if (!body.name || !body.url) {
      return c.json({ error: 'name and url are required' }, 400);
    }

    try {
      const server = await deps.mcpRegistry.connect(body.name, body.url);
      return c.json(server);
    } catch (err) {
      return c.json({ error: err instanceof Error ? err.message : 'Connection failed' }, 502);
    }
  });

  /** List connected MCP servers */
  app.get('/v1/federation/mcp/servers', (c) => {
    return c.json(deps.mcpRegistry.listServers());
  });

  /** Call a tool on a connected MCP server */
  app.post('/v1/federation/mcp/:server/tools/:tool', async (c) => {
    const serverName = c.req.param('server');
    const toolName = c.req.param('tool');
    const args = await c.req.json<Record<string, unknown>>();

    try {
      const result = await deps.mcpRegistry.callTool(serverName, toolName, args);
      return c.json(result);
    } catch (err) {
      return c.json({ error: err instanceof Error ? err.message : 'Tool call failed' }, 502);
    }
  });

  /** Disconnect from an MCP server */
  app.delete('/v1/federation/mcp/:server', (c) => {
    const removed = deps.mcpRegistry.disconnect(c.req.param('server'));
    return c.json({ removed });
  });

  return app;
}
