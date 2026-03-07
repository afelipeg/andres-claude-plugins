// ─── Consumption Routes ─────────────────────────────────────────────
// Token/call usage tracking for the Consumption dashboard page.
// GET /v1/consumption/tokens    — daily token usage (30d)
// GET /v1/consumption/engines   — per-engine consumption
// GET /v1/consumption/protocols — protocol distribution
// GET /v1/consumption/tools     — tool invocation metrics
// GET /v1/consumption/datasets  — per-platform dataset stats

import { Hono } from 'hono';
import type { ConnectorInfra } from '../connectors/setup.js';
import type { AgentRegistry } from './agents.js';

// ─── In-memory consumption tracking ─────────────────────────────────
// These get populated by middleware/event listeners in production.

interface TokenRecord {
  date: string;
  tokens: number;
  mcp_client: number;
  mcp_server: number;
  a2a_calls: number;
  tool_calls: number;
}

interface ToolRecord {
  name: string;
  invocations: number;
  total_latency_ms: number;
  errors: number;
}

const dailyTokens: TokenRecord[] = [];
const toolMetrics = new Map<string, ToolRecord>();

/** Call this from event listeners to track consumption */
export function trackTokenUsage(tokens: number, source: 'mcp_client' | 'mcp_server' | 'a2a' | 'rest'): void {
  const today = new Date().toISOString().split('T')[0]!;
  let record = dailyTokens.find((r) => r.date === today);
  if (!record) {
    record = { date: today, tokens: 0, mcp_client: 0, mcp_server: 0, a2a_calls: 0, tool_calls: 0 };
    dailyTokens.push(record);
  }
  record.tokens += tokens;
  if (source === 'mcp_client') record.mcp_client++;
  if (source === 'mcp_server') record.mcp_server++;
  if (source === 'a2a') record.a2a_calls++;
  record.tool_calls++;
}

export function trackToolCall(toolName: string, latencyMs: number, error?: boolean): void {
  let record = toolMetrics.get(toolName);
  if (!record) {
    record = { name: toolName, invocations: 0, total_latency_ms: 0, errors: 0 };
    toolMetrics.set(toolName, record);
  }
  record.invocations++;
  record.total_latency_ms += latencyMs;
  if (error) record.errors++;
}

export function consumptionRoutes(
  connectorInfra: ConnectorInfra,
  registry: AgentRegistry,
) {
  const app = new Hono();

  // ─── Daily token usage ─────────────────────────────────────────
  app.get('/v1/consumption/tokens', (c) => {
    const days = Math.min(90, Math.max(1, parseInt(c.req.query('days') ?? '30', 10)));
    const recent = dailyTokens.slice(-days);
    const totalTokens = recent.reduce((sum, r) => sum + r.tokens, 0);
    const totalCalls = recent.reduce((sum, r) => sum + r.tool_calls, 0);

    return c.json({
      daily: recent,
      summary: {
        total_tokens: totalTokens,
        total_calls: totalCalls,
        avg_tokens_per_day: recent.length > 0 ? Math.round(totalTokens / recent.length) : 0,
        days_tracked: recent.length,
      },
    });
  });

  // ─── Per-engine consumption ────────────────────────────────────
  app.get('/v1/consumption/engines', (c) => {
    const engines: Array<{
      id: string;
      tokens: number;
      calls: number;
      cycles_completed: number;
    }> = [];

    for (const [id, runtime] of registry.agents) {
      const state = runtime.getState();
      engines.push({
        id,
        tokens: 0, // populated when token tracking is wired to event bus
        calls: state.cycles_completed ?? 0,
        cycles_completed: state.cycles_completed ?? 0,
      });
    }

    return c.json({ engines });
  });

  // ─── Protocol distribution ─────────────────────────────────────
  app.get('/v1/consumption/protocols', (c) => {
    const totalMcpClient = dailyTokens.reduce((sum, r) => sum + r.mcp_client, 0);
    const totalMcpServer = dailyTokens.reduce((sum, r) => sum + r.mcp_server, 0);
    const totalA2a = dailyTokens.reduce((sum, r) => sum + r.a2a_calls, 0);
    const totalCalls = dailyTokens.reduce((sum, r) => sum + r.tool_calls, 0);
    const totalRest = Math.max(0, totalCalls - totalMcpClient - totalMcpServer - totalA2a);

    const total = totalMcpClient + totalMcpServer + totalA2a + totalRest || 1;

    return c.json({
      protocols: [
        { name: 'MCP Client', calls: totalMcpClient, percentage: Math.round((totalMcpClient / total) * 10000) / 100 },
        { name: 'MCP Server', calls: totalMcpServer, percentage: Math.round((totalMcpServer / total) * 10000) / 100 },
        { name: 'A2A', calls: totalA2a, percentage: Math.round((totalA2a / total) * 10000) / 100 },
        { name: 'REST', calls: totalRest, percentage: Math.round((totalRest / total) * 10000) / 100 },
      ],
    });
  });

  // ─── Tool invocation metrics ───────────────────────────────────
  app.get('/v1/consumption/tools', (c) => {
    const tools = Array.from(toolMetrics.values()).map((t) => ({
      name: t.name,
      invocations: t.invocations,
      avg_latency_ms: t.invocations > 0 ? Math.round(t.total_latency_ms / t.invocations) : 0,
      errors: t.errors,
      error_rate: t.invocations > 0 ? Math.round((t.errors / t.invocations) * 10000) / 100 : 0,
    }));

    tools.sort((a, b) => b.invocations - a.invocations);

    return c.json({ tools });
  });

  // ─── Per-platform dataset stats ────────────────────────────────
  app.get('/v1/consumption/datasets', (c) => {
    const platforms = connectorInfra.credentialStore.platforms();
    const datasets = platforms.map((platform) => {
      const syncResult = connectorInfra.syncResultCache.get(platform);
      return {
        platform,
        datasets: syncResult ? 1 : 0,
        records: syncResult?.row_count ?? 0,
        last_sync: syncResult?.synced_at ?? null,
        status: syncResult?.status ?? 'pending',
      };
    });

    return c.json({
      platforms: datasets,
      total_datasets: datasets.reduce((sum, d) => sum + d.datasets, 0),
      total_records: datasets.reduce((sum, d) => sum + d.records, 0),
    });
  });

  return app;
}
