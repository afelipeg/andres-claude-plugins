// ─── Optimization Rules Engine ──────────────────────────────────────
// Rule-based campaign optimization with cross-channel reallocation.
// Port of optimization_rules.py

import { round } from '@openagency/core/utils/math';
import type {
  OptimizationInput,
  OptimizationOutput,
  OptAlert,
  OptCampaignResult,
} from '@openagency/types';

const THRESHOLDS = {
  cpa_overshoot_pct: 0.3,
  cpa_headroom_pct: 0.3,
  roas_below_pct: 0.2,
  pacing_over_pct: 0.2,
  pacing_under_pct: 0.2,
  ctr_fatigue_pct: 0.3,
};

export function analyze(data: OptimizationInput): OptimizationOutput {
  const campaigns = data.campaigns ?? [];
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
    });
    allAlerts.push(...alerts);
  }

  return {
    campaigns: campaignResults,
    total_alerts: {
      critical: allAlerts.filter((a) => a.severity === 'critical').length,
      warning: allAlerts.filter((a) => a.severity === 'warning').length,
      info: allAlerts.filter((a) => a.severity === 'info').length,
    },
  };
}

export interface ReallocateInput {
  total_budget?: number;
  campaigns: Array<{
    name: string;
    channel?: string;
    spend: number;
    revenue: number;
    conversions?: number;
  }>;
}

export interface ReallocateOutput {
  performances: Array<{
    campaign: string;
    channel: string;
    current_spend: number;
    roas: number;
    cpa: number | null;
  }>;
  recommendations: Array<{
    action: string;
    from_campaign: string;
    to_campaign: string;
    amount: number;
    rationale: string;
  }>;
}

export function reallocate(data: ReallocateInput): ReallocateOutput {
  const campaigns = data.campaigns ?? [];

  const performances = campaigns.map((camp) => {
    const spend = camp.spend ?? 0;
    const revenue = camp.revenue ?? 0;
    const conversions = camp.conversions ?? 0;
    return {
      campaign: camp.name,
      channel: camp.channel ?? 'unknown',
      current_spend: spend,
      roas: spend > 0 ? round(revenue / spend) : 0,
      cpa: conversions > 0 ? round(spend / conversions) : null,
    };
  });

  performances.sort((a, b) => b.roas - a.roas);

  const recommendations: ReallocateOutput['recommendations'] = [];
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

  return { performances, recommendations };
}
