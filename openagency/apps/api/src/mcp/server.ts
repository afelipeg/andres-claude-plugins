// ─── MCP Server Factory ─────────────────────────────────────────────
// Registers all engine skills + agent management as MCP tools.

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { OpenAgency } from '@openagency/core';
import { calculateBillingFromEngines } from '@openagency/core';
import type { EngineOutputs } from '@openagency/core';
import { parseFile } from '@openagency/core/data/file-parser';
import { detectPlatform } from '@openagency/core/data/platform-detect';
import { SKILL_SCHEMAS, type DynamicSkillRegistry } from '@openagency/schemas';
import type { OodaRuntime, MeshCoordinator, A2AClient, McpClientRegistry, PipelineScheduler } from '@openagency/agent';
import type { HFLCoordinator } from '@openagency/hfl';
import type { ConnectorPlatform, OAuthTokens } from '@openagency/types';
import { getConnector, hasConnector } from '@openagency/connectors';
import { extractChartsFromLayerOne } from '@openagency/engines';
import type { ConnectorInfra } from '../connectors/setup.js';
import type { FileRepo, AgencyRepo, QuotaRepo } from '@openagency/memory';

const VALID_PLATFORMS = new Set<string>([
  'google_ads', 'meta_ads', 'dv360', 'tiktok_ads', 'tiktok_shop', 'amazon_ads',
]);

function isValidPlatform(p: string): p is ConnectorPlatform {
  return VALID_PLATFORMS.has(p);
}

// ─── MCP Coercion Layer ──────────────────────────────────────────────
// MCP transports serialize ALL values as strings. Zod schemas with z.number()
// reject string "150000". This function transforms a ZodRawShape so that
// numeric/boolean/array/object fields use z.coerce or z.preprocess.
function coerceZodShape(shape: Record<string, unknown>): Record<string, unknown> {
  const coerced: Record<string, unknown> = {};
  for (const [key, zodType] of Object.entries(shape)) {
    coerced[key] = coerceZodType(zodType);
  }
  return coerced;
}

function coerceZodType(zodType: unknown): unknown {
  if (!zodType || typeof zodType !== 'object' || !('_def' in (zodType as Record<string, unknown>))) return zodType;
  const def = (zodType as { _def: Record<string, unknown> })._def;
  const typeName = def.typeName as string | undefined;

  if (typeName === 'ZodNumber') {
    // z.number() → z.coerce.number() (accepts strings)
    // Preserve .positive(), .min(), .max() checks via .pipe()
    return z.preprocess((val: unknown) => {
      if (typeof val === 'string') { const n = Number(val); return isNaN(n) ? val : n; }
      return val;
    }, zodType as z.ZodTypeAny);
  }
  if (typeName === 'ZodBoolean') {
    return z.preprocess((val: unknown) => {
      if (typeof val === 'string') return val === 'true' || val === '1';
      return val;
    }, zodType as z.ZodTypeAny);
  }
  if (typeName === 'ZodArray' || typeName === 'ZodObject' || typeName === 'ZodRecord') {
    return z.preprocess((val: unknown) => {
      if (typeof val === 'string') { try { return JSON.parse(val); } catch { return val; } }
      return val;
    }, zodType as z.ZodTypeAny);
  }
  if (typeName === 'ZodOptional' && def.innerType) {
    return (coerceZodType(def.innerType) as z.ZodTypeAny).optional();
  }
  if (typeName === 'ZodDefault' && def.innerType) {
    const defaultValue = def.defaultValue as () => unknown;
    return (coerceZodType(def.innerType) as z.ZodTypeAny).default(defaultValue());
  }
  if (typeName === 'ZodUnion' && Array.isArray(def.options)) {
    // For unions like z.union([z.record(), z.number()]), coerce each option
    const coercedOptions = (def.options as unknown[]).map(opt => coerceZodType(opt));
    if (coercedOptions.length >= 2) {
      return z.preprocess((val: unknown) => {
        if (typeof val === 'string') {
          // Try number first, then JSON parse
          const n = Number(val);
          if (!isNaN(n)) return n;
          try { return JSON.parse(val); } catch { return val; }
        }
        return val;
      }, zodType as z.ZodTypeAny);
    }
  }
  return zodType;
}

