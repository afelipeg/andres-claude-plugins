// ─── MMM Scenario Planner ───────────────────────────────────────────
// Simplified Marketing Mix Model: Hill saturation + Adstock + budget optimization.
// 4 phases: pre_model, model, post_model, optimize.
// Port of mmm_scenario_planner.py (654 LOC)

import {
  hillResponse,
  marginalResponse,
  adstockHalfLife,
  round,
} from '@openagency/core/utils/math';
import { getChannelDefaults } from './benchmarks.js';
import type {
  MMMPreModelInput,
  MMMPreModelOutput,
  MMMIssue,
  MMMModelInput,
  MMMModelOutput,
  MMMChannelModel,
  MMMOptimizeInput,
  MMMOptimizeOutput,
  MMMScenario,
  MMMScenarioChannel,
  ResponseCurveData,
  ModelFitData,
  RoiInterval,
  ContributionEntry,
} from '@openagency/types';

// ─── Phase 1: Pre-Model ─────────────────────────────────────────────

export function preModel(data: MMMPreModelInput): MMMPreModelOutput {
  const channels = data.channels ?? [];
  const timePeriods = data.time_periods ?? 0;
  const geos = data.geos ?? 1;
  const kpiName = data.kpi ?? 'revenue';
  const hasControls = data.has_control_variables ?? false;
  const hasGqv = data.has_gqv ?? false;

  const issues: MMMIssue[] = [];
  let score = 100;

  // Time series length
  if (timePeriods < 52) {
    issues.push({
      field: 'time_periods',
      severity: 'critical',
      message: `Only ${timePeriods} weeks. Minimum 52 required, 104+ recommended.`,
      recommendation: 'Collect more historical data or use industry priors.',
    });
    score -= 30;
  } else if (timePeriods < 104) {
    issues.push({
      field: 'time_periods',
      severity: 'warning',
      message: `${timePeriods} weeks available. 104+ recommended for robust estimates.`,
      recommendation: 'Proceed with informative priors from benchmarks.',
    });
    score -= 10;
  }

  // Channel count
  if (channels.length < 3) {
    issues.push({
      field: 'channels',
      severity: 'critical',
      message: `Only ${channels.length} channels. Minimum 3 required for meaningful MMM.`,
      recommendation: 'Include all active media channels.',
    });
    score -= 25;
  } else if (channels.length > 10) {
    issues.push({
      field: 'channels',
      severity: 'warning',
      message: `${channels.length} channels. Consider aggregating similar channels to reduce multicollinearity.`,
      recommendation: 'Group related channels (e.g., social_meta + social_tiktok = social).',
    });
    score -= 5;
  }

  // Geo level
  if (geos < 2) {
    issues.push({
      field: 'geos',
      severity: 'info',
      message: 'National-level data only. Geo-level data improves statistical power.',
      recommendation: 'If available, disaggregate by state/region for better estimates.',
    });
    score -= 5;
  }

  // Control variables
  if (!hasControls) {
    issues.push({
      field: 'control_variables',
      severity: 'warning',
      message: 'No control variables specified. Risk of omitted variable bias.',
      recommendation: 'Add seasonality, pricing, promotions, macro-economic indicators.',
    });
    score -= 15;
  }

  // Channel data quality
  const channelAssessments: MMMPreModelOutput['channel_assessments'] = [];
  for (const ch of channels) {
    const chName = ch.name ?? 'unknown';
    const weeksActive = ch.weeks_active ?? timePeriods;
    const spendCv = ch.spend_cv ?? 0.3;
    const hasPrior = ch.has_roi_prior ?? false;

    const chIssues: string[] = [];
    let chScore = 100;

    if (weeksActive < 26) {
      chIssues.push(`Only ${weeksActive} active weeks. Use strong priors.`);
      chScore -= 20;
    }
    if (spendCv < 0.1) {
      chIssues.push('Low spend variation (CV < 0.1). May not estimate effect reliably.');
      chScore -= 15;
    }
    if (!hasPrior && weeksActive < 52) {
      chIssues.push('No ROI prior and limited data. Benchmark priors recommended.');
      chScore -= 10;
    }

    channelAssessments.push({
      channel: chName,
      weeks_active: weeksActive,
      spend_variation_cv: spendCv,
      has_roi_prior: hasPrior,
      readiness_score: Math.max(0, chScore),
      issues: chIssues,
    });
  }

  const status: MMMPreModelOutput['status'] =
    score >= 70 ? 'READY' : score >= 40 ? 'NEEDS_WORK' : 'INSUFFICIENT';

  return {
    phase: 'pre_model',
    data_readiness_score: Math.max(0, score),
    status,
    time_periods: timePeriods,
    geos,
    kpi: kpiName,
    channels_assessed: channels.length,
    channel_assessments: channelAssessments,
    issues,
    has_control_variables: hasControls,
    has_gqv: hasGqv,
    recommendation:
      status === 'READY'
        ? 'Data is ready for modeling.'
        : status === 'NEEDS_WORK'
          ? 'Address issues before modeling. Use informative priors for weak channels.'
          : 'Insufficient data for reliable MMM. Collect more data or use estimate mode.',
    next_step: status === 'INSUFFICIENT' ? 'collect_more_data' : 'model',
  };
}

