// ─── Revenue Reconciliation ─────────────────────────────────────────
// Compares platform-reported vs actual conversions/revenue.
// Platform data reconciliation and over-reporting detection

import { round } from '@openagency/core/utils/math';
import type {
  ReconcileInput,
  ReconcileOutput,
  ReconcilePlatformResult,
  IntegrityInput,
  IntegrityOutput,
} from '@openagency/types';

export function reconcile(data: ReconcileInput): ReconcileOutput {
  const platforms = data.platforms ?? [];
  const results: ReconcilePlatformResult[] = [];
  let totalReportedRev = 0;
  let totalActualRev = 0;
  let totalReportedConv = 0;
  let totalActualConv = 0;

  for (const p of platforms) {
    const reportedConv = p.reported_conversions ?? 0;
    const reportedRev = p.reported_revenue ?? 0;
    const actualConv = p.actual_conversions ?? 0;
    const actualRev = p.actual_revenue ?? 0;
    const spend = p.spend ?? 0;

    totalReportedRev += reportedRev;
    totalActualRev += actualRev;
    totalReportedConv += reportedConv;
    totalActualConv += actualConv;

    const convCorrection = reportedConv > 0 ? actualConv / reportedConv : 0;
    const revCorrection = reportedRev > 0 ? actualRev / reportedRev : 0;
    const overReportingConv = reportedConv > 0
      ? ((reportedConv - actualConv) / reportedConv) * 100
      : 0;
    const overReportingRev = reportedRev > 0
      ? ((reportedRev - actualRev) / reportedRev) * 100
      : 0;

    const adjustedRoas = spend > 0 ? actualRev / spend : 0;
    const reportedRoas = spend > 0 ? reportedRev / spend : 0;

    let integrity = 100;
    if (overReportingRev > 30) integrity -= 30;
    else if (overReportingRev > 15) integrity -= 15;
    if (overReportingConv > 30) integrity -= 20;
    else if (overReportingConv > 15) integrity -= 10;

    results.push({
      platform: p.name,
      reported_conversions: reportedConv,
      actual_conversions: actualConv,
      conversion_correction_factor: round(convCorrection, 3),
      over_reporting_conversions_pct: round(overReportingConv, 1),
      reported_revenue: reportedRev,
      actual_revenue: actualRev,
      revenue_correction_factor: round(revCorrection, 3),
      over_reporting_revenue_pct: round(overReportingRev, 1),
      reported_roas: round(reportedRoas),
      adjusted_roas: round(adjustedRoas),
      data_integrity_score: Math.max(0, integrity),
    });
  }

  const overallCorrection = totalReportedRev > 0 ? totalActualRev / totalReportedRev : 0;
  const overallOverReporting = totalReportedRev > 0
    ? ((totalReportedRev - totalActualRev) / totalReportedRev) * 100
    : 0;

  return {
    platforms: results,
    summary: {
      total_reported_revenue: totalReportedRev,
      total_actual_revenue: totalActualRev,
      overall_correction_factor: round(overallCorrection, 3),
      overall_over_reporting_pct: round(overallOverReporting, 1),
      total_reported_conversions: totalReportedConv,
      total_actual_conversions: totalActualConv,
      measurement_waste_dollars: round(totalReportedRev - totalActualRev),
    },
  };
}

export function integrity(data: IntegrityInput): IntegrityOutput {
  const tracking = data.tracking_coverage_pct ?? 100;
  const consent = data.cookie_consent_rate_pct ?? 100;
  const window = data.attribution_window_days ?? 30;
  const crossDevice = data.cross_device_enabled ?? false;
  const offlineImport = data.offline_conversion_import ?? false;

  const scores = {
    tracking_coverage: Math.min(100, Math.round(tracking)),
    consent_rate: Math.min(100, Math.round(consent)),
    attribution_window: window >= 28 ? 100 : Math.round((window / 28) * 100),
    cross_device: crossDevice ? 100 : 50,
    offline_integration: offlineImport ? 100 : 40,
  };

  const overall = Math.round(
    Object.values(scores).reduce((s, v) => s + v, 0) / Object.values(scores).length,
  );

  const recommendations: string[] = [];
  if (tracking < 90)
    recommendations.push('Improve tracking coverage: audit tag implementation across all pages');
  if (consent < 80) recommendations.push('Improve consent rates: optimize consent banner UX');
  if (window < 28)
    recommendations.push(
      `Attribution window is ${window} days. Consider extending to 28+ for accuracy`,
    );
  if (!crossDevice)
    recommendations.push('Enable cross-device tracking for more complete attribution');
  if (!offlineImport)
    recommendations.push('Import offline conversions for closed-loop measurement');

  return {
    integrity_score: overall,
    dimension_scores: scores,
    recommendations,
  };
}
