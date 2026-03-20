// ─── Optimization Rules Engine ──────────────────────────────────────
// v4.0: Cross-engine optimization with Leak Detector + Media Architect signals.
// Multi-campaign portfolio optimization with priority scoring.
// Rule-based campaign optimization with cross-channel reallocation.

import { round } from '@openagency/core/utils/math';
import type {
  OptimizationInput,
  OptimizationOutput,
  OptAlert,
  OptCampaignResult,
  LeakDetectorSignals,
  MediaArchitectSignals,
  ReallocateOutput,
  ReallocateRecommendation,
} from '@openagency/types';

const THRESHOLDS = {
  cpa_overshoot_pct: 0.3,
  cpa_headroom_pct: 0.3,
  roas_below_pct: 0.2,
  pacing_over_pct: 0.2,
  pacing_under_pct: 0.2,
  ctr_fatigue_pct: 0.3,
};

// ─── Cross-Engine Signal Helpers ────────────────────────────────────

function getWasteSignal(channel: string, ld?: LeakDetectorSignals): number {
  if (!ld?.waste_waterfall) return 0;
  const wasteEntry = ld.waste_waterfall[channel];
  if (wasteEntry !== undefined) return Math.min(1, Math.max(0, wasteEntry));
  // Try matching partial channel names
  for (const [key, val] of Object.entries(ld.waste_waterfall)) {
    if (channel.includes(key) || key.includes(channel)) {
      return Math.min(1, Math.max(0, val));
    }
  }
  return 0;
}

function getQualityScore(channel: string, ld?: LeakDetectorSignals): number {
  if (!ld?.media_quality) return 1; // default: no quality issues
  const q = ld.media_quality[channel];
  if (q) return Math.min(1, Math.max(0, q.overall));
  for (const [key, val] of Object.entries(ld.media_quality)) {
    if (channel.includes(key) || key.includes(channel)) {
      return Math.min(1, Math.max(0, val.overall));
    }
  }
  return 1;
}

function getSupplyChainFees(channel: string, ld?: LeakDetectorSignals): number {
  if (!ld?.supply_chain) return 0;
  const sc = ld.supply_chain[channel];
  if (sc) return sc.total_fee_pct ?? 0;
  for (const [key, val] of Object.entries(ld.supply_chain)) {
    if (channel.includes(key) || key.includes(channel)) {
      return val.total_fee_pct ?? 0;
    }
  }
  return 0;
}

function getMarginalRoi(channel: string, ma?: MediaArchitectSignals): number {
  if (!ma?.mmm_model && !ma?.channel_optimize) return 1; // neutral default
  const mmm = ma?.mmm_model?.[channel];
  if (mmm) return mmm.marginal_roi;
  const opt = ma?.channel_optimize?.[channel];
  if (opt) return opt.marginal_roi;
  // Partial match
  if (ma?.mmm_model) {
    for (const [key, val] of Object.entries(ma.mmm_model)) {
      if (channel.includes(key) || key.includes(channel)) return val.marginal_roi;
    }
  }
  if (ma?.channel_optimize) {
    for (const [key, val] of Object.entries(ma.channel_optimize)) {
      if (channel.includes(key) || key.includes(channel)) return val.marginal_roi;
    }
  }
  return 1;
}

function getSaturation(channel: string, ma?: MediaArchitectSignals): number {
  if (!ma?.mmm_model && !ma?.channel_optimize) return 0.5; // neutral
  const mmm = ma?.mmm_model?.[channel];
  if (mmm) return mmm.saturation_pct / 100;
  const opt = ma?.channel_optimize?.[channel];
  if (opt) return opt.saturation_pct / 100;
  for (const [key, val] of Object.entries(ma?.mmm_model ?? {})) {
    if (channel.includes(key) || key.includes(channel)) return val.saturation_pct / 100;
  }
  for (const [key, val] of Object.entries(ma?.channel_optimize ?? {})) {
    if (channel.includes(key) || key.includes(channel)) return val.saturation_pct / 100;
  }
  return 0.5;
}

