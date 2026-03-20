// ─── Revenue Bridge ─────────────────────────────────────────────────
// Translates L3 media -> L2 business -> L1 financial metrics.
// L3→L2→L1 revenue translation with CLV computation

import { round } from '@openagency/core/utils/math';
import type {
  RevenueBridgeInput,
  RevenueBridgeOutput,
  L1Metrics,
  L2Metrics,
  L3Metrics,
  CSuiteSummary,
} from '@openagency/types';

export function translate(data: RevenueBridgeInput): RevenueBridgeOutput {
  const channels = data.channels ?? [];
  const aov = data.aov ?? 100;
  const retentionRate = data.retention_rate ?? 0.3;
  const avgCustomerMonths = data.avg_customer_months ?? 12;

  let totalSpend = 0;
  let totalRevenue = 0;
  let totalConversions = 0;

  const channelResults: RevenueBridgeOutput['channels'] = [];

  for (const ch of channels) {
    const spend = ch.spend ?? 0;
    const impressions = ch.impressions ?? 0;
    const clicks = ch.clicks ?? 0;
    const conversions = ch.conversions ?? 0;
    const revenue = ch.revenue ?? conversions * aov;

    totalSpend += spend;
    totalRevenue += revenue;
    totalConversions += conversions;

    const l3: L3Metrics = {};
    if (impressions > 0) l3.cpm = round((spend / impressions) * 1000);
    if (clicks > 0) l3.cpc = round(spend / clicks);
    if (impressions > 0) l3.ctr = round((clicks / impressions) * 100);
    if (clicks > 0) l3.cvr = round((conversions / clicks) * 100);

    const l2: L2Metrics = {
      cpa: conversions > 0 ? round(spend / conversions) : 0,
      roas: spend > 0 ? round(revenue / spend) : 0,
      aov: conversions > 0 ? round(revenue / conversions) : 0,
      conversions,
    };

    channelResults.push({
      channel: ch.name,
      spend,
      revenue,
      l3_metrics: l3,
      l2_metrics: l2,
    });
  }

  // L1 Financial Metrics
  const cac = totalConversions > 0 ? round(totalSpend / totalConversions) : 0;
  const clv = round(aov * retentionRate * avgCustomerMonths);
  const clvCacRatio = cac > 0 ? round(clv / cac) : 0;
  const roi = totalSpend > 0 ? round(((totalRevenue - totalSpend) / totalSpend) * 100, 1) : 0;
  const marketingMargin = totalRevenue > 0
    ? round(((totalRevenue - totalSpend) / totalRevenue) * 100, 1)
    : 0;
  const roas = totalSpend > 0 ? totalRevenue / totalSpend : 0;

  const l1: L1Metrics = {
    cac,
    clv,
    clv_cac_ratio: clvCacRatio,
    roi_pct: roi,
    marketing_margin_pct: marketingMargin,
    total_revenue: totalRevenue,
    total_spend: totalSpend,
  };

  // Efficiency Score (0-100)
  const scores: number[] = [];
  if (clvCacRatio >= 3) scores.push(100);
  else if (clvCacRatio >= 1) scores.push(Math.round((clvCacRatio / 3) * 100));
  else scores.push(0);

  if (roas >= 4) scores.push(100);
  else if (roas >= 1) scores.push(Math.round((roas / 4) * 100));
  else scores.push(0);

  if (marketingMargin > 0) scores.push(Math.min(100, Math.round(marketingMargin * 2)));
  else scores.push(0);

  const efficiencyScore = scores.length > 0
    ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
    : 0;

  // C-Suite Summaries
  const topChannel = channelResults.length > 0
    ? channelResults.reduce((best, ch) =>
        (ch.l2_metrics.roas > best.l2_metrics.roas ? ch : best))
    : null;

  const csuite: CSuiteSummary = {
    ceo: `Marketing investment of $${totalSpend.toLocaleString()} generated $${totalRevenue.toLocaleString()} in revenue (${totalConversions.toLocaleString()} customers). Customer lifetime value is $${clv.toLocaleString()} vs acquisition cost of $${cac.toLocaleString()} (CLV:CAC = ${clvCacRatio}:1). ROI: ${roi}%.`,
    cfo: `Total spend: $${totalSpend.toLocaleString()}. Revenue: $${totalRevenue.toLocaleString()}. Marketing margin: ${marketingMargin}%. ROI: ${roi}%. Blended ROAS: ${roas.toFixed(2)}x. Efficiency score: ${efficiencyScore}/100.`,
    cmo: `Campaign delivered ${totalConversions.toLocaleString()} conversions across ${channels.length} channels at $${cac.toLocaleString()} CPA. ROAS: ${roas.toFixed(2)}x. Top channel by ROAS: ${topChannel?.channel ?? 'N/A'}.`,
  };

  return {
    l1_metrics: l1,
    efficiency_score: efficiencyScore,
    channels: channelResults,
    csuite_summary: csuite,
  };
}

export function compareChannels(data: {
  channels: Array<{ name: string; spend: number; revenue: number; conversions: number }>;
}) {
  const results = data.channels.map((ch) => ({
    channel: ch.name,
    spend: ch.spend,
    revenue: ch.revenue,
    roas: ch.spend > 0 ? round(ch.revenue / ch.spend) : 0,
    cpa: ch.conversions > 0 ? round(ch.spend / ch.conversions) : 0,
    efficiency_rank: 0,
  }));
  results.sort((a, b) => b.roas - a.roas);
  results.forEach((r, i) => (r.efficiency_rank = i + 1));
  return { comparison: results };
}
