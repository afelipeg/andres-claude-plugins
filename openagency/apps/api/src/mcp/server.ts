// ─── MCP Server Factory ─────────────────────────────────────────────
// Registers all engine skills + agent management as MCP tools.

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { zodToJsonSchema } from 'zod-to-json-schema';
import type { OpenAgency } from '@openagency/core';
import { parseFile } from '@openagency/core/data/file-parser';
import { detectPlatform } from '@openagency/core/data/platform-detect';
import { SKILL_SCHEMAS, type DynamicSkillRegistry } from '@openagency/schemas';
import type { OodaRuntime, MeshCoordinator, A2AClient, McpClientRegistry } from '@openagency/agent';
import type { ConnectorPlatform, OAuthTokens } from '@openagency/types';
import { getConnector, hasConnector } from '@openagency/connectors';
import type { ConnectorInfra } from '../connectors/setup.js';

const VALID_PLATFORMS = new Set<string>([
  'google_ads', 'meta_ads', 'dv360', 'tiktok_ads', 'tiktok_shop', 'amazon_ads',
]);

function isValidPlatform(p: string): p is ConnectorPlatform {
  return VALID_PLATFORMS.has(p);
}

export function createMcpServer(
  agency: OpenAgency,
  agents?: Map<string, OodaRuntime>,
  mesh?: MeshCoordinator,
  connectorInfra?: ConnectorInfra,
  a2aClient?: A2AClient,
  mcpClientRegistry?: McpClientRegistry,
  dynamicSkillRegistry?: DynamicSkillRegistry,
): McpServer {
  const server = new McpServer({
    name: 'openagency',
    version: '3.0.0',
  });

  // Register all skills as MCP tools
  for (const entry of SKILL_SCHEMAS) {
    const toolName = `${entry.engineId}_${entry.skillId}`.replace(/-/g, '_');
    const jsonSchema = zodToJsonSchema(entry.inputSchema, {
      target: 'openApi3',
    }) as Record<string, unknown>;

    server.tool(
      toolName,
      entry.description,
      jsonSchema as Record<string, { type: string }>,
      async (args: Record<string, unknown>) => {
        try {
          const result = await agency.run(entry.engineId, entry.skillId, args);
          return {
            content: [
              {
                type: 'text' as const,
                text: JSON.stringify(result, null, 2),
              },
            ],
          };
        } catch (err) {
          const message = err instanceof Error ? err.message : 'Unknown error';
          return {
            content: [{ type: 'text' as const, text: `Error: ${message}` }],
            isError: true,
          };
        }
      },
    );
  }

  // ─── File parsing MCP tool ──────────────────────────────────────
  server.tool(
    'parse_file',
    'Parse an uploaded file (CSV, Excel, PDF, JSON) and detect the advertising platform. Accepts base64-encoded file content. Returns structured row data with platform detection. Complements platform_sync tools for offline/exported data.',
    {
      content_base64: { type: 'string', description: 'Base64-encoded file content' },
      filename: { type: 'string', description: 'Original filename with extension (e.g. "report.xlsx")' },
    } as Record<string, { type: string; description?: string }>,
    async (args: Record<string, unknown>) => {
      try {
        const b64 = args['content_base64'] as string;
        const filename = args['filename'] as string;
        if (!b64 || !filename) {
          return {
            content: [{ type: 'text' as const, text: 'Both content_base64 and filename are required' }],
            isError: true,
          };
        }

        const buffer = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0)).buffer;
        const result = await parseFile(buffer, filename);
        const mapping = detectPlatform(result.columns);

        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify({
              format: result.format,
              platform: mapping.platform,
              confidence: mapping.confidence,
              columns: result.columns,
              rows: result.data.length,
              column_map: mapping.columnMap,
              data: result.data.slice(0, 50),
            }, null, 2),
          }],
        };
      } catch (err) {
        return {
          content: [{ type: 'text' as const, text: `Error: ${err instanceof Error ? err.message : String(err)}` }],
          isError: true,
        };
      }
    },
  );

  // ─── Agent management MCP tools ───────────────────────────────
  if (agents) {
    server.tool(
      'agent_list',
      'List all autonomous agents with their current status',
      {},
      async () => {
        const states = [];
        for (const [, runtime] of agents) {
          states.push(runtime.getState());
        }
        return {
          content: [{ type: 'text' as const, text: JSON.stringify(states, null, 2) }],
        };
      },
    );

    server.tool(
      'agent_start',
      'Start an autonomous agent OODA loop',
      { agent_id: { type: 'string' } } as Record<string, { type: string }>,
      async (args: Record<string, unknown>) => {
        const runtime = agents.get(args['agent_id'] as string);
        if (!runtime) {
          return { content: [{ type: 'text' as const, text: 'Agent not found' }], isError: true };
        }
        try {
          await runtime.start();
          return { content: [{ type: 'text' as const, text: JSON.stringify(runtime.getState(), null, 2) }] };
        } catch (err) {
          return { content: [{ type: 'text' as const, text: `Error: ${err instanceof Error ? err.message : String(err)}` }], isError: true };
        }
      },
    );

    server.tool(
      'agent_stop',
      'Stop an autonomous agent',
      { agent_id: { type: 'string' } } as Record<string, { type: string }>,
      async (args: Record<string, unknown>) => {
        const runtime = agents.get(args['agent_id'] as string);
        if (!runtime) {
          return { content: [{ type: 'text' as const, text: 'Agent not found' }], isError: true };
        }
        await runtime.stop();
        return { content: [{ type: 'text' as const, text: JSON.stringify(runtime.getState(), null, 2) }] };
      },
    );

    server.tool(
      'agent_cycle',
      'Trigger a single manual OODA cycle for an agent',
      { agent_id: { type: 'string' } } as Record<string, { type: string }>,
      async (args: Record<string, unknown>) => {
        const runtime = agents.get(args['agent_id'] as string);
        if (!runtime) {
          return { content: [{ type: 'text' as const, text: 'Agent not found' }], isError: true };
        }
        try {
          const result = await runtime.cycle();
          return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
        } catch (err) {
          return { content: [{ type: 'text' as const, text: `Error: ${err instanceof Error ? err.message : String(err)}` }], isError: true };
        }
      },
    );

    server.tool(
      'agent_approve_decision',
      'Approve a pending agent decision',
      {
        agent_id: { type: 'string' },
        decision_id: { type: 'string' },
      } as Record<string, { type: string }>,
      async (args: Record<string, unknown>) => {
        return {
          content: [{
            type: 'text' as const,
            text: `Decision ${args['decision_id']} approval requested. Use the REST API for full approval workflow.`,
          }],
        };
      },
    );
  }

  // ─── Platform connector MCP tools ──────────────────────────────
  if (connectorInfra) {
    server.tool(
      'platform_connect',
      'Connect a platform by storing OAuth credentials. Required before syncing data.',
      {
        platform: { type: 'string', description: 'Platform ID (google_ads, meta_ads, dv360, tiktok_ads, tiktok_shop, amazon_ads)' },
        tokens: {
          type: 'object',
          description: 'OAuth tokens',
          properties: {
            access_token: { type: 'string' },
            refresh_token: { type: 'string' },
            token_type: { type: 'string' },
            expires_at: { type: 'number' },
            scope: { type: 'string' },
          },
          required: ['access_token', 'token_type', 'expires_at'],
        },
        account_id: { type: 'string', description: 'Ad account ID' },
        manager_id: { type: 'string', description: 'Manager/MCC account ID (Google Ads)' },
        developer_token: { type: 'string', description: 'Developer token (Google Ads)' },
        app_id: { type: 'string', description: 'App ID' },
        profile_id: { type: 'string', description: 'Profile ID (Amazon Ads)' },
      } as Record<string, unknown>,
      async (args: Record<string, unknown>) => {
        const platform = args['platform'] as string;
        if (!isValidPlatform(platform)) {
          return { content: [{ type: 'text' as const, text: `Invalid platform: ${platform}` }], isError: true };
        }

        const tokens = args['tokens'] as OAuthTokens;
        if (!tokens?.access_token) {
          return { content: [{ type: 'text' as const, text: 'tokens.access_token is required' }], isError: true };
        }

        connectorInfra.credentialStore.set({
          platform,
          tokens,
          account_id: args['account_id'] as string | undefined,
          manager_id: args['manager_id'] as string | undefined,
          developer_token: args['developer_token'] as string | undefined,
          app_id: args['app_id'] as string | undefined,
          profile_id: args['profile_id'] as string | undefined,
          connected_at: new Date().toISOString(),
        });

        return { content: [{ type: 'text' as const, text: JSON.stringify({ status: 'connected', platform }, null, 2) }] };
      },
    );

    server.tool(
      'platform_disconnect',
      'Disconnect a platform — removes stored credentials and stops any active sync.',
      {
        platform: { type: 'string', description: 'Platform ID to disconnect' },
      } as Record<string, { type: string; description?: string }>,
      async (args: Record<string, unknown>) => {
        const platform = args['platform'] as string;
        if (!isValidPlatform(platform)) {
          return { content: [{ type: 'text' as const, text: `Invalid platform: ${platform}` }], isError: true };
        }

        connectorInfra.syncScheduler.stop(platform);
        const removed = connectorInfra.credentialStore.remove(platform);
        connectorInfra.syncResultCache.delete(platform);

        return {
          content: [{ type: 'text' as const, text: JSON.stringify({ status: removed ? 'disconnected' : 'not_connected', platform }, null, 2) }],
        };
      },
    );

    server.tool(
      'platform_list',
      'List all connected platforms with their connection status and last sync time.',
      {},
      async () => {
        const platforms = connectorInfra.credentialStore.platforms();
        const activeSyncs = connectorInfra.syncScheduler.activePlatforms();
        const result = platforms.map((p) => ({
          platform: p,
          connected: true,
          syncing: activeSyncs.includes(p),
          last_sync: connectorInfra.syncResultCache.get(p)?.synced_at ?? null,
        }));
        return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
      },
    );

    server.tool(
      'platform_list_accounts',
      'List ad accounts for a connected platform. Requires the platform to be connected first.',
      {
        platform: { type: 'string', description: 'Platform ID' },
      } as Record<string, { type: string; description?: string }>,
      async (args: Record<string, unknown>) => {
        const platform = args['platform'] as string;
        if (!isValidPlatform(platform)) {
          return { content: [{ type: 'text' as const, text: `Invalid platform: ${platform}` }], isError: true };
        }

        const credentials = connectorInfra.credentialStore.get(platform);
        if (!credentials) {
          return { content: [{ type: 'text' as const, text: `Platform ${platform} is not connected` }], isError: true };
        }

        if (!hasConnector(platform)) {
          return { content: [{ type: 'text' as const, text: `No connector registered for ${platform}` }], isError: true };
        }

        try {
          const connector = getConnector(platform);
          const accounts = await connector.listAccounts(credentials.tokens);
          return { content: [{ type: 'text' as const, text: JSON.stringify({ platform, accounts }, null, 2) }] };
        } catch (err) {
          return { content: [{ type: 'text' as const, text: `Error: ${err instanceof Error ? err.message : String(err)}` }], isError: true };
        }
      },
    );

    server.tool(
      'platform_sync',
      'Trigger an immediate data sync for a connected platform. Pulls campaign data and caches results.',
      {
        platform: { type: 'string', description: 'Platform ID to sync' },
        date_range_days: { type: 'number', description: 'Number of days to sync (default: 30)' },
      } as Record<string, { type: string; description?: string }>,
      async (args: Record<string, unknown>) => {
        const platform = args['platform'] as string;
        if (!isValidPlatform(platform)) {
          return { content: [{ type: 'text' as const, text: `Invalid platform: ${platform}` }], isError: true };
        }

        const credentials = connectorInfra.credentialStore.get(platform);
        if (!credentials) {
          return { content: [{ type: 'text' as const, text: `Platform ${platform} is not connected` }], isError: true };
        }

        try {
          const dateRangeDays = (args['date_range_days'] as number) || 30;
          const result = await connectorInfra.syncScheduler.syncNow(platform, credentials, dateRangeDays);
          return {
            content: [{
              type: 'text' as const,
              text: JSON.stringify({
                platform: result.platform,
                status: result.status,
                row_count: result.row_count,
                date_range: result.date_range,
                synced_at: result.synced_at,
                error: result.error,
              }, null, 2),
            }],
          };
        } catch (err) {
          return { content: [{ type: 'text' as const, text: `Error: ${err instanceof Error ? err.message : String(err)}` }], isError: true };
        }
      },
    );

    server.tool(
      'platform_sync_results',
      'Get cached sync results for a platform including summary and first 50 rows of data.',
      {
        platform: { type: 'string', description: 'Platform ID' },
      } as Record<string, { type: string; description?: string }>,
      async (args: Record<string, unknown>) => {
        const platform = args['platform'] as string;
        if (!isValidPlatform(platform)) {
          return { content: [{ type: 'text' as const, text: `Invalid platform: ${platform}` }], isError: true };
        }

        const cached = connectorInfra.syncResultCache.get(platform);
        if (!cached) {
          return { content: [{ type: 'text' as const, text: `No sync results for ${platform}` }], isError: true };
        }

        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify({
              platform: cached.platform,
              status: cached.status,
              row_count: cached.row_count,
              date_range: cached.date_range,
              synced_at: cached.synced_at,
              error: cached.error,
              rows: cached.rows.slice(0, 50),
            }, null, 2),
          }],
        };
      },
    );
  }

  // ─── Mesh orchestration MCP tools ───────────────────────────────
  if (mesh) {
    server.tool(
      'mesh_list_pipelines',
      'List available multi-agent orchestration pipelines. Returns pipeline IDs, stage descriptions, skill inventories, and estimated durations. Any AI agent can discover what workflows OpenAgency offers.',
      {},
      async () => {
        const pipelines = mesh.listPipelines().map((p) => ({
          id: p.id,
          name: p.name,
          description: p.description,
          trigger: p.trigger,
          stages: p.stages.map((s) => ({
            agent_id: s.agent_id,
            order: s.order,
            skills: s.skills,
            timeout_ms: s.timeout_ms,
          })),
        }));
        return {
          content: [{ type: 'text' as const, text: JSON.stringify(pipelines, null, 2) }],
        };
      },
    );

    server.tool(
      'mesh_execute_pipeline',
      'Execute a multi-agent optimization pipeline. Triggers a full 4-stage Leak Detector → Media Architect → Campaign Ops → Executive Bridge workflow. Set auto_sync=true to pull fresh data from all connected platforms before running. This single tool call replaces an entire agency engagement.',
      {
        pipeline_id: { type: 'string', description: 'Pipeline ID to execute (e.g. "full-optimization")' },
        goal_id: { type: 'string', description: 'Optional goal ID to associate with this run' },
        auto_sync: { type: 'boolean', description: 'If true, sync all connected platforms before executing the pipeline' },
        date_range_days: { type: 'number', description: 'Days of data to sync when auto_sync is true (default: 30)' },
      } as Record<string, { type: string; description?: string }>,
      async (args: Record<string, unknown>) => {
        try {
          let syncSummary: Array<{ platform: string; status: string; row_count: number }> | undefined;

          // Auto-sync all connected platforms before pipeline execution
          if (args['auto_sync'] && connectorInfra) {
            const platforms = connectorInfra.credentialStore.platforms();
            const dateRangeDays = (args['date_range_days'] as number) || 30;

            const syncResults = await Promise.allSettled(
              platforms.map((platform) => {
                const creds = connectorInfra.credentialStore.get(platform);
                if (!creds) return Promise.resolve(null);
                return connectorInfra.syncScheduler.syncNow(platform, creds, dateRangeDays);
              }),
            );

            syncSummary = syncResults.map((r, i) => {
              if (r.status === 'fulfilled' && r.value) {
                return { platform: platforms[i], status: r.value.status, row_count: r.value.row_count };
              }
              return { platform: platforms[i], status: 'error', row_count: 0 };
            });

            // Brief pause for SyncObserver to buffer observations
            await new Promise((resolve) => setTimeout(resolve, 100));
          }

          const run = await mesh.executePipeline(
            args['pipeline_id'] as string,
            args['goal_id'] as string | undefined,
          );

          const response: Record<string, unknown> = mesh.serializeRun(run);
          if (syncSummary) {
            response['sync_summary'] = syncSummary;
          }

          return {
            content: [{ type: 'text' as const, text: JSON.stringify(response, null, 2) }],
          };
        } catch (err) {
          return {
            content: [{ type: 'text' as const, text: `Error: ${err instanceof Error ? err.message : String(err)}` }],
            isError: true,
          };
        }
      },
    );

    server.tool(
      'mesh_get_run',
      'Get status and results for a pipeline run. Returns per-stage results, skills invoked, duration, and usage metrics.',
      {
        run_id: { type: 'string', description: 'The run ID returned by mesh_execute_pipeline' },
      } as Record<string, { type: string; description?: string }>,
      async (args: Record<string, unknown>) => {
        const run = mesh.getRun(args['run_id'] as string);
        if (!run) {
          return {
            content: [{ type: 'text' as const, text: 'Run not found' }],
            isError: true,
          };
        }
        return {
          content: [{ type: 'text' as const, text: JSON.stringify(mesh.serializeRun(run), null, 2) }],
        };
      },
    );
  }

  // ─── Federation MCP tools ──────────────────────────────────────
  if (a2aClient) {
    server.tool(
      'federation_discover',
      'Discover a remote OpenAgency instance or A2A-compatible agent by URL. Fetches its /.well-known/agent.json and returns capabilities, engines, and available skills.',
      {
        url: { type: 'string', description: 'Base URL of the remote agent (e.g. https://remote.openagency.ai)' },
      } as Record<string, { type: string; description?: string }>,
      async (args: Record<string, unknown>) => {
        try {
          const result = await a2aClient.discover(args['url'] as string);
          return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
        } catch (err) {
          return { content: [{ type: 'text' as const, text: `Error: ${err instanceof Error ? err.message : String(err)}` }], isError: true };
        }
      },
    );

    server.tool(
      'federation_invoke_skill',
      'Invoke a skill on a remote agent via A2A REST protocol. The remote agent must have been discovered first or you can provide the base_url directly.',
      {
        base_url: { type: 'string', description: 'Base URL of the remote agent' },
        engine_id: { type: 'string', description: 'Remote engine ID' },
        skill_id: { type: 'string', description: 'Remote skill ID' },
        input: { type: 'object', description: 'Skill input parameters' },
        api_key: { type: 'string', description: 'Optional API key for authentication' },
      } as Record<string, unknown>,
      async (args: Record<string, unknown>) => {
        try {
          const result = await a2aClient.invokeSkill({
            base_url: args['base_url'] as string,
            engine_id: args['engine_id'] as string,
            skill_id: args['skill_id'] as string,
            input: (args['input'] as Record<string, unknown>) ?? {},
            api_key: args['api_key'] as string | undefined,
          });
          return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
        } catch (err) {
          return { content: [{ type: 'text' as const, text: `Error: ${err instanceof Error ? err.message : String(err)}` }], isError: true };
        }
      },
    );

    server.tool(
      'federation_list_agents',
      'List all discovered remote agents with their capabilities.',
      {},
      async () => {
        return { content: [{ type: 'text' as const, text: JSON.stringify(a2aClient.listDiscovered(), null, 2) }] };
      },
    );
  }

  if (mcpClientRegistry) {
    server.tool(
      'federation_mcp_connect',
      'Connect to an external MCP server. Discovers all available tools and caches them for future invocation.',
      {
        name: { type: 'string', description: 'A unique name for this MCP server connection' },
        url: { type: 'string', description: 'URL of the MCP server endpoint' },
      } as Record<string, { type: string; description?: string }>,
      async (args: Record<string, unknown>) => {
        try {
          const server = await mcpClientRegistry.connect(args['name'] as string, args['url'] as string);
          return { content: [{ type: 'text' as const, text: JSON.stringify(server, null, 2) }] };
        } catch (err) {
          return { content: [{ type: 'text' as const, text: `Error: ${err instanceof Error ? err.message : String(err)}` }], isError: true };
        }
      },
    );

    server.tool(
      'federation_mcp_call_tool',
      'Call a tool on a connected external MCP server.',
      {
        server_name: { type: 'string', description: 'Name of the connected MCP server' },
        tool_name: { type: 'string', description: 'Name of the tool to call' },
        arguments: { type: 'object', description: 'Tool arguments' },
      } as Record<string, unknown>,
      async (args: Record<string, unknown>) => {
        try {
          const result = await mcpClientRegistry.callTool(
            args['server_name'] as string,
            args['tool_name'] as string,
            (args['arguments'] as Record<string, unknown>) ?? {},
          );
          return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
        } catch (err) {
          return { content: [{ type: 'text' as const, text: `Error: ${err instanceof Error ? err.message : String(err)}` }], isError: true };
        }
      },
    );

    server.tool(
      'federation_mcp_servers',
      'List all connected external MCP servers with their available tools.',
      {},
      async () => {
        return { content: [{ type: 'text' as const, text: JSON.stringify(mcpClientRegistry.listServers(), null, 2) }] };
      },
    );
  }

  // ─── Marketplace MCP tools ────────────────────────────────────
  if (dynamicSkillRegistry) {
    server.tool(
      'marketplace_register_skill',
      'Register a dynamic skill in the marketplace. The skill can be a remote endpoint that implements the OpenAgency skill protocol.',
      {
        engine_id: { type: 'string', description: 'Engine to register the skill under' },
        skill_id: { type: 'string', description: 'Unique skill identifier' },
        name: { type: 'string', description: 'Human-readable skill name' },
        description: { type: 'string', description: 'What the skill does' },
        remote_url: { type: 'string', description: 'URL of the remote skill endpoint' },
        remote_api_key: { type: 'string', description: 'Optional API key for the remote endpoint' },
      } as Record<string, { type: string; description?: string }>,
      async (args: Record<string, unknown>) => {
        try {
          dynamicSkillRegistry.register({
            engineId: args['engine_id'] as string,
            skillId: args['skill_id'] as string,
            name: args['name'] as string,
            description: (args['description'] as string) ?? '',
            inputSchema: {},
            remoteUrl: args['remote_url'] as string,
            remoteApiKey: args['remote_api_key'] as string | undefined,
          });
          return { content: [{ type: 'text' as const, text: JSON.stringify({ status: 'registered', key: `${args['engine_id']}:${args['skill_id']}` }, null, 2) }] };
        } catch (err) {
          return { content: [{ type: 'text' as const, text: `Error: ${err instanceof Error ? err.message : String(err)}` }], isError: true };
        }
      },
    );

    server.tool(
      'marketplace_execute_skill',
      'Execute a dynamically registered skill from the marketplace.',
      {
        engine_id: { type: 'string', description: 'Engine the skill belongs to' },
        skill_id: { type: 'string', description: 'Skill ID to execute' },
        input: { type: 'object', description: 'Skill input parameters' },
      } as Record<string, unknown>,
      async (args: Record<string, unknown>) => {
        try {
          const result = await dynamicSkillRegistry.execute(
            args['engine_id'] as string,
            args['skill_id'] as string,
            (args['input'] as Record<string, unknown>) ?? {},
          );
          return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
        } catch (err) {
          return { content: [{ type: 'text' as const, text: `Error: ${err instanceof Error ? err.message : String(err)}` }], isError: true };
        }
      },
    );

    server.tool(
      'marketplace_list_skills',
      'List all skills available in the marketplace (both built-in and dynamically registered).',
      {},
      async () => {
        const builtIn = SKILL_SCHEMAS.map((s) => ({ engine_id: s.engineId, skill_id: s.skillId, name: s.name, source: 'built-in' }));
        const dynamic = dynamicSkillRegistry.listAll().map((s) => ({ engine_id: s.engineId, skill_id: s.skillId, name: s.name, source: 'dynamic' }));
        return { content: [{ type: 'text' as const, text: JSON.stringify({ skills: [...builtIn, ...dynamic], total: builtIn.length + dynamic.length }, null, 2) }] };
      },
    );
  }

  return server;
}