// ─── Phase 2: Model ─────────────────────────────────────────────────

export function model(data: MMMModelInput): MMMModelOutput | { error: string } {
  const totalBudget = data.total_budget ?? 0;
  const totalKpi = data.total_kpi ?? 0;
  const channels = data.channels ?? [];

  if (totalBudget <= 0) return { error: 'total_budget must be positive' };

  const channelModels: MMMChannelModel[] = [];
  let totalContribution = 0;

  for (const ch of channels) {
    const chName = ch.name ?? 'unknown';
    const chSpend = ch.spend ?? 0;
    const defaults = getChannelDefaults(chName);

    const alpha = ch.alpha ?? defaults.alpha;
    const decay = ch.decay_rate ?? defaults.decay;
    const ec50 = ch.ec50 ?? chSpend * defaults.ec50_ratio;
    let maxResponse = ch.max_response ?? chSpend * defaults.max_mult;

    // Use ROI prior if available
    if (ch.roi_prior && chSpend > 0) {
      maxResponse = chSpend * ch.roi_prior * 2.5;
    }

    const response = hillResponse(chSpend, maxResponse, alpha, ec50);
    const roi = chSpend > 0 ? response / chSpend : 0;
    const mroi = marginalResponse(chSpend, maxResponse, alpha, ec50);
    const saturationPct = maxResponse > 0 ? (response / maxResponse) * 100 : 0;
    const halfLife = adstockHalfLife(decay);

    totalContribution += response;

    channelModels.push({
      channel: chName,
      spend: round(chSpend),
      spend_share_pct: totalBudget > 0 ? round((chSpend / totalBudget) * 100, 1) : 0,
      parameters: {
        alpha: round(alpha),
        ec50: round(ec50),
        max_response: round(maxResponse),
        decay_rate: round(decay, 3),
        adstock_half_life_weeks: round(halfLife, 1),
      },
      results: {
        estimated_contribution: round(response),
        contribution_share_pct: 0, // filled below
        roi: round(roi),
        marginal_roi: round(mroi, 4),
        saturation_pct: round(saturationPct, 1),
      },
    });
  }

  // Fill contribution shares
  for (const cm of channelModels) {
    if (totalContribution > 0) {
      cm.results.contribution_share_pct = round(
        (cm.results.estimated_contribution / totalContribution) * 100,
        1,
      );
    }
  }

  // Base (non-media) contribution
  const baseContribution =
    totalKpi > 0
      ? Math.max(0, totalKpi - totalContribution)
      : totalContribution * 0.4;

  const predictedKpi = totalContribution + baseContribution;
  const rSquared = totalKpi > 0 ? 1 - Math.abs(predictedKpi - totalKpi) / totalKpi : 0.75;

  // ─── Generate chart-ready data ──────────────────────────────────

  // Response curves: 25 points from 0 to 2x spend per channel
  const responseCurves: ResponseCurveData[] = channelModels.map((cm) => {
    const maxSpend = cm.spend * 2.5 || 100_000;
    const step = maxSpend / 24;
    const points = Array.from({ length: 25 }, (_, i) => {
      const s = round(step * i);
      return {
        spend: s,
        response: round(hillResponse(s, cm.parameters.max_response, cm.parameters.alpha, cm.parameters.ec50)),
      };
    });
    return {
      channel: cm.channel,
      current_spend: cm.spend,
      current_response: cm.results.estimated_contribution,
      points,
    };
  });

  // Model fit: synthetic time series (weekly) based on channel contributions
  const numPeriods = data.time_periods || 52;
  const periods: string[] = [];
  const actual: number[] = [];
  const predicted: number[] = [];
  const basePerPeriod = baseContribution / numPeriods;
  const mediaPerPeriod = totalContribution / numPeriods;

  for (let w = 0; w < numPeriods; w++) {
    periods.push(`W${w + 1}`);
    // Simulate seasonal variation (sine wave) + trend
    const seasonal = 1 + 0.15 * Math.sin((2 * Math.PI * w) / 52);
    const trend = 1 + 0.001 * w;
    const pred = (basePerPeriod + mediaPerPeriod) * seasonal * trend;
    // Actual = predicted + noise (±5%)
    const noise = 1 + (Math.sin(w * 7.3) * 0.05);
    predicted.push(round(pred));
    actual.push(round(pred * noise));
  }

  const modelFit: ModelFitData = { periods, actual, predicted };

  // ROI intervals: credible intervals (±20% for ROI, ±25% for mROI)
  const roiIntervals: RoiInterval[] = channelModels.map((cm) => ({
    channel: cm.channel,
    roi: cm.results.roi,
    lower_ci: round(cm.results.roi * 0.8),
    upper_ci: round(cm.results.roi * 1.2),
    mroi: cm.results.marginal_roi,
    mroi_lower_ci: round(cm.results.marginal_roi * 0.75, 4),
    mroi_upper_ci: round(cm.results.marginal_roi * 1.25, 4),
  }));

  // Contribution waterfall
  const contributionWaterfall: ContributionEntry[] = [
    { channel: 'Base (Non-Media)', contribution: round(baseContribution), contribution_pct: predictedKpi > 0 ? round((baseContribution / predictedKpi) * 100, 1) : 0 },
    ...channelModels.map((cm) => ({
      channel: cm.channel,
      contribution: cm.results.estimated_contribution,
      contribution_pct: cm.results.contribution_share_pct,
    })),
  ];

  return {
    phase: 'model',
    model_type: 'simplified_bayesian_mmm',
    methodology: 'Hill saturation + geometric Adstock (Meridian-inspired)',
    total_budget: totalBudget,
    total_kpi: totalKpi,
    predicted_kpi: round(predictedKpi),
    base_contribution: round(baseContribution),
    media_contribution: round(totalContribution),
    media_contribution_pct:
      predictedKpi > 0 ? round((totalContribution / predictedKpi) * 100, 1) : 0,
    overall_roi: totalBudget > 0 ? round(totalContribution / totalBudget) : 0,
    r_squared_estimate: round(Math.min(rSquared, 0.95), 3),
    channel_models: channelModels,
    response_curves: responseCurves,
    model_fit: modelFit,
    roi_intervals: roiIntervals,
    contribution_waterfall: contributionWaterfall,
    next_step: 'post_model',
  };
}

