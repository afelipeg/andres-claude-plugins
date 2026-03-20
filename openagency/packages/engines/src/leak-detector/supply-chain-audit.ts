// ─── Supply Chain Audit Engine ───────────────────────────────────────
// Dollar flow mapping and fee transparency audit

import { round } from '@openagency/core';
import type {
  SupplyChainInput,
  SupplyChainOutput,
  SupplyChainChannelResult,
  FeeBreakdown,
  RiskFlag,
  CPMAnomaly,
  SPORecommendation,
} from '@openagency/types';
import { CPM_BENCHMARKS, FEE_BENCHMARKS } from './benchmarks.js';

export function audit(data: SupplyChainInput): SupplyChainOutput {
  const grossSpend = data.gross_spend ?? 0;
  const channels = data.channels ?? [];

  const channelResults: SupplyChainChannelResult[] = [];
  let totalFees = 0;
  let totalWorking = 0;
  const allAnomalies: CPMAnomaly[] = [];
  const spoRecommendations: SPORecommendation[] = [];

  for (const ch of channels) {
    const chName = ch.name;
    const chSpend = ch.spend ?? 0;
    const intermediaries = ch.intermediaries ?? [];
    const publisherCpm = ch.publisher_cpm;

    const fees: FeeBreakdown[] = [];
    let totalChFees = 0;
    const riskFlags: RiskFlag[] = [];

    for (const inter of intermediaries) {
      const disclosedFeePct = inter.disclosed_fee_pct ?? 0;
      const feeAmount = chSpend * (disclosedFeePct / 100);
      const buyingModel = inter.buying_model ?? 'transparent';
      const interType = inter.type ?? 'unknown';

      // Estimate undisclosed fees for non-transparent models
      let estimatedUndisclosed = 0;
      if (buyingModel === 'principal') {
        estimatedUndisclosed = chSpend * 0.08;
        riskFlags.push({
          type: 'principal_buying',
          intermediary: inter.name,
          severity: 'high',
          message: `${inter.name} uses principal-based buying. Fee transparency is limited.`,
        });
      } else if (buyingModel === 'reseller') {
        estimatedUndisclosed = chSpend * 0.05;
        riskFlags.push({
          type: 'reseller_path',
          intermediary: inter.name,
          severity: 'medium',
          message: `${inter.name} is a reseller. Consider direct buying for transparency.`,
        });
      }

      totalChFees += feeAmount + estimatedUndisclosed;

      const feeBenchmark = FEE_BENCHMARKS[interType];
      const feeStatus =
        feeBenchmark && disclosedFeePct > feeBenchmark.max_acceptable_pct
          ? 'above_benchmark' as const
          : 'normal' as const;

      fees.push({
        intermediary: inter.name,
        type: interType,
        buying_model: buyingModel,
        disclosed_fee_pct: disclosedFeePct,
        disclosed_fee_amount: round(feeAmount),
        estimated_undisclosed: round(estimatedUndisclosed),
        total_fee: round(feeAmount + estimatedUndisclosed),
        fee_status: feeStatus,
      });
    }

    const workingMedia = chSpend - totalChFees;
    const workingRatio = chSpend > 0 ? (workingMedia / chSpend) * 100 : 0;

    totalFees += totalChFees;
    totalWorking += workingMedia;

    // CPM anomaly detection
    let cpmAnomaly: CPMAnomaly | null = null;
    if (publisherCpm !== undefined) {
      const benchmark = CPM_BENCHMARKS[chName];
      if (benchmark && publisherCpm > benchmark.anomaly) {
        cpmAnomaly = {
          channel: chName,
          actual_cpm: publisherCpm,
          benchmark_median: benchmark.median,
          anomaly_threshold: benchmark.anomaly,
          severity: 'high',
        };
        allAnomalies.push(cpmAnomaly);
      }
    }

    // SPO recommendation
    if (workingRatio < 70) {
      const savings = chSpend * ((70 - workingRatio) / 100);
      spoRecommendations.push({
        channel: chName,
        current_working_ratio: round(workingRatio, 1),
        target_working_ratio: 70,
        estimated_savings: round(savings),
        recommendation: `Optimize supply path for ${chName}. Remove redundant intermediaries.`,
        impact: savings > chSpend * 0.1 ? 'high' : 'medium',
      });
    }

    channelResults.push({
      channel: chName,
      spend: chSpend,
      fee_breakdown: fees,
      total_fees: round(totalChFees),
      working_media: round(workingMedia),
      working_media_ratio_pct: round(workingRatio, 1),
      risk_flags: riskFlags,
      cpm_anomaly: cpmAnomaly,
    });
  }

  const overallWorkingRatio = grossSpend > 0 ? (totalWorking / grossSpend) * 100 : 0;

  spoRecommendations.sort((a, b) => b.estimated_savings - a.estimated_savings);

  return {
    gross_spend: grossSpend,
    dollar_flow: {
      gross_spend: grossSpend,
      total_fees: round(totalFees),
      working_media: round(totalWorking),
      working_media_ratio_pct: round(overallWorkingRatio, 1),
    },
    channels: channelResults,
    anomalies: allAnomalies,
    spo_recommendations: spoRecommendations,
    partner_comparison: channelResults
      .map((c) => ({
        channel: c.channel,
        working_media_ratio: c.working_media_ratio_pct,
      }))
      .sort((a, b) => b.working_media_ratio - a.working_media_ratio),
  };
}
