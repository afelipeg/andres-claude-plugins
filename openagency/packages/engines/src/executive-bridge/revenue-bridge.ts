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
  const baselinePct = data.baseline_pct; // 0-1 fraction, e.g. 0.535 = 53.5% organic

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

  // L1 Financial Metrics (raw — assumes 100% media-driven)
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

  // Incremental metrics (MMM-adjusted) when baseline_pct is provided
  if (baselinePct != null && baselinePct >= 0 && baselinePct < 1) {
    const incrementalRevenue = round(totalRevenue * (1 - baselinePct));
    const iroas = totalSpend > 0 ? round(incrementalRevenue / totalSpend) : 0;
    const iroi = totalSpend > 0 ? round(((incrementalRevenue - totalSpend) / totalSpend) * 100, 1) : 0;
    const imargin = incrementalRevenue > 0
      ? round(((incrementalRevenue - totalSpend) / incrementalRevenue) * 100, 1)
      : 0;
    // Incremental conversions proportional to incremental revenue share
    const iConversions = totalRevenue > 0
      ? totalConversions * (incrementalRevenue / totalRevenue)
      : 0;
    const icac = iConversions > 0 ? round(totalSpend / iConversions) : 0;
    const iclvCac = icac > 0 ? round(clv / icac) : 0;

    l1.incremental = {
      baseline_pct: baselinePct,
      incremental_revenue: incrementalRevenue,
      iroas,
      iroi_pct: iroi,
      imarketing_margin_pct: imargin,
      iclv_cac_ratio: iclvCac,
      icac,
    };
  }

  // Efficiency Score — use incremental metrics when available, else raw
  const effectiveRoas = l1.incremental ? l1.incremental.iroas : roas;
  const effectiveClvCac = l1.incremental ? l1.incremental.iclv_cac_ratio : clvCacRatio;
  const effectiveMargin = l1.incremental ? l1.incremental.imarketing_margin_pct : marketingMargin;

  const scores: number[] = [];
  if (effectiveClvCac >= 3) scores.push(100);
  else if (effectiveClvCac >= 1) scores.push(Math.round((effectiveClvCac / 3) * 100));
  else scores.push(0);

  if (effectiveRoas >= 4) scores.push(100);
  else if (effectiveRoas >= 1) scores.push(Math.round((effectiveRoas / 4) * 100));
  else scores.push(0);

  if (effectiveMargin > 0) scores.push(Math.min(100, Math.round(effectiveMargin * 2)));
  else scores.push(0);

  const efficiencyScore = scores.length > 0
    ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
    : 0;

  // C-Suite Summaries — use incremental when available
  const topChannel = channelResults.length > 0
    ? channelResults.reduce((best, ch) =>
        (ch.l2_metrics.roas > best.l2_metrics.roas ? ch : best))
    : null;

  const inc = l1.incremental;
  const csuite: CSuiteSummary = inc
    ? {
        ceo: `Marketing investment of $${totalSpend.toLocaleString()} generated $${totalRevenue.toLocaleString()} total revenue, of which $${inc.incremental_revenue.toLocaleString()} is incremental (${round((1 - inc.baseline_pct) * 100, 1)}% media-driven, ${round(inc.baseline_pct * 100, 1)}% organic baseline). iROI: ${inc.iroi_pct}%. iCLV:CAC = ${inc.iclv_cac_ratio}:1.`,
        cfo: `Total spend: $${totalSpend.toLocaleString()}. Incremental revenue: $${inc.incremental_revenue.toLocaleString()} (baseline ${round(inc.baseline_pct * 100, 1)}% excluded). iROAS: ${inc.iroas.toFixed(2)}x. iMarketing margin: ${inc.imarketing_margin_pct}%. Efficiency score: ${efficiencyScore}/100.`,
        cmo: `Campaign delivered ${totalConversions.toLocaleString()} total conversions across ${channels.length} channels. iROAS: ${inc.iroas.toFixed(2)}x (vs raw ${roas.toFixed(2)}x). Top channel: ${topChannel?.channel ?? 'N/A'}. Organic baseline: ${round(inc.baseline_pct * 100, 1)}%.`,
      }
    : {
        ceo: `Marketing investment of $${totalSpend.toLocaleString()} generated $${totalRevenue.toLocaleString()} in revenue (${totalConversions.toLocaleString()} customers). CLV: $${clv.toLocaleString()} vs CAC: $${cac.toLocaleString()} (CLV:CAC = ${clvCacRatio}:1). ROI: ${roi}%. ⚠️ No baseline deduction — assumes 100% media-driven.`,
        cfo: `Total spend: $${totalSpend.toLocaleString()}. Revenue: $${totalRevenue.toLocaleString()}. Marketing margin: ${marketingMargin}%. ROI: ${roi}%. ROAS: ${roas.toFixed(2)}x. ⚠️ Pass baseline_pct from MMM for incremental metrics.`,
        cmo: `Campaign delivered ${totalConversions.toLocaleString()} conversions across ${channels.length} channels at $${cac.toLocaleString()} CPA. ROAS: ${roas.toFixed(2)}x. Top channel: ${topChannel?.channel ?? 'N/A'}. ⚠️ Raw metrics — no organic baseline applied.`,
      };

  const result: RevenueBridgeOutput = {
    l1_metrics: l1,
    efficiency_score: efficiencyScore,
    channels: channelResults,
    csuite_summary: csuite,
  };

  if (!inc) {
    result.baseline_warning =
      'Metrics assume 100% of revenue is media-driven. Pass baseline_pct (0-1) from MMM baseline decomposition for incremental metrics (iROAS, iROI, iCLV:CAC). Without baseline deduction, ROAS/ROI are inflated.';
  }

  return result;
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
