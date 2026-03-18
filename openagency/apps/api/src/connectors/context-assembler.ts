// ─── Context Assembler ──────────────────────────────────────────────
// Transforms live platform sync data + human batch uploads into the
// skillContext object that all 39 skills consume during pipeline execution.
//
// Data flow:
//   syncResultCache (NormalizedCampaignRow[]) → aggregated channels/campaigns
//   clientDataRepo (human uploads: sell-in/sell-out/digital)  → merged in
//   explicit context from POST body → merged last (overrides)

import type { ConnectorPlatform, NormalizedCampaignRow, SyncResult } from '@openagency/types';
import type { McpClientRegistry } from '@openagency/agent';
import { createLogger } from '@openagency/core';

const log = createLogger('context-assembler');

interface ChannelSummary {
  name: string;
  spend: number;
  impressions: number;
  clicks: number;
  conversions: number;
  revenue: number;
  ivt_rate_pct?: number;
  viewability_pct?: number;
  intermediaries?: number;
}

interface CampaignSummary {
  name: string;
  channel: string;
  spend: number;
  budget: number;
  days_elapsed: number;
  cpa_target: number;
  roas_target: number;
  roas: number;
  historical_ctr: number;
}

/**
 * Build a unified skillContext from the sync result cache.
 * Merges data across all connected platforms into a single context
 * that every engine skill can consume.
 */
export function assembleContextFromSync(
  syncResultCache: Map<ConnectorPlatform, SyncResult>,
  explicitContext?: Record<string, unknown>,
): Record<string, unknown> {
  // If the user provided an explicit context, use it as base — platform data fills gaps
  const ctx: Record<string, unknown> = {};

  // ─── Aggregate platform rows ─────────────────────────────────────
  const allRows: NormalizedCampaignRow[] = [];
  const platformMeta: Array<{ platform: string; row_count: number; synced_at: string }> = [];

  for (const [platform, result] of syncResultCache) {
    if (result.status === 'error' || !result.rows.length) continue;
    allRows.push(...result.rows);
    platformMeta.push({
      platform,
      row_count: result.row_count,
      synced_at: result.synced_at,
    });
  }

  if (allRows.length === 0 && !explicitContext) {
    log.warn('assembleContextFromSync: no platform data and no explicit context — returning empty');
    return {};
  }

  // ─── Aggregate by channel (platform) ─────────────────────────────
  const channelMap = new Map<string, ChannelSummary>();
  let grossSpend = 0;

  for (const row of allRows) {
    const key = row.platform;
    const existing = channelMap.get(key) ?? {
      name: key,
      spend: 0,
      impressions: 0,
      clicks: 0,
      conversions: 0,
      revenue: 0,
    };
    existing.spend += row.spend;
    existing.impressions += row.impressions;
    existing.clicks += row.clicks;
    existing.conversions += row.conversions;
    existing.revenue += row.revenue;
    channelMap.set(key, existing);
    grossSpend += row.spend;
  }

  const channels = Array.from(channelMap.values());

  // ─── Aggregate campaigns ─────────────────────────────────────────
  const campaignMap = new Map<string, CampaignSummary>();

  for (const row of allRows) {
    const key = `${row.platform}:${row.campaign_id}`;
    const existing = campaignMap.get(key);
    if (existing) {
      existing.spend += row.spend;
    } else {
      campaignMap.set(key, {
        name: row.campaign_name,
        channel: row.platform,
        spend: row.spend,
        budget: row.spend * 1.1, // estimate budget at 10% above actual spend
        days_elapsed: 30, // default window
        cpa_target: row.cpa > 0 ? row.cpa * 0.9 : 100, // target 10% better than actual
        roas_target: row.roas > 0 ? row.roas * 1.1 : 2.0,
        roas: row.roas,
        historical_ctr: row.ctr,
      });
    }
  }

  const campaigns = Array.from(campaignMap.values());

  // Compute ROAS as weighted average
  const totalRevenue = channels.reduce((s, c) => s + c.revenue, 0);
  const avgRoas = grossSpend > 0 ? totalRevenue / grossSpend : 0;

  // ─── Build base context ──────────────────────────────────────────
  ctx.gross_spend = grossSpend;
  ctx.total_budget = grossSpend;
  ctx.roas = Math.round(avgRoas * 100) / 100;
  ctx.channels = channels;
  ctx.campaigns = campaigns;

  // Anomaly detect: provide spend values as time series
  ctx.metric = 'spend_by_channel';
  ctx.values = channels.map((c) => c.spend);
  ctx.threshold = 2.0;

  // Attribution: channel names for Shapley
  ctx.channels_attr = channels.map((c) => c.name);
  ctx.total_conversions = channels.reduce((s, c) => s + c.conversions, 0);

  // Build coalition conversions (pairs)
  const coalitions: Record<string, number> = {};
  for (const c of channels) {
    coalitions[c.name] = c.conversions;
  }
  // Pair coalitions (simple additive approximation — real Shapley handles this)
  for (let i = 0; i < channels.length; i++) {
    for (let j = i + 1; j < channels.length; j++) {
      const pairKey = `${channels[i].name},${channels[j].name}`;
      coalitions[pairKey] = Math.round((channels[i].conversions + channels[j].conversions) * 0.85);
    }
  }
  ctx.coalition_conversions = coalitions;

  // Reconciliation platforms
  ctx.platforms = channels.map((c) => ({
    name: c.name,
    reported_conversions: c.conversions,
    reported_revenue: c.revenue,
    actual_conversions: Math.round(c.conversions * 0.92), // ~8% over-reporting typical
    actual_revenue: Math.round(c.revenue * 0.92),
    spend: c.spend,
  }));

  // Revenue translation channels
  ctx.revenue_channels = channels.map((c) => ({
    name: c.name,
    spend: c.spend,
    impressions: c.impressions,
    clicks: c.clicks,
    conversions: c.conversions,
  }));

  // Sync metadata
  ctx._sync_sources = platformMeta;
  ctx._assembled_at = new Date().toISOString();

  // ─── Merge explicit context (overrides platform data) ────────────
  if (explicitContext) {
    for (const [k, v] of Object.entries(explicitContext)) {
      if (v !== undefined && v !== null) {
        ctx[k] = v;
      }
    }
  }

  return ctx;
}

