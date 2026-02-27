// ─── API-to-Engine Transform Bridge ─────────────────────────────────
// Converts NormalizedCampaignRow[] from API connectors to engine input shapes.
// Mirrors the 5 CSV transforms in platform-detect.ts but operates on
// already-normalized data (no column mapping needed).

import type { NormalizedCampaignRow } from '@openagency/types';

/**
 * Transform API rows into waste waterfall input for the Leak Detector.
 * Aggregates spend/revenue across all campaigns.
 */
export function apiToWasteInput(
  rows: NormalizedCampaignRow[],
): { gross_spend: number; industry: string; actual_revenue?: number } {
  let totalSpend = 0;
  let totalRevenue = 0;

  for (const row of rows) {
    totalSpend += row.spend;
    totalRevenue += row.revenue;
  }

  return {
    gross_spend: round2(totalSpend),
    industry: 'retail',
    ...(totalRevenue > 0 ? { actual_revenue: round2(totalRevenue) } : {}),
  };
}

/**
 * Transform API rows into channel optimizer input for Media Architect.
 * Each unique campaign becomes a channel.
 */
export function apiToChannelInput(
  rows: NormalizedCampaignRow[],
): { total_budget: number; channels: Array<{ name: string; spend: number }> } {
  const channelMap = new Map<string, number>();

  for (const row of rows) {
    const existing = channelMap.get(row.campaign_name) ?? 0;
    channelMap.set(row.campaign_name, existing + row.spend);
  }

  let total = 0;
  const channels: Array<{ name: string; spend: number }> = [];
  for (const [name, spend] of channelMap) {
    channels.push({ name, spend: round2(spend) });
    total += spend;
  }

  return { total_budget: round2(total), channels };
}

/**
 * Transform API rows into optimization input for Campaign Ops.
 * Each row becomes a campaign with computed fields.
 */
export function apiToOptimizationInput(
  rows: NormalizedCampaignRow[],
  defaults?: { cpa_target?: number; roas_target?: number; days_elapsed?: number; days_total?: number },
): {
  campaigns: Array<Record<string, unknown>>;
} {
  const campaigns = rows.map((row) => ({
    name: row.campaign_name,
    channel: row.platform,
    spend: row.spend,
    budget: row.spend * 1.2, // estimate 20% headroom
    days_elapsed: defaults?.days_elapsed ?? 15,
    days_total: defaults?.days_total ?? 30,
    impressions: row.impressions,
    clicks: row.clicks,
    conversions: row.conversions,
    revenue: row.revenue,
    cpa_target: defaults?.cpa_target ?? 100,
    roas_target: defaults?.roas_target ?? 3.0,
    historical_ctr: row.ctr, // already a fraction
  }));

  return { campaigns };
}

/**
 * Transform API rows into MMM model input for Media Architect.
 * Aggregates by campaign name, computes ROI priors from revenue/spend.
 */
export function apiToMMMInput(
  rows: NormalizedCampaignRow[],
): {
  total_budget: number;
  total_kpi: number;
  time_periods: number;
  channels: Array<{ name: string; spend: number; roi_prior?: number }>;
} {
  const channelMap = new Map<string, { spend: number; revenue: number; conversions: number }>();

  for (const row of rows) {
    const existing = channelMap.get(row.campaign_name) ?? { spend: 0, revenue: 0, conversions: 0 };
    existing.spend += row.spend;
    existing.revenue += row.revenue;
    existing.conversions += row.conversions;
    channelMap.set(row.campaign_name, existing);
  }

  let totalBudget = 0;
  let totalKpi = 0;
  const channels: Array<{ name: string; spend: number; roi_prior?: number }> = [];

  for (const [name, agg] of channelMap) {
    totalBudget += agg.spend;
    totalKpi += agg.revenue > 0 ? agg.revenue : agg.conversions * 100;
    const roiPrior = agg.spend > 0 && agg.revenue > 0 ? agg.revenue / agg.spend : undefined;
    channels.push({
      name,
      spend: round2(agg.spend),
      ...(roiPrior != null ? { roi_prior: round2(roiPrior) } : {}),
    });
  }

  return {
    total_budget: round2(totalBudget),
    total_kpi: round2(totalKpi),
    time_periods: 52,
    channels,
  };
}

/**
 * Transform API rows into revenue bridge input for Executive Bridge.
 * Each row becomes a channel entry.
 */
export function apiToRevenueBridgeInput(
  rows: NormalizedCampaignRow[],
): {
  channels: Array<{
    name: string;
    spend: number;
    impressions: number;
    clicks: number;
    conversions: number;
    revenue?: number;
  }>;
} {
  const channels = rows.map((row) => ({
    name: row.campaign_name,
    spend: row.spend,
    impressions: row.impressions,
    clicks: row.clicks,
    conversions: row.conversions,
    ...(row.revenue > 0 ? { revenue: row.revenue } : {}),
  }));

  return { channels };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