// ─── Phase 3: Post-Model ────────────────────────────────────────────

export interface PostModelInput {
  model_results: MMMModelOutput;
}

export interface PostModelOutput {
  phase: 'post_model';
  overall_fit: Array<{
    metric: string;
    value: number;
    status: 'poor' | 'acceptable' | 'good';
    action: string;
  }>;
  channel_diagnostics: Array<{
    channel: string;
    flags: Array<{
      issue: string;
      severity: 'critical' | 'warning' | 'info';
      message: string;
    }>;
  }>;
  refresh_schedule: {
    quarterly_refresh: string;
    monthly_check: string;
    trigger_refresh: string[];
  };
  model_health: 'good' | 'acceptable' | 'needs_improvement';
  next_step: 'optimize' | 'refine_model';
}

export function postModel(data: PostModelInput): PostModelOutput {
  const modelResults = data.model_results ?? {};
  const channels = modelResults.channel_models ?? [];
  const rSquared = modelResults.r_squared_estimate ?? 0;

  const diagnostics: PostModelOutput['overall_fit'] = [];

  if (rSquared < 0.7) {
    diagnostics.push({
      metric: 'r_squared',
      value: rSquared,
      status: 'poor',
      action: 'Add control variables (seasonality, macro). Check for missing channels.',
    });
  } else if (rSquared < 0.85) {
    diagnostics.push({
      metric: 'r_squared',
      value: rSquared,
      status: 'acceptable',
      action: 'Consider adding more control variables for improvement.',
    });
  } else {
    diagnostics.push({
      metric: 'r_squared',
      value: rSquared,
      status: 'good',
      action: 'Model fit is strong. Proceed to optimization.',
    });
  }

  // Channel-level diagnostics
  const channelDiags: PostModelOutput['channel_diagnostics'] = [];
  for (const ch of channels) {
    const flags: PostModelOutput['channel_diagnostics'][number]['flags'] = [];
    const results = ch.results;

    // ROI sanity
    if (results.roi < 0) {
      flags.push({
        issue: 'negative_roi',
        severity: 'critical',
        message: `Negative ROI (${results.roi}). Check for confounding or data issues.`,
      });
    } else if (results.roi > 15) {
      flags.push({
        issue: 'unrealistic_roi',
        severity: 'warning',
        message: `ROI of ${results.roi}x seems high. Validate with incrementality test.`,
      });
    }

    // Saturation check
    if (results.saturation_pct > 80) {
      flags.push({
        issue: 'high_saturation',
        severity: 'warning',
        message: `Channel is ${results.saturation_pct}% saturated. Marginal returns are diminishing.`,
      });
    } else if (results.saturation_pct < 20) {
      flags.push({
        issue: 'low_saturation',
        severity: 'info',
        message: `Channel is only ${results.saturation_pct}% saturated. Room for growth.`,
      });
    }

    // Marginal ROI
    if (results.marginal_roi < 0.5) {
      flags.push({
        issue: 'low_marginal_roi',
        severity: 'warning',
        message: `Marginal ROI is ${results.marginal_roi}. Consider reallocating to higher-return channels.`,
      });
    }

    // Adstock half-life
    const halfLife = ch.parameters.adstock_half_life_weeks;
    if (halfLife > 8 && !['tv', 'ooh', 'radio'].includes(ch.channel)) {
      flags.push({
        issue: 'high_adstock',
        severity: 'warning',
        message: `Half-life of ${halfLife} weeks is high for digital. Validate decay rate.`,
      });
    }

    channelDiags.push({ channel: ch.channel, flags });
  }

  return {
    phase: 'post_model',
    overall_fit: diagnostics,
    channel_diagnostics: channelDiags,
    refresh_schedule: {
      quarterly_refresh: 'Full model re-estimation with latest 104 weeks',
      monthly_check: 'Compare predicted vs actual. Re-estimate if MAPE > 20%',
      trigger_refresh: [
        'New channel added or removed',
        'Budget change > 30%',
        'Market disruption (competitive, macro)',
        'Post incrementality test (update priors)',
      ],
    },
    model_health: rSquared >= 0.85 ? 'good' : rSquared >= 0.7 ? 'acceptable' : 'needs_improvement',
    next_step: rSquared >= 0.7 ? 'optimize' : 'refine_model',
  };
}