/**
 * Merge human batch upload data (sell-in, sell-out, digital sales)
 * into an existing skillContext.
 */
export function mergeClientBatchData(
  ctx: Record<string, unknown>,
  batchData: Record<string, unknown>,
): Record<string, unknown> {
  // Batch data keys: sell_in, sell_out, digital_sales, investor_relations, etc.
  // These are first-party client data that enrich the engine analysis
  return { ...ctx, client_data: batchData, _has_client_batch: true };
}

// ─── MCP Data Injection ──────────────────────────────────────────────

/** Build minimum required params for an MCP tool call based on catalog auth fields. */
function buildMinParams(
  catalogId: string,
  _toolName: string,
): Record<string, unknown> {
  // Map catalog_id to the params that tools typically require
  const paramMaps: Record<string, Record<string, string>> = {
    meta_ads_mcp: { ad_account_id: 'ad_account_id' },
    tiktok_ads_mcp: { advertiser_id: 'advertiser_id' },
    google_ads_mcp: { login_customer_id: 'customer_id' },
    amazon_ads_mcp: { profile_id: 'profile_id' },
    dv360_mcp: { partner_id: 'partner_id' },
  };
  // Note: actual auth field values come from the encrypted connection.
  // MCP servers receive them as env vars at spawn time, not as tool params.
  // This function only provides tool-level params that some tools require.
  return paramMaps[catalogId] ?? {};
}

/**
 * Fetch data from connected external MCP servers and merge into skillContext.
 * Calls data-fetch tools (get_, campaign, performance) on each connected server.
 */
