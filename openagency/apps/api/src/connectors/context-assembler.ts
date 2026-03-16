// ─── Context Assembler ──────────────────────────────────────────────
// Transforms live platform sync data + human batch uploads into the
// skillContext object that all 39 skills consume during pipeline execution.
//
// Data flow:
//   syncResultCache (NormalizedCampaignRow[]) → aggregated channels/campaigns
//   clientDataRepo (human uploads: sell-in/sell-out/digital)  → merged in
//   explicit context from POST body → merged last (overrides)

import type { ConnectorPlatform, NormalizedCampaignRow, SyncResult } from '@openagency/types';

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
    return {}; // No data available
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
