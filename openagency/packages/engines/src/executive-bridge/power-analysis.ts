// ─── Power Analysis for Incrementality Tests ────────────────────────
// Designs geo-lift, conversion lift, and holdout experiments.
// Port of power_analysis.py

import { normalCdf, normalPpf, round } from '@openagency/core/utils/math';
import type {
  GeoLiftInput,
  GeoLiftOutput,
  ConversionLiftInput,
  ConversionLiftOutput,
  HoldoutInput,
  HoldoutOutput,
} from '@openagency/types';

export function geoLift(data: GeoLiftInput): GeoLiftOutput {
  const dailyConv = data.daily_conversions ?? 1000;
  const liftPct = (data.expected_lift_pct ?? 10) / 100;
  const duration = data.test_duration_days ?? 28;
  const geoPairs = data.geo_pairs ?? 5;
  const alpha = data.significance_level ?? 0.05;

  const zAlpha = normalPpf(1 - alpha / 2);
  const zBeta = normalPpf(0.8); // 80% power

  const totalConv = dailyConv * duration;
  const convPerGeo = totalConv / (geoPairs * 2);

  // Required sample size per group
  const p1 = dailyConv / (dailyConv / liftPct + dailyConv);
  const p2 = 1 - p1;
  const nRequired =
    Math.pow(
      zAlpha * Math.sqrt(2 * 0.5 * 0.5) +
        zBeta * Math.sqrt(p1 * (1 - p1) + p2 * (1 - p2)),
      2,
    ) / Math.pow(p1 - p2, 2);

  const power = Math.min(0.99, 0.6 + (convPerGeo / Math.max(nRequired, 1)) * 0.4);
  const minDetectable = Math.max(
    2,
    round(liftPct * 100 * (nRequired / Math.max(convPerGeo, 1)), 1),
  );

  const revenuePerConv = data.revenue_per_conversion ?? 100;
  const revenueAtRisk = round(
    convPerGeo * geoPairs * liftPct * revenuePerConv * (duration / 28),
  );

  return {
    test_type: 'geo_lift',
    daily_conversions: dailyConv,
    expected_lift_pct: round(liftPct * 100, 1),
    test_duration_days: duration,
    geo_pairs: geoPairs,
    conversions_per_geo: Math.round(convPerGeo),
    statistical_power: round(power),
    minimum_detectable_lift_pct: minDetectable,
    revenue_at_risk: revenueAtRisk,
    recommended_geo_count: Math.max(geoPairs, Math.round((nRequired / Math.max(convPerGeo, 1)) * 2)),
    confidence_level: Math.round((1 - alpha) * 100),
  };
}

export function conversionLift(data: ConversionLiftInput): ConversionLiftOutput {
  const dailyImpr = data.daily_impressions ?? 500000;
  const baselineCvr = data.baseline_cvr ?? 0.02;
  const liftPct = (data.expected_lift_pct ?? 15) / 100;
  const duration = data.test_duration_days ?? 14;
  const holdoutPct = (data.holdout_pct ?? 10) / 100;
  const alpha = data.significance_level ?? 0.05;

  const totalImpr = dailyImpr * duration;
  const testGroup = Math.round(totalImpr * (1 - holdoutPct));
  const controlGroup = Math.round(totalImpr * holdoutPct);

  const expectedConvTest = testGroup * baselineCvr * (1 + liftPct);
  const expectedConvControl = controlGroup * baselineCvr;

  const zAlpha = normalPpf(1 - alpha / 2);
  const p1 = baselineCvr * (1 + liftPct);
  const p2 = baselineCvr;
  const nPerGroup =
    Math.pow(
      zAlpha * Math.sqrt(2 * baselineCvr * (1 - baselineCvr)) +
        normalPpf(0.8) * Math.sqrt(p1 * (1 - p1) + p2 * (1 - p2)),
      2,
    ) / Math.pow(p1 - p2, 2);

  const power = Math.min(0.99, 0.5 + (controlGroup / Math.max(nPerGroup, 1)) * 0.5);

  const revenuePerConv = data.revenue_per_conversion ?? 100;
  const revenueAtRisk = round(expectedConvControl * liftPct * revenuePerConv);

  return {
    test_type: 'conversion_lift',
    daily_impressions: dailyImpr,
    baseline_cvr: baselineCvr,
    expected_lift_pct: round(liftPct * 100, 1),
    test_group_size: testGroup,
    control_group_size: controlGroup,
    statistical_power: round(power),
    minimum_detectable_lift_pct: round(
      liftPct * 100 * Math.max(1, nPerGroup / Math.max(controlGroup, 1)),
      1,
    ),
    revenue_at_risk: revenueAtRisk,
    recommended_holdout_pct: round(holdoutPct * 100),
    confidence_level: Math.round((1 - alpha) * 100),
  };
}

export function holdout(data: HoldoutInput): HoldoutOutput {
  const monthlyRevenue = data.monthly_revenue ?? 500000;
  const contributionPct = (data.channel_contribution_pct ?? 30) / 100;
  const holdoutPctRaw = (data.holdout_pct ?? 15) / 100;
  const duration = data.test_duration_days ?? 30;

  const dailyRevenue = monthlyRevenue / 30;
  const channelDailyRevenue = dailyRevenue * contributionPct;
  const revenueAtRisk = round(channelDailyRevenue * holdoutPctRaw * duration);
  const expectedLoss = round(revenueAtRisk * 0.7); // 70% assumed incremental

  const effectSize = contributionPct * holdoutPctRaw;
  const power = Math.min(0.99, 0.4 + effectSize * 4);

  const breakEven = round(revenueAtRisk / 12); // Value over 12 months

  return {
    test_type: 'holdout',
    monthly_revenue: monthlyRevenue,
    channel_contribution_pct: Math.round(contributionPct * 100),
    holdout_pct: Math.round(holdoutPctRaw * 100),
    revenue_at_risk: revenueAtRisk,
    expected_loss: expectedLoss,
    statistical_power: round(power),
    break_even_months: round(revenueAtRisk / 12),
    recommendation:
      power >= 0.7
        ? 'Proceed'
        : 'Increase duration or holdout percentage for sufficient power',
  };
}