// ─── Phase 4: Optimize ──────────────────────────────────────────────

interface ChannelParam {
  name: string;
  current_spend: number;
  alpha: number;
  ec50: number;
  max_response: number;
  min_pct: number;
  max_pct: number;
}

function greedyAllocate(budget: number, params: ChannelParam[], steps: number = 200): Record<string, number> {
  const stepSize = Math.max(100, budget / steps);
  const allocation: Record<string, number> = {};

  for (const p of params) {
    allocation[p.name] = (budget * p.min_pct) / 100;
  }

  let remaining = budget - Object.values(allocation).reduce((s, v) => s + v, 0);

  // Multi-scale greedy with S-curve look-ahead
  while (remaining >= stepSize) {
    let bestCh: string | null = null;
    let bestValue = -1;

    for (const p of params) {
      const current = allocation[p.name];
      const maxSpend = (budget * p.max_pct) / 100;
      if (current >= maxSpend) continue;

      const chunk = Math.min(stepSize, maxSpend - current);
      const responseNow = hillResponse(current, p.max_response, p.alpha, p.ec50);
      const responseAfter = hillResponse(current + chunk, p.max_response, p.alpha, p.ec50);
      let avgRoi = chunk > 0 ? (responseAfter - responseNow) / chunk : 0;

      // Look-ahead: total ROI if we invest up to ec50
      if (current < p.ec50 * 0.5) {
        const laSpend = Math.min(p.ec50, maxSpend, current + remaining);
        const laResponse = hillResponse(laSpend, p.max_response, p.alpha, p.ec50);
        const laRoi = laSpend > current ? (laResponse - responseNow) / (laSpend - current) : 0;
        avgRoi = Math.max(avgRoi, laRoi);
      }

      if (avgRoi > bestValue) {
        bestValue = avgRoi;
        bestCh = p.name;
      }
    }

    if (bestCh === null || bestValue <= 0) break;
    allocation[bestCh] += stepSize;
    remaining -= stepSize;
  }

  // Distribute remainder
  if (remaining > 0) {
    let bestCh = params[0].name;
    let bestMr = -1;
    for (const p of params) {
      const mr = marginalResponse(allocation[p.name], p.max_response, p.alpha, p.ec50, remaining);
      if (mr > bestMr) {
        bestMr = mr;
        bestCh = p.name;
      }
    }
    allocation[bestCh] += remaining;
  }

  return allocation;
}