/**
 * Compute priority score for a campaign using cross-engine signals.
 * Higher score = more worthy of investment.
 * priority = mROI * qualityScore * (1 - wasteSignal) * (1 - saturation)
 */
function computePriorityScore(
  channel: string,
  ld?: LeakDetectorSignals,
  ma?: MediaArchitectSignals,
): number {
  const mROI = Math.max(0, getMarginalRoi(channel, ma));
  const quality = getQualityScore(channel, ld);
  const waste = getWasteSignal(channel, ld);
  const saturation = getSaturation(channel, ma);

  // Normalize mROI to 0-1 range (cap at 5 for scaling)
  const normalizedMroi = Math.min(1, mROI / 5);
  return round(normalizedMroi * quality * (1 - waste) * (1 - saturation), 4);
}

// ─── Cross-Engine Alert Generation ──────────────────────────────────

function generateCrossEngineAlerts(
  campaigns: Array<{ name: string; channel: string; spend: number }>,
  ld?: LeakDetectorSignals,
  ma?: MediaArchitectSignals,
): OptAlert[] {
  const alerts: OptAlert[] = [];
  if (!ld && !ma) return alerts;

  const channelSpend = new Map<string, number>();
  for (const c of campaigns) {
    channelSpend.set(c.channel, (channelSpend.get(c.channel) ?? 0) + c.spend);
  }

  for (const [channel, spend] of channelSpend) {
    const waste = getWasteSignal(channel, ld);
    const quality = getQualityScore(channel, ld);
    const saturation = getSaturation(channel, ma);
    const mROI = getMarginalRoi(channel, ma);
    const fees = getSupplyChainFees(channel, ld);

    // High waste AND oversaturated — strong cut signal
    if (waste > 0.25 && saturation > 0.7) {
      const cutPct = Math.min(40, Math.round((waste + saturation - 1) * 50));
      alerts.push({
        type: 'cross_engine_cut',
        severity: 'critical',
        message: `${channel} has ${Math.round(waste * 100)}% waste (Leak Detector) AND is ${Math.round(saturation * 100)}% saturated (Media Architect) — cut ${cutPct}%`,
        recommendation: `Reduce ${channel} budget by ${cutPct}% and reallocate to unsaturated, low-waste channels.`,
      });
    }

    // Highest mROI AND lowest waste — strong invest signal
    if (mROI > 2 && waste < 0.1 && saturation < 0.4) {
      alerts.push({
        type: 'cross_engine_invest',
        severity: 'info',
        message: `${channel} has highest mROI (${mROI.toFixed(2)}x, Media Architect) AND lowest waste (${Math.round(waste * 100)}%, Leak Detector) — increase 25%`,
        recommendation: `Increase ${channel} budget by 25%. Channel is only ${Math.round(saturation * 100)}% saturated with strong returns.`,
      });
    }

    // Supply chain fee alert
    if (fees > 0.4) {
      alerts.push({
        type: 'cross_engine_supply_chain',
        severity: 'warning',
        message: `${channel} supply chain fees exceed ${Math.round(fees * 100)}% (Leak Detector) — switch to principal-based buying`,
        recommendation: `Negotiate direct deals or switch to principal-based buying for ${channel}. Current fee structure erodes ${Math.round(fees * 100)}% of working media.`,
      });
    }

    // Low quality score
    if (quality < 0.5 && spend > 0) {
      alerts.push({
        type: 'cross_engine_quality',
        severity: 'warning',
        message: `${channel} media quality score is ${Math.round(quality * 100)}% (Leak Detector) — review inventory sources`,
        recommendation: `Audit ${channel} inventory for fraud, viewability, and brand safety. Quality below 50% indicates significant risk.`,
      });
    }
  }

  // Anomaly alerts from Media Architect
  if (ma?.anomalies) {
    for (const anomaly of ma.anomalies) {
      const severity = Math.abs(anomaly.z_score) > 3 ? 'critical' as const : 'warning' as const;
      alerts.push({
        type: 'cross_engine_anomaly',
        severity,
        message: `Anomaly detected in ${anomaly.channel} ${anomaly.metric}: z-score ${anomaly.z_score.toFixed(1)} (${anomaly.direction})`,
        recommendation: `Investigate ${anomaly.channel} ${anomaly.metric} — significant deviation from expected pattern.`,
      });
    }
  }

  return alerts;
}