export function createMcpServer(
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
  authContext?: { sub: string; role?: string },
): McpServer {
  const server = new McpServer({
    name: 'openagency',
    version: '3.0.0',
  });

  // ─── Type coercion for MCP transport ───────────────────────────────
  // MCP transports may serialize all values as strings. This function
  // coerces string values back to their expected types using the Zod schema.
  function coerceArgs(args: Record<string, unknown>, schema: unknown): Record<string, unknown> {
    if (!schema || typeof schema !== 'object' || !('shape' in (schema as Record<string, unknown>))) return args;
    const shape = (schema as { shape: Record<string, unknown> }).shape;
    const coerced = { ...args };
    for (const [key, value] of Object.entries(coerced)) {
      if (typeof value !== 'string') continue;
      const fieldSchema = shape[key];
      if (!fieldSchema || typeof fieldSchema !== 'object') continue;
      // Unwrap ZodOptional / ZodDefault
      let inner = fieldSchema as Record<string, unknown>;
      while (inner && '_def' in inner) {
        const def = inner['_def'] as { typeName?: string; innerType?: unknown };
        if (def.typeName === 'ZodOptional' || def.typeName === 'ZodDefault') {
          inner = def.innerType as Record<string, unknown>;
        } else break;
      }
      const typeName = (inner?.['_def'] as { typeName?: string } | undefined)?.typeName;
      if (typeName === 'ZodNumber') {
        const num = Number(value);
        if (!isNaN(num)) coerced[key] = num;
      } else if (typeName === 'ZodBoolean') {
        coerced[key] = value === 'true' || value === '1';
      } else if (typeName === 'ZodArray' || typeName === 'ZodObject') {
        try { coerced[key] = JSON.parse(value); } catch { /* keep as string */ }
      }
    }
    return coerced;
  }

  // Register all skills as MCP tools
  for (const entry of SKILL_SCHEMAS) {
    const toolName = `${entry.engineId}_${entry.skillId}`.replace(/-/g, '_');
    // McpServer.tool() expects a ZodRawShape (Zod types, NOT JSON Schema).
    // MCP transports send ALL values as strings → z.number() rejects them.
    // coerceZodShape wraps numeric/boolean/array fields with z.preprocess.
    const rawShape = ('shape' in entry.inputSchema ? entry.inputSchema.shape : {}) as Record<string, unknown>;
    const zodShape = coerceZodShape(rawShape);

    server.tool(
      toolName,
      entry.description,
      zodShape,
      async (args: Record<string, unknown>) => {
        try {
          const coercedArgs = coerceArgs(args, entry.inputSchema);
          const result = await agency.run(entry.engineId, entry.skillId, coercedArgs);

          // Build response with visualization hints for Claude to create interactive artifacts
          const chartableEngines = ['leak-detector', 'media-architect', 'campaign-ops', 'executive-bridge'];
          let response = result as unknown as Record<string, unknown>;

          if (chartableEngines.includes(entry.engineId)) {
            try {
              const resultData = response?.data ?? response;
              const layerOneKey = entry.engineId.replace(/-/g, '_');
              const charts = extractChartsFromLayerOne({ [layerOneKey]: resultData });
              if (charts.length > 0) {
                response = {
                  ...response,
                  visualization_hints: charts.map(c => ({
                    chart_type: c.type,
                    title: c.title,
                    data: c.data,
                    options: c.options,
                  })),
                  _viz_instruction: 'Create interactive React artifacts using Recharts for each visualization_hint. Use KPI cards for summary metrics, color-coded bars, and tooltips. Style with a professional dark/light theme.',
                };
              }
            } catch { /* hints are best-effort */ }
          }

          return {
            content: [{ type: 'text' as const, text: JSON.stringify(response, null, 2) }],
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
      content_base64: z.string().describe('Base64-encoded file content'),
      filename: z.string().describe('Original filename with extension (e.g. "report.xlsx")'),
    },
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
      { agent_id: z.string().describe('Agent ID to start') },
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
      { agent_id: z.string().describe('Agent ID to stop') },
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
      { agent_id: z.string().describe('Agent ID to cycle') },
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
        agent_id: z.string().describe('Agent ID'),
        decision_id: z.string().describe('Decision ID to approve'),
      },
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
        platform: z.string().describe('Platform ID (google_ads, meta_ads, dv360, tiktok_ads, tiktok_shop, amazon_ads)'),
        tokens: z.object({
          access_token: z.string().describe('OAuth access token'),
          refresh_token: z.string().optional().describe('OAuth refresh token'),
          token_type: z.string().describe('Token type (e.g. "Bearer")'),
          expires_at: z.coerce.number().describe('Token expiry timestamp'),
          scope: z.string().optional().describe('OAuth scope'),
        }).describe('OAuth tokens'),
        account_id: z.string().optional().describe('Ad account ID'),
        manager_id: z.string().optional().describe('Manager/MCC account ID (Google Ads)'),
        developer_token: z.string().optional().describe('Developer token (Google Ads)'),
        app_id: z.string().optional().describe('App ID'),
        profile_id: z.string().optional().describe('Profile ID (Amazon Ads)'),
      },
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
        platform: z.string().describe('Platform ID to disconnect'),
      },
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
        platform: z.string().describe('Platform ID'),
      },
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
        platform: z.string().describe('Platform ID to sync'),
        date_range_days: z.coerce.number().describe('Number of days to sync (default: 30)'),
      },
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
        platform: z.string().describe('Platform ID'),
      },
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
      'Execute a multi-agent optimization pipeline. Triggers a full 4-stage Leak Detector → Media Architect → Campaign Ops → Executive Bridge workflow. Set auto_sync=true to pull fresh data from all connected platforms before running. This single tool call replaces an entire agency engagement. NOTE: This can take 60-120 seconds for multi-stage pipelines. Use pipeline_id "full-optimization" for the standard 4-engine pipeline or "full-with-deliverables" for 5-engine pipeline including report generation.',
      {
        pipeline_id: z.string().describe('Pipeline ID to execute (e.g. "full-optimization")'),
        goal_id: z.string().optional().describe('Optional goal ID to associate with this run'),
        auto_sync: z.coerce.boolean().describe('If true, sync all connected platforms before executing the pipeline'),
        date_range_days: z.coerce.number().describe('Days of data to sync when auto_sync is true (default: 30)'),
      },
      async (args: Record<string, unknown>) => {
        try {
          // FIX 4: Quota enforcement before MCP pipeline execution
          if (agencyRepo && quotaRepo && authContext?.sub) {
            const agencyId = await agencyRepo.resolveForUser(authContext.sub);
            if (agencyId) {
              const ag = await agencyRepo.findById(agencyId);
              if (ag) {
                const runType: 'initial' | 'optimization' = 'initial';
                const quota = await quotaRepo.checkRunQuota(agencyId, ag.brand_count, runType);
                if (!quota.allowed) {
                  return {
                    content: [{
                      type: 'text' as const,
                      text: JSON.stringify({
                        error: 'QUOTA_EXCEEDED',
                        run_type: runType,
                        used: quota.used,
                        limit: quota.limit,
                        month: quota.month,
                        message: quota.reason ?? `Monthly ${runType} run limit reached (${quota.used}/${quota.limit}).`,
                      }, null, 2),
                    }],
                    isError: true,
                  };
                }
              }
            }
          }

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

          // FIX 4: Increment quota after successful execution
          if (run.status === 'completed' && agencyRepo && quotaRepo && authContext?.sub) {
            const agencyId = await agencyRepo.resolveForUser(authContext.sub);
            if (agencyId) {
              quotaRepo.incrementRunUsage(agencyId, 'initial').catch(() => {});
            }
          }

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
        run_id: z.string().describe('The run ID returned by mesh_execute_pipeline'),
      },
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
        url: z.string().describe('Base URL of the remote agent (e.g. https://remote.openagency.ai)'),
      },
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
        base_url: z.string().describe('Base URL of the remote agent'),
        engine_id: z.string().describe('Remote engine ID'),
        skill_id: z.string().describe('Remote skill ID'),
        input: z.record(z.unknown()).describe('Skill input parameters'),
        api_key: z.string().optional().describe('Optional API key for authentication'),
      },
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
        name: z.string().describe('A unique name for this MCP server connection'),
        url: z.string().describe('URL of the MCP server endpoint'),
      },
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
        server_name: z.string().describe('Name of the connected MCP server'),
        tool_name: z.string().describe('Name of the tool to call'),
        arguments: z.record(z.unknown()).describe('Tool arguments'),
      },
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
        engine_id: z.string().describe('Engine to register the skill under'),
        skill_id: z.string().describe('Unique skill identifier'),
        name: z.string().describe('Human-readable skill name'),
        description: z.string().describe('What the skill does'),
        remote_url: z.string().describe('URL of the remote skill endpoint'),
        remote_api_key: z.string().optional().describe('Optional API key for the remote endpoint'),
      },
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
        engine_id: z.string().describe('Engine the skill belongs to'),
        skill_id: z.string().describe('Skill ID to execute'),
        input: z.record(z.unknown()).describe('Skill input parameters'),
      },
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

  // ─── HFL (Human Feedback Loop) MCP tools ───────────────────────
  if (hflCoordinator) {
    server.tool(
      'hfl_config',
      'View or modify the Human Feedback Loop configuration for a client. Controls auto-approve thresholds, channels, and escalation rules.',
      {
        client_id: z.string().describe('Client ID (default: "default")'),
      },
      async (args: Record<string, unknown>) => {
        const clientId = (args['client_id'] as string) || 'default';
        const config = hflCoordinator.getConfig(clientId);
        if (!config) {
          return { content: [{ type: 'text' as const, text: `No HFL config for client: ${clientId}` }], isError: true };
        }
        return { content: [{ type: 'text' as const, text: JSON.stringify(config, null, 2) }] };
      },
    );

    server.tool(
      'hfl_approve_run',
      'Approve a pending mesh run that was escalated for human review.',
      {
        run_id: z.string().describe('The mesh run ID to approve'),
        feedback: z.string().optional().describe('Optional feedback message'),
      },
      async (args: Record<string, unknown>) => {
        const decision = await hflCoordinator.approveRun(
          args['run_id'] as string,
          args['feedback'] as string | undefined,
        );
        if (!decision) {
          return { content: [{ type: 'text' as const, text: 'No pending decision for this run' }], isError: true };
        }
        return { content: [{ type: 'text' as const, text: JSON.stringify(decision, null, 2) }] };
      },
    );

    server.tool(
      'hfl_reject_run',
      'Reject a pending mesh run with optional feedback explaining why.',
      {
        run_id: z.string().describe('The mesh run ID to reject'),
        feedback: z.string().optional().describe('Feedback explaining the rejection reason'),
      },
      async (args: Record<string, unknown>) => {
        const decision = await hflCoordinator.rejectRun(
          args['run_id'] as string,
          args['feedback'] as string | undefined,
        );
        if (!decision) {
          return { content: [{ type: 'text' as const, text: 'No pending decision for this run' }], isError: true };
        }
        return { content: [{ type: 'text' as const, text: JSON.stringify(decision, null, 2) }] };
      },
    );

    server.tool(
      'hfl_decisions',
      'List recent HFL decisions including auto-approved, escalated, and resolved runs.',
      {
        limit: z.coerce.number().describe('Max decisions to return (default: 50)'),
      },
      async (args: Record<string, unknown>) => {
        const limit = (args['limit'] as number) || 50;
        const decisions = hflCoordinator.listDecisions(limit);
        return { content: [{ type: 'text' as const, text: JSON.stringify({ decisions, count: decisions.length }, null, 2) }] };
      },
    );
  }

  // ─── Pipeline Scheduler MCP tools ───────────────────────────────
  if (scheduler && mesh) {
    server.tool(
      'schedule_pipeline',
      'Create a recurring pipeline schedule using a cron expression. The pipeline will run automatically on the defined schedule. Use this to set up weekly optimization runs, monthly reports, or daily status checks.',
      {
        client_id: z.string().describe('Client identifier for this schedule'),
        pipeline_id: z.string().describe('Pipeline ID to schedule (e.g. "full-optimization")'),
        cron: z.string().describe('5-part cron expression: "min hour dom month dow". Example: "0 6 * * 1" = Mondays at 6am'),
        auto_approve: z.coerce.boolean().describe('If true, skip HFL escalation when risk is below threshold (default: false)'),
        notify_on_complete: z.coerce.boolean().describe('Send notification when schedule fires and pipeline completes (default: true)'),
      },
      async (args: Record<string, unknown>) => {
        const { client_id, pipeline_id, cron } = args;
        if (!client_id || !pipeline_id || !cron) {
          return { content: [{ type: 'text' as const, text: 'client_id, pipeline_id, and cron are required' }], isError: true };
        }
        const pipeline = mesh.getPipeline(pipeline_id as string);
        if (!pipeline) {
          return { content: [{ type: 'text' as const, text: `Pipeline not found: ${pipeline_id}` }], isError: true };
        }
        try {
          const schedule = await scheduler.createSchedule({
            client_id: client_id as string,
            pipeline_id: pipeline_id as string,
            cron: cron as string,
            auto_approve: args['auto_approve'] as boolean | undefined,
            notify_on_complete: args['notify_on_complete'] as boolean | undefined,
          });
          return { content: [{ type: 'text' as const, text: JSON.stringify(schedule, null, 2) }] };
        } catch (err) {
          return { content: [{ type: 'text' as const, text: `Error: ${err instanceof Error ? err.message : String(err)}` }], isError: true };
        }
      },
    );

    server.tool(
      'list_schedules',
      'List all pipeline schedules. Optionally filter by client_id. Returns schedule details including cron expression, next run time, last run time, and enabled status.',
      {
        client_id: z.string().optional().describe('Optional: filter schedules by client ID'),
      },
      async (args: Record<string, unknown>) => {
        const schedules = scheduler.listSchedules(args['client_id'] as string | undefined);
        return {
          content: [{ type: 'text' as const, text: JSON.stringify({ schedules, total: schedules.length }, null, 2) }],
        };
      },
    );

    server.tool(
      'delete_schedule',
      'Delete a pipeline schedule by ID. The pipeline will no longer run automatically after deletion.',
      {
        schedule_id: z.string().describe('Schedule ID to delete'),
      },
      async (args: Record<string, unknown>) => {
        const id = args['schedule_id'] as string;
        if (!id) {
          return { content: [{ type: 'text' as const, text: 'schedule_id is required' }], isError: true };
        }
        const deleted = await scheduler.deleteSchedule(id);
        if (!deleted) {
          return { content: [{ type: 'text' as const, text: `Schedule not found: ${id}` }], isError: true };
        }
        return { content: [{ type: 'text' as const, text: JSON.stringify({ deleted: true, id }, null, 2) }] };
      },
    );
  }

  // ─── Delivery Engine MCP tools ───────────────────────────────────
  // NOTE: The 10 delivery skills are already registered by the SKILL_SCHEMAS
  // loop above (they are in the schemas registry as engineId='delivery').
  // Only register the additional delivery_list_files tool here.

  // delivery_list_files — list delivery files for a client or run
  server.tool(
    'delivery_list_files',
    'List generated delivery files. Filter by client_id or run_id.',
    {
      client_id: z.string().optional().describe('Client ID to filter files'),
      run_id: z.string().optional().describe('Run ID to filter files'),
    },
    async (args: Record<string, unknown>) => {
      if (!fileRepo) {
        return { content: [{ type: 'text' as const, text: JSON.stringify({ files: [], note: 'No database connected' }) }] };
      }
      try {
        const clientId = args['client_id'] as string | undefined;
        const runId = args['run_id'] as string | undefined;
        const records = runId
          ? await fileRepo.listByRun(runId)
          : clientId
            ? await fileRepo.listByClient(clientId)
            : [];
        return { content: [{ type: 'text' as const, text: JSON.stringify({ files: records, total: records.length }, null, 2) }] };
      } catch (err) {
        return { content: [{ type: 'text' as const, text: `Error: ${err instanceof Error ? err.message : String(err)}` }], isError: true };
      }
    },
  );

  // ─── Analyze Ad Data — Bridge Tool for MCP Composition ─────────────
  // This is the PRIMARY tool for the composition flow:
  //   Google Ads MCP (data) → Plinth MCP (analyze_ad_data) → results + billing
  // Accepts raw campaign metrics from ANY source (Google Ads MCP, Meta MCP,
  // CSV upload, manual input) and runs the full 4-engine pipeline.
  server.tool(
    'analyze_ad_data',
    'Run the full Plinth analytical pipeline on advertising data. Accepts raw campaign metrics from any source (Google Ads, Meta, TikTok, Amazon, CSV exports, or manual input). Runs 4 engines: Leak Detector (waste waterfall) → Media Architect (MMM optimization) → Campaign Ops (reallocation) → Executive Bridge (revenue translation). Returns waste analysis, optimization recommendations, and billing summary. This is the main tool for MCP composition — feed it data from platform MCPs.',
    {
      ad_spend: z.coerce.number().describe('Total ad spend in the period (USD). Required.'),
      gross_spend: z.coerce.number().optional().describe('Gross spend before agency fees (defaults to ad_spend if omitted)'),
      impressions: z.coerce.number().optional().describe('Total impressions across all campaigns'),
      clicks: z.coerce.number().optional().describe('Total clicks across all campaigns'),
      conversions: z.coerce.number().optional().describe('Total conversions (purchases, signups, etc.)'),
      revenue: z.coerce.number().optional().describe('Total revenue attributed to ads'),
      cost_per_conversion: z.coerce.number().optional().describe('Average cost per conversion'),
      ctr: z.coerce.number().optional().describe('Click-through rate as decimal (e.g. 0.02 for 2%)'),
      roas: z.coerce.number().optional().describe('Return on ad spend ratio (e.g. 3.5 means $3.50 revenue per $1 spent)'),
      platform: z.string().optional().describe('Source platform: google_ads, meta_ads, tiktok_ads, amazon_ads, dv360, mixed'),
      campaigns: z.preprocess((v: unknown) => typeof v === 'string' ? JSON.parse(v as string) : v, z.array(z.record(z.unknown())).optional()).describe('Optional array of per-campaign data objects'),
      channels: z.preprocess((v: unknown) => typeof v === 'string' ? JSON.parse(v as string) : v, z.array(z.record(z.unknown())).optional()).describe('Optional array of channel spend breakdown'),
      period_days: z.coerce.number().optional().describe('Number of days in the reporting period (default: 30)'),
      client_id: z.string().optional().describe('Client identifier for billing and file storage (default: "mcp-client")'),
      engines: z.preprocess((v: unknown) => typeof v === 'string' ? JSON.parse(v as string) : v, z.array(z.string()).optional()).describe('Optional engine filter'),
      generate_report: z.coerce.boolean().optional().describe('If true, also generate a PDF/PPTX monthly report deliverable after analysis'),
    },
    async (args: Record<string, unknown>) => {
      try {
        // Zod coercion handles string→number/boolean/array conversion via z.coerce + z.preprocess
        const adSpend = args['ad_spend'] as number;
        if (!adSpend || adSpend <= 0) {
          return { content: [{ type: 'text' as const, text: 'ad_spend is required and must be > 0' }], isError: true };
        }

        const clientId = (args['client_id'] as string) || 'mcp-client';

        // Build engine input from the provided metrics
        const data: Record<string, unknown> = {
          gross_spend: (args['gross_spend'] as number) || adSpend,
          ad_spend: adSpend,
          impressions: args['impressions'] ?? 0,
          clicks: args['clicks'] ?? 0,
          conversions: args['conversions'] ?? 0,
          revenue: args['revenue'] ?? 0,
          cost_per_conversion: args['cost_per_conversion'] ?? 0,
          historical_ctr: args['ctr'] ?? 0,
          roas: args['roas'] ?? 0,
          platform: args['platform'] ?? 'mixed',
          campaigns: args['campaigns'] ?? [],
          channels: args['channels'] ?? [],
          period_days: args['period_days'] ?? 30,
          client_id: clientId,
        };

        // Determine which engines to run
        const engineIds = (args['engines'] as string[]) ?? [
          'leak-detector', 'media-architect', 'campaign-ops', 'executive-bridge',
        ];
        const skillMap: Record<string, string> = {
          'leak-detector': 'waste-waterfall',
          'media-architect': 'mmm-optimize',
          'campaign-ops': 'optimization-analyze',
          'executive-bridge': 'revenue-translate',
        };

        // Run engines concurrently
        const engineOutputs: EngineOutputs = { ad_spend: adSpend };
        const engineResults: Record<string, unknown> = {};

        const tasks = engineIds.map(async (engineId) => {
          const skillId = skillMap[engineId];
          if (!skillId) return { engineId, result: null, error: `Unknown engine: ${engineId}` };
          try {
            const result = await agency.run(engineId, skillId, data);
            return { engineId, skillId, result, error: null };
          } catch (err) {
            return { engineId, skillId: skillId, result: null, error: err instanceof Error ? err.message : String(err) };
          }
        });

        const settled = await Promise.all(tasks);

        for (const { engineId, skillId, result, error } of settled) {
          if (error) {
            engineResults[engineId] = { error };
          } else if (result && skillId) {
            engineResults[engineId] = result;
            // Map to billing outputs
            const innerData = ((result as unknown as Record<string, unknown>).data ?? {}) as Record<string, unknown>;
            if (engineId === 'leak-detector' && skillId === 'waste-waterfall') {
              if (!engineOutputs.leak_detector) engineOutputs.leak_detector = {};
              engineOutputs.leak_detector.waste_waterfall = innerData;
            } else if (engineId === 'media-architect' && skillId === 'mmm-optimize') {
              if (!engineOutputs.media_architect) engineOutputs.media_architect = {};
              engineOutputs.media_architect.mmm_optimize = innerData;
            } else if (engineId === 'campaign-ops' && skillId === 'optimization-analyze') {
              if (!engineOutputs.campaign_ops) engineOutputs.campaign_ops = {};
              engineOutputs.campaign_ops.optimization_analyze = innerData;
            } else if (engineId === 'executive-bridge' && skillId === 'revenue-translate') {
              if (!engineOutputs.executive_bridge) engineOutputs.executive_bridge = {};
              engineOutputs.executive_bridge.revenue_translate = innerData;
            }
          }
        }

        const billing = calculateBillingFromEngines(engineOutputs);

        // Optionally generate a report deliverable
        let deliverable: unknown = undefined;
        if (args['generate_report']) {
          try {
            const reportResult = await agency.run('delivery', 'monthly-report', {
              client_id: clientId,
              run_id: `mcp-${Date.now()}`,
              layer_one_results: {
                leak_detector: engineResults['leak-detector'],
                media_architect: engineResults['media-architect'],
                campaign_ops: engineResults['campaign-ops'],
                executive_bridge: engineResults['executive-bridge'],
                client_id: clientId,
              },
            });
            deliverable = reportResult;
          } catch (err) {
            deliverable = { error: err instanceof Error ? err.message : String(err) };
          }
        }

        const response: Record<string, unknown> = {
          ad_spend: adSpend,
          client_id: clientId,
          engines_executed: engineIds,
          engine_results: engineResults,
          billing,
          ...(deliverable ? { report: deliverable } : {}),
        };

        // Extract visualization hints for Claude to create interactive artifacts
        try {
          const layerOneData = {
            leak_detector: engineResults['leak-detector'],
            media_architect: engineResults['media-architect'],
            campaign_ops: engineResults['campaign-ops'],
            executive_bridge: engineResults['executive-bridge'],
          };
          const charts = extractChartsFromLayerOne(layerOneData);

          // Add spend overview from input channels
          if (Array.isArray(data.channels) && (data.channels as Array<{ channel: string; spend: number }>).length > 0) {
            const channelData = data.channels as Array<{ channel: string; spend: number }>;
            charts.unshift({
              type: 'bar' as const,
              title: 'Spend by Channel',
              data: channelData.map(ch => ({ label: ch.channel, value: ch.spend })),
            });
          }

          if (charts.length > 0) {
            response.visualization_hints = charts.map(c => ({
              chart_type: c.type,
              title: c.title,
              data: c.data,
              options: c.options,
            }));
            response._viz_instruction = 'Create interactive React artifacts using Recharts for each visualization_hint. Include: KPI summary cards (ad_spend, waste, productive spend, ROAS, billing fees) with color-coded deltas, interactive charts with tooltips, and a formatted data table. Use a professional dashboard layout. Group charts by engine: Leak Detector, Media Architect, Campaign Ops, Executive Bridge.';
          }
        } catch {
          // Hints are best-effort
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

  // ─── Get File Content — Base64 artifact delivery for Claude Desktop ──
  // Claude Desktop can't open URLs. This tool returns the raw file as base64
  // so Claude can display it or offer to save it locally.
  if (fileRepo) {
    server.tool(
      'get_file_content',
      'Download a delivery file as base64-encoded content. Use this after analyze_ad_data with generate_report=true, or after running any delivery skill. Returns the file bytes as base64 that Claude can save locally or display.',
      {
        file_id: z.string().describe('The file ID from the delivery skill output'),
      },
      async (args: Record<string, unknown>) => {
        try {
          const fileId = args['file_id'] as string;
          if (!fileId) {
            return { content: [{ type: 'text' as const, text: 'file_id is required' }], isError: true };
          }

          const record = await fileRepo.get(fileId);
          if (!record) {
            return { content: [{ type: 'text' as const, text: `File not found: ${fileId}` }], isError: true };
          }

          // Read file from storage backend
          const { createFileStorage } = await import('@openagency/engines');
          const storage = createFileStorage();
          const buffer = await storage.readBuffer(record.file_path);
          const base64 = buffer.toString('base64');

          const mimeMap: Record<string, string> = {
            pdf: 'application/pdf',
            pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
            docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          };

          return {
            content: [{
              type: 'text' as const,
              text: JSON.stringify({
                file_id: record.id,
                file_type: record.file_type,
                filename: `${record.skill_id}-${record.id}.${record.file_type}`,
                mime_type: mimeMap[record.file_type] ?? 'application/octet-stream',
                size_bytes: record.size_bytes,
                base64_content: base64,
              }),
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
  }

  return server;
}