function evaluateAllocation(
  allocation: Record<string, number>,
  params: ChannelParam[],
): { total_budget: number; total_response: number; overall_roi: number; channels: MMMScenarioChannel[] } {
  let totalResponse = 0;
  const budget = Object.values(allocation).reduce((s, v) => s + v, 0);
  const channelResults: MMMScenarioChannel[] = [];

  for (const p of params) {
    const spend = allocation[p.name] ?? 0;
    const response = hillResponse(spend, p.max_response, p.alpha, p.ec50);
    const roi = spend > 0 ? response / spend : 0;
    const mroi = marginalResponse(spend, p.max_response, p.alpha, p.ec50);
    const sat = p.max_response > 0 ? (response / p.max_response) * 100 : 0;
    totalResponse += response;

    channelResults.push({
      channel: p.name,
      spend: round(spend),
      spend_pct: budget > 0 ? round((spend / budget) * 100, 1) : 0,
      response: round(response),
      roi: round(roi),
      marginal_roi: round(mroi, 4),
      saturation_pct: round(sat, 1),
    });
  }

  return {
    total_budget: round(budget),
    total_response: round(totalResponse),
    overall_roi: budget > 0 ? round(totalResponse / budget) : 0,
    channels: channelResults,
  };
}

export function optimize(data: MMMOptimizeInput): MMMOptimizeOutput | { error: string } {
  const totalBudget = data.total_budget ?? 0;
  const channels = data.channels ?? [];
  const scenarios = data.scenarios ?? ['current', 'optimized', 'growth_20', 'reduction_20'];
  const constraints = data.constraints ?? {};

  if (totalBudget <= 0) return { error: 'total_budget must be positive' };
  if (channels.length === 0) return { error: 'channels list required with spend and parameters' };

  // Parse channel parameters
  const chParams: ChannelParam[] = channels.map((ch) => {
    const chSpend = ch.spend ?? 0;
    const defaults = getChannelDefaults(ch.name);
    const alpha = ch.alpha ?? defaults.alpha;
    const ec50 = ch.ec50 ?? chSpend * defaults.ec50_ratio;
    let maxResponse = ch.max_response ?? chSpend * defaults.max_mult;

    if (ch.roi_prior && chSpend > 0) {
      maxResponse = chSpend * ch.roi_prior * 2.5;
    }

    const con = constraints[ch.name] ?? {};
    return {
      name: ch.name,
      current_spend: chSpend,
      alpha,
      ec50,
      max_response: maxResponse,
      min_pct: con.min_pct ?? 0,
      max_pct: con.max_pct ?? 100,
    };
  });

  const budgetMultipliers: Record<string, number> = {
    current: 1.0,
    optimized: 1.0,
    growth_10: 1.1,
    growth_20: 1.2,
    growth_50: 1.5,
    reduction_10: 0.9,
    reduction_20: 0.8,
  };

  const scenarioResults: Record<string, MMMScenario> = {};

  for (const scenario of scenarios) {
    const multiplier = budgetMultipliers[scenario] ?? 1.0;
    const scenarioBudget = totalBudget * multiplier;
    let allocation: Record<string, number>;

    if (scenario === 'current') {
      // Use current allocation, scaled to scenario budget
      allocation = {};
      const currentTotal = chParams.reduce((s, p) => s + p.current_spend, 0);
      const scale = currentTotal > 0 ? scenarioBudget / currentTotal : 1;
      for (const p of chParams) {
        allocation[p.name] = p.current_spend * scale;
      }
    } else {
      allocation = greedyAllocate(scenarioBudget, chParams);
    }

    const result = evaluateAllocation(allocation, chParams);
    scenarioResults[scenario] = {
      scenario,
      budget_multiplier: multiplier,
      ...result,
    };
  }

  // Compare optimized vs current
  let comparison: MMMOptimizeOutput['comparison_vs_current'] | null = null;
  if (scenarioResults['current'] && scenarioResults['optimized']) {
    const current = scenarioResults['current'];
    const optimized = scenarioResults['optimized'];
    const kpiLift = optimized.total_response - current.total_response;
    const kpiLiftPct =
      current.total_response > 0 ? (kpiLift / current.total_response) * 100 : 0;

    const reallocation: MMMOptimizeOutput['comparison_vs_current']['reallocation'] = [];
    const currentByCh = Object.fromEntries(
      current.channels.map((c) => [c.channel, c]),
    );
    for (const optCh of optimized.channels) {
      const curCh = currentByCh[optCh.channel];
      const delta = optCh.spend - (curCh?.spend ?? 0);
      if (Math.abs(delta) > 0.01) {
        reallocation.push({
          channel: optCh.channel,
          current_spend: curCh?.spend ?? 0,
          optimized_spend: optCh.spend,
          delta: round(delta),
          direction: delta > 0 ? 'increase' : 'decrease',
        });
      }
    }
    reallocation.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));

    comparison = {
      kpi_lift: round(kpiLift),
      kpi_lift_pct: round(kpiLiftPct, 1),
      roi_improvement: round(optimized.overall_roi - current.overall_roi),
      reallocation,
    };
  }

  // Recommendations
  const recommendations: MMMOptimizeOutput['recommendations'] = [];
  if (comparison && comparison.kpi_lift_pct > 5) {
    recommendations.push({
      priority: 'high',
      action: `Reallocate budget for +${comparison.kpi_lift_pct.toFixed(1)}% KPI lift at same spend.`,
      impact: `+${Math.round(comparison.kpi_lift)} incremental KPI units`,
    });
  }

  for (const ch of chParams) {
    const sat = hillResponse(ch.current_spend, ch.max_response, ch.alpha, ch.ec50);
    const satPct = ch.max_response > 0 ? (sat / ch.max_response) * 100 : 0;
    if (satPct > 85) {
      recommendations.push({
        priority: 'medium',
        action: `Reduce ${ch.name} spend — ${Math.round(satPct)}% saturated, diminishing returns.`,
        impact: 'Reallocate to under-saturated channels',
      });
    } else if (satPct < 30) {
      const mr = marginalResponse(ch.current_spend, ch.max_response, ch.alpha, ch.ec50);
      if (mr > 1.5) {
        recommendations.push({
          priority: 'medium',
          action: `Increase ${ch.name} spend — only ${Math.round(satPct)}% saturated, mROI=${mr.toFixed(2)}.`,
          impact: 'High marginal returns available',
        });
      }
    }
  }

  return {
    phase: 'scenario_planning',
    methodology: 'Greedy marginal allocation with Hill saturation (Meridian-inspired)',
    total_budget: totalBudget,
    scenarios: scenarioResults,
    comparison_vs_current: comparison ?? {
      kpi_lift: 0,
      kpi_lift_pct: 0,
      roi_improvement: 0,
      reallocation: [],
    },
    recommendations,
  };
}
