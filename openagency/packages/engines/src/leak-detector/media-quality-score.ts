// ─── Media Quality Score Engine ──────────────────────────────────────
// Port of media_quality_score.py - Composite quality scoring

import { round } from '@openagency/core';
import type {
  QualityScoreInput,
  QualityScoreOutput,
  QualityChannelResult,
  DimensionScore,
  RemediationAction,
  DataSource,
} from '@openagency/types';
import { QUALITY_BENCHMARKS, QUALITY_WEIGHTS } from './benchmarks.js';

function scoreDimension(actual: number, dimension: string): number {
  if (dimension === 'fraud') {
    // Lower is better
    if (actual <= 2) return 100;
    if (actual >= 20) return 0;
    return Math.max(0, Math.round(100 - (actual / 20) * 100));
  }
  if (dimension === 'viewability') {
    // Higher is better
    if (actual >= 90) return 100;
    if (actual <= 20) return 0;
    return Math.max(0, Math.round(((actual - 20) / 70) * 100));
  }
  if (dimension === 'brand_safety') {
    // Higher is better
    if (actual >= 99) return 100;
    if (actual <= 80) return 0;
    return Math.max(0, Math.round(((actual - 80) / 19) * 100));
  }
  if (dimension === 'mfa') {
    // Lower is better
    if (actual <= 1) return 100;
    if (actual >= 25) return 0;
    return Math.max(0, Math.round(100 - (actual / 25) * 100));
  }
  return 50;
}

export function score(data: QualityScoreInput): QualityScoreOutput {
  const channels = data.channels ?? [];
  const results: QualityChannelResult[] = [];

  for (const ch of channels) {
    const chName = ch.name;
    const spend = ch.spend ?? 0;
    const benchmark =
      QUALITY_BENCHMARKS[chName] ?? QUALITY_BENCHMARKS.programmatic_display;

    // Determine data source
    const hasActual = ch.ivt_rate_pct !== undefined ||
      ch.viewability_pct !== undefined ||
      ch.brand_safety_incidents !== undefined ||
      ch.mfa_rate_pct !== undefined;

    // Get actual or benchmark values
    const ivt = ch.ivt_rate_pct ?? benchmark.ivt;
    const viewability = ch.viewability_pct ?? benchmark.viewability;

    let bsRate: number;
    if (ch.brand_safety_incidents !== undefined && ch.brand_safety_impressions !== undefined) {
      bsRate = (1 - ch.brand_safety_incidents / ch.brand_safety_impressions) * 100;
    } else {
      bsRate = benchmark.brand_safety;
    }

    const mfa = ch.mfa_rate_pct ?? benchmark.mfa;

    // Score each dimension
    const fraudScore = scoreDimension(ivt, 'fraud');
    const viewScore = scoreDimension(viewability, 'viewability');
    const bsScore = scoreDimension(bsRate, 'brand_safety');
    const mfaScore = scoreDimension(mfa, 'mfa');

    // Composite weighted score
    const composite = Math.round(
      fraudScore * QUALITY_WEIGHTS.fraud +
      viewScore * QUALITY_WEIGHTS.viewability +
      bsScore * QUALITY_WEIGHTS.brand_safety +
      mfaScore * QUALITY_WEIGHTS.mfa,
    );

    // Effective quality rate (multiplicative)
    const fraudPass = (100 - ivt) / 100;
    const viewPass = viewability / 100;
    const bsPass = bsRate / 100;
    const mfaPass = (100 - mfa) / 100;
    const effectiveRate = fraudPass * viewPass * bsPass * mfaPass;

    // Quality waste
    const qualityWaste = spend * (1 - effectiveRate);

    // Remediation actions
    const remediation: RemediationAction[] = [];

    if (ivt > 5) {
      const savings = spend * (ivt - 5) / 100;
      remediation.push({
        dimension: 'fraud',
        action: `Implement pre-bid IVT filtering to reduce from ${ivt}% to 5%`,
        estimated_savings: round(savings),
        timeline: '1-2 months',
        priority: ivt > 10 ? 'high' : 'medium',
      });
    }
    if (viewability < 60) {
      const savings = spend * (60 - viewability) / 100 * 0.5;
      remediation.push({
        dimension: 'viewability',
        action: `Add viewability targeting to improve from ${viewability}% to 60%+`,
        estimated_savings: round(savings),
        timeline: 'immediate',
        priority: viewability < 40 ? 'high' : 'medium',
      });
    }
    if (bsRate < 95) {
      const savings = spend * (95 - bsRate) / 100;
      remediation.push({
        dimension: 'brand_safety',
        action: 'Update brand safety block lists and enable contextual targeting',
        estimated_savings: round(savings),
        timeline: '1-2 weeks',
        priority: bsRate < 90 ? 'high' : 'medium',
      });
    }
    if (mfa > 10) {
      const savings = spend * (mfa - 10) / 100;
      remediation.push({
        dimension: 'mfa',
        action: `Block MFA domains. Reduce from ${mfa}% to <10%`,
        estimated_savings: round(savings),
        timeline: '1-2 weeks',
        priority: mfa > 15 ? 'high' : 'medium',
      });
    }

    remediation.sort((a, b) => b.estimated_savings - a.estimated_savings);

    const dimensions: QualityChannelResult['dimensions'] = {
      fraud: { rate_pct: ivt, score: fraudScore },
      viewability: { rate_pct: viewability, score: viewScore },
      brand_safety: { rate_pct: round(bsRate, 1), score: bsScore },
      mfa: { rate_pct: mfa, score: mfaScore },
    };

    results.push({
      channel: chName,
      spend,
      data_source: (hasActual ? 'actual' : 'benchmark_estimate') as DataSource,
      dimensions,
      composite_score: composite,
      effective_quality_rate: round(effectiveRate, 4),
      quality_waste_dollars: round(qualityWaste),
      remediation_actions: remediation,
    });
  }

  const totalSpend = results.reduce((s, r) => s + r.spend, 0);
  const totalWaste = results.reduce((s, r) => s + r.quality_waste_dollars, 0);
  const avgComposite = results.length > 0
    ? Math.round(results.reduce((s, r) => s + r.composite_score, 0) / results.length)
    : 0;

  return {
    channels: results,
    summary: {
      total_spend: totalSpend,
      total_quality_waste: round(totalWaste),
      quality_waste_pct: totalSpend > 0 ? round((totalWaste / totalSpend) * 100, 1) : 0,
      average_composite_score: avgComposite,
    },
  };
}