// ─── Main Analyze Function ──────────────────────────────────────────

export function analyze(data: OptimizationInput): OptimizationOutput {
  const campaigns = data.campaigns ?? [];
  const ld = data.leak_detector;
  const ma = data.media_architect;
  const allAlerts: OptAlert[] = [];
  const campaignResults: OptCampaignResult[] = [];

  for (const camp of campaigns) {
    const name = camp.name;
    const channel = camp.channel ?? 'unknown';
    const spend = camp.spend ?? 0;
    const budget = camp.budget ?? 0;
    const daysElapsed = camp.days_elapsed ?? 0;
    const daysTotal = camp.days_total ?? 30;
    const impressions = camp.impressions ?? 0;
    const clicks = camp.clicks ?? 0;
    const conversions = camp.conversions ?? 0;
    const revenue = camp.revenue ?? 0;
    const cpaTarget = camp.cpa_target ?? 0;
    const roasTarget = camp.roas_target ?? 0;
    const historicalCtr = camp.historical_ctr ?? 0;

    const alerts: OptAlert[] = [];

    const cpa = conversions > 0 ? spend / conversions : null;
    const roas = spend > 0 ? revenue / spend : 0;
    const ctr = impressions > 0 ? clicks / impressions : 0;
    const expectedSpendPct = daysTotal > 0 ? daysElapsed / daysTotal : 0;
    const actualSpendPct = budget > 0 ? spend / budget : 0;

    // CPA Overshoot
    if (cpaTarget > 0 && cpa !== null) {
      const cpaDeviation = (cpa - cpaTarget) / cpaTarget;
      if (cpaDeviation > THRESHOLDS.cpa_overshoot_pct) {
        alerts.push({
          type: 'cpa_overshoot',
          severity: cpaDeviation > 0.5 ? 'critical' : 'warning',
          message: `CPA $${Math.round(cpa)} is ${Math.round(cpaDeviation * 100)}% above target $${Math.round(cpaTarget)}`,
          recommendation: 'Reduce bids, tighten targeting, or pause underperforming ad groups',
        });
      }
    }

    // CPA Headroom
    if (cpaTarget > 0 && cpa !== null) {
      const cpaHeadroom = (cpaTarget - cpa) / cpaTarget;
      if (cpaHeadroom > THRESHOLDS.cpa_headroom_pct) {
        alerts.push({
          type: 'cpa_headroom',
          severity: 'info',
          message: `CPA $${Math.round(cpa)} is ${Math.round(cpaHeadroom * 100)}% below target. Opportunity to scale.`,
          recommendation: 'Increase budget or expand targeting to capture more volume',
        });
      }
    }

    // ROAS Below Target
    if (roasTarget > 0 && spend > 0) {
      const roasDeviation = (roasTarget - roas) / roasTarget;
      if (roasDeviation > THRESHOLDS.roas_below_pct) {
        alerts.push({
          type: 'roas_below_target',
          severity: roasDeviation > 0.4 ? 'critical' : 'warning',
          message: `ROAS ${roas.toFixed(2)}x is ${Math.round(roasDeviation * 100)}% below target ${roasTarget.toFixed(2)}x`,
          recommendation: 'Review channel mix, creative performance, and landing page conversion',
        });
      }
    }

    // Pacing Analysis
    if (budget > 0 && daysTotal > 0 && expectedSpendPct > 0) {
      const pacingRatio = actualSpendPct / expectedSpendPct;
      if (pacingRatio > 1 + THRESHOLDS.pacing_over_pct) {
        alerts.push({
          type: 'pacing_over',
          severity: 'warning',
          message: `Overpacing: spent ${Math.round(actualSpendPct * 100)}% of budget but only ${Math.round(expectedSpendPct * 100)}% of time elapsed`,
          recommendation: 'Reduce daily budgets or add daypart restrictions',
        });
      } else if (pacingRatio < 1 - THRESHOLDS.pacing_under_pct) {
        alerts.push({
          type: 'pacing_under',
          severity: 'warning',
          message: `Underpacing: spent ${Math.round(actualSpendPct * 100)}% of budget but ${Math.round(expectedSpendPct * 100)}% of time elapsed`,
          recommendation: 'Broaden targeting, increase bids, or add new ad groups',
        });
      }
    }

    // Creative Fatigue (both ctr and historicalCtr as fractions, e.g. 0.05 = 5%)
    if (historicalCtr > 0 && impressions > 0) {
      const ctrDecline = (historicalCtr - ctr) / historicalCtr;
      if (ctrDecline > THRESHOLDS.ctr_fatigue_pct) {
        alerts.push({
          type: 'creative_fatigue',
          severity: 'warning',
          message: `CTR ${(ctr * 100).toFixed(2)}% is ${Math.round(ctrDecline * 100)}% below historical ${(historicalCtr * 100).toFixed(2)}%`,
          recommendation: 'Rotate creative assets. Test new concepts, copy, or formats.',
        });
      }
    }

    // Zero Conversions
    if (spend > 0 && conversions === 0) {
      alerts.push({
        type: 'zero_conversions',
        severity: 'critical',
        message: `$${spend.toLocaleString()} spent with zero conversions. Possible tracking issue.`,
        recommendation: 'Verify conversion tracking immediately. Check tag firing, attribution window, and consent settings.',
      });
    }

    // Cross-engine priority score
    const priorityScore = computePriorityScore(channel, ld, ma);

    campaignResults.push({
      campaign: name,
      channel,
      metrics: {
        spend,
        budget,
        cpa: cpa !== null ? round(cpa) : 0,
        roas: round(roas),
        ctr: round(ctr * 100),
        pacing_pct: round(actualSpendPct * 100, 1),
      },
      alerts,
      alert_count: {
        critical: alerts.filter((a) => a.severity === 'critical').length,
        warning: alerts.filter((a) => a.severity === 'warning').length,
        info: alerts.filter((a) => a.severity === 'info').length,
      },
      priority_score: priorityScore,
    });
    allAlerts.push(...alerts);
  }

  // Generate cross-engine alerts
  const crossEngineAlerts = generateCrossEngineAlerts(
    campaigns.map(c => ({ name: c.name, channel: c.channel ?? 'unknown', spend: c.spend ?? 0 })),
    ld,
    ma,
  );

  return {
    campaigns: campaignResults,
    total_alerts: {
      critical: allAlerts.filter((a) => a.severity === 'critical').length,
      warning: allAlerts.filter((a) => a.severity === 'warning').length,
      info: allAlerts.filter((a) => a.severity === 'info').length,
    },
    cross_engine_alerts: crossEngineAlerts.length > 0 ? crossEngineAlerts : undefined,
  };
}