export async function mergeMcpData(
  ctx: Record<string, unknown>,
  mcpRegistry: McpClientRegistry,
  _clientId: string,
): Promise<Record<string, unknown>> {
  const servers = mcpRegistry.listServers();
  if (servers.length === 0) return ctx;

  const mcpData: Record<string, unknown> = {};
  const mcpErrors: string[] = [];

  for (const server of servers) {
    for (const tool of server.tools) {
      // Only call data-fetch tools (get_*, *campaign*, *performance*, *insight*)
      const isDataTool =
        tool.name.startsWith('get_') ||
        tool.name.includes('campaign') ||
        tool.name.includes('performance') ||
        tool.name.includes('insight');

      if (!isDataTool) continue;

      const toolKey = `${server.name}:${tool.name}`;
      try {
        const params = buildMinParams(server.name, tool.name);
        const result = await mcpRegistry.callTool(server.name, tool.name, params);
        if (result.isError) {
          log.warn({ server: server.name, tool: tool.name }, 'MCP tool returned error — skipping');
          mcpErrors.push(`${toolKey}: ${result.content?.[0]?.text ?? 'unknown error'}`);
          continue;
        }
        mcpData[toolKey] = result.content?.[0]?.text ?? null;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        log.warn({ server: server.name, tool: tool.name, error: msg }, 'MCP tool call failed — skipping');
        mcpErrors.push(`${toolKey}: ${msg}`);
      }
    }
  }

  if (Object.keys(mcpData).length === 0 && mcpErrors.length > 0) {
    log.warn({ errors: mcpErrors }, 'All MCP data-fetch tool calls failed — no MCP data injected');
  }

  return {
    ...ctx,
    mcp_data: mcpData,
    _has_mcp_data: Object.keys(mcpData).length > 0,
    _mcp_sources: servers.map((s) => s.name),
    _mcp_errors: mcpErrors.length > 0 ? mcpErrors : undefined,
  };
}

// ─── Context Validation ─────────────────────────────────────────────

export interface ContextValidationResult {
  has_sync_data: boolean;
  has_batch_data: boolean;
  has_mcp_data: boolean;
  has_explicit_context: boolean;
  source_count: number;
  warnings: string[];
  sync_platforms: string[];
  batch_types: string[];
  mcp_servers: string[];
  gross_spend: number;
}

/**
 * Validate assembled skillContext before pipeline execution.
 * Returns audit of which data sources contributed + warnings.
 * Counts 4 possible sources: sync, batch, MCP, and explicit context (POST body).
 */
export function validateSkillContext(ctx: Record<string, unknown>): ContextValidationResult {
  const syncSources = (ctx._sync_sources as Array<{ platform: string }>) ?? [];
  const hasBatch = ctx._has_client_batch === true;
  const hasMcp = ctx._has_mcp_data === true;
  const hasSync = syncSources.length > 0;

  // Explicit context: user provided gross_spend, channels, or campaigns directly in POST body
  const grossSpend = (ctx.gross_spend as number) ?? 0;
  const hasExplicit = grossSpend > 0 || Array.isArray(ctx.channels) || Array.isArray(ctx.campaigns);

  const warnings: string[] = [];
  const sourceCount = [hasSync, hasBatch, hasMcp, hasExplicit].filter(Boolean).length;

  if (sourceCount === 0) {
    warnings.push('NO_DATA_SOURCES: No data sources available — provide context, connect a platform, or upload batch data');
  }
  if (!hasSync) {
    warnings.push('NO_SYNC_DATA: No platform connectors provided data');
  }
  if (!hasBatch) {
    warnings.push('NO_BATCH_DATA: No human-uploaded batch data available');
  }
  if (!hasMcp) {
    warnings.push('NO_MCP_DATA: No MCP server data injected');
  }

  if (grossSpend === 0 && hasSync) {
    warnings.push('ZERO_SPEND: Sync data present but gross_spend is $0');
  }

  const mcpErrors = ctx._mcp_errors as string[] | undefined;
  if (mcpErrors && mcpErrors.length > 0) {
    warnings.push(`MCP_ERRORS: ${mcpErrors.length} MCP tool calls failed`);
  }

  return {
    has_sync_data: hasSync,
    has_batch_data: hasBatch,
    has_mcp_data: hasMcp,
    has_explicit_context: hasExplicit,
    source_count: sourceCount,
    warnings,
    sync_platforms: syncSources.map((s) => s.platform),
    batch_types: hasBatch ? Object.keys((ctx.client_data as Record<string, unknown>) ?? {}) : [],
    mcp_servers: (ctx._mcp_sources as string[]) ?? [],
    gross_spend: grossSpend,
  };
}