// ─── Reallocate Interface (backward compatible) ─────────────────────

export interface ReallocateInput {
  total_budget?: number;
  campaigns: Array<{
    name: string;
    channel?: string;
    spend: number;
    revenue: number;
    conversions?: number;
  }>;
  /** Cross-engine signals from Leak Detector */
  leak_detector?: LeakDetectorSignals;
  /** Cross-engine signals from Media Architect */
  media_architect?: MediaArchitectSignals;
}

export function reallocate(data: ReallocateInput): ReallocateOutput {
  const campaigns = data.campaigns ?? [];
  const ld = data.leak_detector;
  const ma = data.media_architect;
  const hasCrossEngineSignals = !!(ld || ma);

  const performances = campaigns.map((camp) => {
    const spend = camp.spend ?? 0;
    const revenue = camp.revenue ?? 0;
    const conversions = camp.conversions ?? 0;
    const channel = camp.channel ?? 'unknown';
    const priorityScore = computePriorityScore(channel, ld, ma);
    return {
      campaign: camp.name,
      channel,
      current_spend: spend,
      roas: spend > 0 ? round(revenue / spend) : 0,
      cpa: conversions > 0 ? round(spend / conversions) : null,
      priority_score: priorityScore,
    };
  });

  const recommendations: ReallocateRecommendation[] = [];

  if (hasCrossEngineSignals && performances.length >= 2) {
    // ─── Multi-campaign portfolio optimization (v4.0) ─────────────
    // Sort by priority score (composite of mROI, quality, waste, saturation)
    const sorted = [...performances].sort((a, b) => (b.priority_score ?? 0) - (a.priority_score ?? 0));
    const totalSpend = sorted.reduce((s, p) => s + p.current_spend, 0);

    // Split into source (low priority) and target (high priority) pools
    const medianIdx = Math.floor(sorted.length / 2);
    const targets = sorted.slice(0, medianIdx || 1);
    const sources = sorted.slice(medianIdx || 1);

    // Quick wins: move from lowest priority to highest priority
    for (const source of sources) {
      for (const target of targets) {
        if (source.current_spend <= 0) continue;
        const sourceWaste = getWasteSignal(source.channel, ld);
        const sourceSat = getSaturation(source.channel, ma);
        const targetMroi = getMarginalRoi(target.channel, ma);
        const targetSat = getSaturation(target.channel, ma);

        // Only recommend if meaningful gap exists
        const scoreDiff = (target.priority_score ?? 0) - (source.priority_score ?? 0);
        if (scoreDiff < 0.1) continue;

        // Amount proportional to the priority gap, capped at 30% of source spend
        const shiftPct = Math.min(0.3, scoreDiff);
        const shiftAmount = round(source.current_spend * shiftPct);
        if (shiftAmount < 100) continue;

        const isQuickWin = sourceWaste > 0.2 || sourceSat > 0.7;
        const isStrategic = targetMroi > 2 && targetSat < 0.4;
        const isGrowth = targetSat < 0.3 && totalSpend < (data.total_budget ?? Infinity);

        recommendations.push({
          action: 'reallocate',
          from_campaign: source.campaign,
          to_campaign: target.campaign,
          amount: shiftAmount,
          rationale: buildRationale(source, target, ld, ma),
          category: isQuickWin ? 'quick_win' : isStrategic ? 'strategic_shift' : isGrowth ? 'growth_opportunity' : 'quick_win',
          expected_impact: `Estimated +${round(shiftAmount * (targetMroi - (source.roas > 0 ? 1 / source.roas : 0)), 0)} incremental KPI units`,
          risk: isQuickWin ? 'low' : isStrategic ? 'medium' : 'medium',
        });
      }
    }

    // Growth opportunities: suggest budget increase for unsaturated high-mROI channels
    for (const target of targets) {
      const targetSat = getSaturation(target.channel, ma);
      const targetMroi = getMarginalRoi(target.channel, ma);
      const targetQuality = getQualityScore(target.channel, ld);
      if (targetSat < 0.3 && targetMroi > 2.5 && targetQuality > 0.7) {
        const growthAmount = round(target.current_spend * 0.25);
        if (growthAmount >= 100) {
          recommendations.push({
            action: 'increase_budget',
            from_campaign: 'new_budget',
            to_campaign: target.campaign,
            amount: growthAmount,
            rationale: `${target.channel} is only ${Math.round(targetSat * 100)}% saturated with mROI of ${targetMroi.toFixed(2)}x and quality score of ${Math.round(targetQuality * 100)}%`,
            category: 'growth_opportunity',
            expected_impact: `Estimated +${round(growthAmount * targetMroi)} incremental KPI units from budget increase`,
            risk: 'medium',
          });
        }
      }
    }

    // Deduplicate: keep top recommendation per from_campaign
    const seen = new Set<string>();
    const deduped: ReallocateRecommendation[] = [];
    for (const rec of recommendations) {
      const key = `${rec.from_campaign}->${rec.to_campaign}`;
      if (!seen.has(key)) {
        seen.add(key);
        deduped.push(rec);
      }
    }
    recommendations.length = 0;
    recommendations.push(...deduped);

    // Sort: quick_wins first, then strategic, then growth
    const categoryOrder = { quick_win: 0, strategic_shift: 1, growth_opportunity: 2 };
    recommendations.sort((a, b) =>
      (categoryOrder[a.category ?? 'quick_win'] ?? 0) - (categoryOrder[b.category ?? 'quick_win'] ?? 0)
      || b.amount - a.amount
    );

  } else {
    // ─── Legacy fallback: simple ROAS-based reallocation ──────────
    performances.sort((a, b) => b.roas - a.roas);

    if (performances.length >= 2) {
      const top = performances[0];
      const bottom = performances[performances.length - 1];
      const shiftAmount = round(bottom.current_spend * 0.2);
      recommendations.push({
        action: 'reallocate',
        from_campaign: bottom.campaign,
        to_campaign: top.campaign,
        amount: shiftAmount,
        rationale: `Shift $${shiftAmount.toLocaleString()} from ${bottom.campaign} (ROAS ${bottom.roas}x) to ${top.campaign} (ROAS ${top.roas}x)`,
      });
    }
  }

  // Pacing alerts
  const pacingAlerts: ReallocateOutput['pacing_alerts'] = [];
  // Note: pacing data comes from the analyze() function; if needed, caller
  // can cross-reference. Here we flag based on spend vs budget ratio.

  // Estimated ROAS improvement
  let estimatedImprovement: number | undefined;
  if (recommendations.length > 0) {
    const totalSpend = performances.reduce((s, p) => s + p.current_spend, 0);
    const totalRevenue = performances.reduce((s, p) => s + p.current_spend * p.roas, 0);
    const currentRoas = totalSpend > 0 ? totalRevenue / totalSpend : 0;
    // Approximate improvement from reallocation
    const reallocationImpact = recommendations.reduce((s, r) => {
      if (r.action === 'reallocate') return s + r.amount * 0.1; // conservative 10% improvement estimate
      return s;
    }, 0);
    estimatedImprovement = totalSpend > 0 ? round(reallocationImpact / totalSpend, 3) : undefined;
  }

  return {
    performances,
    recommendations,
    estimated_roas_improvement: estimatedImprovement,
    pacing_alerts: pacingAlerts.length > 0 ? pacingAlerts : undefined,
  };
}

// ─── Helper: Build human-readable rationale ─────────────────────────

function buildRationale(
  source: { campaign: string; channel: string; roas: number; priority_score?: number },
  target: { campaign: string; channel: string; roas: number; priority_score?: number },
  ld?: LeakDetectorSignals,
  ma?: MediaArchitectSignals,
): string {
  const parts: string[] = [];

  const sourceWaste = getWasteSignal(source.channel, ld);
  const sourceSat = getSaturation(source.channel, ma);
  const targetMroi = getMarginalRoi(target.channel, ma);
  const targetWaste = getWasteSignal(target.channel, ld);

  if (sourceWaste > 0.15) {
    parts.push(`${source.channel} has ${Math.round(sourceWaste * 100)}% waste`);
  }
  if (sourceSat > 0.6) {
    parts.push(`${source.channel} is ${Math.round(sourceSat * 100)}% saturated`);
  }
  if (source.roas < 1) {
    parts.push(`${source.campaign} ROAS is ${source.roas}x (below breakeven)`);
  }

  if (targetMroi > 1.5) {
    parts.push(`${target.channel} has mROI of ${targetMroi.toFixed(2)}x`);
  }
  if (targetWaste < 0.1) {
    parts.push(`${target.channel} has clean inventory (<${Math.round(targetWaste * 100)}% waste)`);
  }

  if (parts.length === 0) {
    return `Shift from ${source.campaign} (ROAS ${source.roas}x, priority ${(source.priority_score ?? 0).toFixed(2)}) to ${target.campaign} (ROAS ${target.roas}x, priority ${(target.priority_score ?? 0).toFixed(2)})`;
  }

  return parts.join('; ');
}
