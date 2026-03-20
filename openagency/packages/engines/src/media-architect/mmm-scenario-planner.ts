// ─── MMM Scenario Planner ───────────────────────────────────────────
// Marketing Mix Model: Hill saturation + Adstock + budget optimization.
// v4.0: Bayesian MCMC when historical time-series available (104+ weeks),
//        heuristic fallback otherwise.
// 4 phases: pre_model, model, post_model, optimize.

import {
  hillResponse,
  marginalResponse,
  adstockHalfLife,
  round,
} from '@openagency/core/utils/math';
import { getChannelDefaults } from './benchmarks.js';
import { runBayesianMMM } from './bayesian-mmm.js';
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

/**
 * Determine if Bayesian MCMC mode should be used.
 * Requires: weekly_kpi array + all channels have weekly_spend + time_periods >= 104
 * (or force_bayesian flag).
 */
function shouldUseBayesian(data: MMMModelInput): boolean {
  if (data.force_bayesian) return true;
  if (!data.weekly_kpi || data.weekly_kpi.length < 52) return false;
  const timePeriods = data.time_periods ?? data.weekly_kpi.length;
  if (timePeriods < 104 && !data.force_bayesian) return false;
  const allChannelsHaveTS = (data.channels ?? []).every(
    ch => ch.weekly_spend && ch.weekly_spend.length >= timePeriods,
  );
  return allChannelsHaveTS;
}

function modelBayesian(data: MMMModelInput): MMMModelOutput {
  const weeklyKpi = data.weekly_kpi!;
  const T = weeklyKpi.length;
  const channels = data.channels ?? [];
  const totalBudget = data.total_budget ?? 0;
  const totalKpi = data.total_kpi ?? weeklyKpi.reduce((a, b) => a + b, 0);

  const mcmc = data.mcmc_config ?? {};

  const bayesResult = runBayesianMMM({
    weekly_kpi: weeklyKpi,
    channels: channels.map(ch => ({
      channel: ch.name,
      weekly_spend: ch.weekly_spend!,
    })),
    controls: data.controls,
    num_chains: mcmc.num_chains,
    warmup: mcmc.warmup,
    num_samples: mcmc.num_samples,
    num_harmonics: mcmc.num_harmonics,
    seed: mcmc.seed,
  });

  // Build channel models from posterior
  const channelModels: MMMChannelModel[] = [];
  let totalContribution = 0;

  for (let m = 0; m < channels.length; m++) {
    const ch = channels[m];
    const chName = ch.name ?? 'unknown';
    const chSpend = ch.spend ?? (ch.weekly_spend ? ch.weekly_spend.reduce((a, b) => a + b, 0) : 0);
    const posterior = bayesResult.channel_posteriors[m];

    totalContribution += posterior.contribution.mean;

    const decayRate = posterior.alpha.mean;
    const halfLife = decayRate > 0 && decayRate < 1
      ? Math.log(0.5) / Math.log(decayRate)
      : 0;

    channelModels.push({
      channel: chName,
      spend: round(chSpend),
      spend_share_pct: totalBudget > 0 ? round((chSpend / totalBudget) * 100, 1) : 0,
      parameters: {
        alpha: round(posterior.slope.mean, 3), // Hill slope
        ec50: round(posterior.ec.mean),
        max_response: round(posterior.beta.mean * T), // scale beta to total
        decay_rate: round(decayRate, 3),
        adstock_half_life_weeks: round(halfLife, 1),
      },
      results: {
        estimated_contribution: round(posterior.contribution.mean),
        contribution_share_pct: 0, // filled below
        roi: round(posterior.roi.mean),
        marginal_roi: round(posterior.marginal_roi.mean, 4),
        saturation_pct: round(posterior.saturation_pct, 1),
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

  const baseContribution = round(bayesResult.baseline_mean * T);
  const predictedKpiTotal = round(
    bayesResult.predicted_kpi.reduce((a, b) => a + b, 0),
  );

  // Response curves from posterior mean
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

  // Model fit from Bayesian predictions
  const periods = Array.from({ length: T }, (_, i) => `W${i + 1}`);
  const modelFit: ModelFitData = {
    periods,
    actual: weeklyKpi.map(v => round(v)),
    predicted: bayesResult.predicted_kpi,
  };

  // ROI intervals from posterior
  const roiIntervals: RoiInterval[] = bayesResult.channel_posteriors.map((cp) => ({
    channel: cp.channel,
    roi: cp.roi.mean,
    lower_ci: cp.roi.ci_5,
    upper_ci: cp.roi.ci_95,
    mroi: cp.marginal_roi.mean,
    mroi_lower_ci: cp.marginal_roi.ci_5,
    mroi_upper_ci: cp.marginal_roi.ci_95,
  }));

  // Contribution waterfall
  const contributionWaterfall: ContributionEntry[] = [
    {
      channel: 'Base (Non-Media)',
      contribution: baseContribution,
      contribution_pct: predictedKpiTotal > 0 ? round((baseContribution / predictedKpiTotal) * 100, 1) : 0,
    },
    ...channelModels.map((cm) => ({
      channel: cm.channel,
      contribution: cm.results.estimated_contribution,
      contribution_pct: cm.results.contribution_share_pct,
    })),
  ];

  return {
    phase: 'model',
    model_type: 'bayesian_mmm_mcmc',
    methodology: 'Bayesian MMM with Metropolis-Hastings MCMC — Adstock + Hill saturation + Fourier seasonality',
    methodology_note: `Bayesian MCMC inference with ${bayesResult.num_chains} chains x ${bayesResult.num_samples} samples (${bayesResult.warmup} warmup). R-hat and ESS computed for convergence diagnostics. Credible intervals are 90% HPD from posterior samples.`,
    total_budget: totalBudget,
    total_kpi: totalKpi,
    predicted_kpi: predictedKpiTotal,
    base_contribution: baseContribution,
    media_contribution: round(totalContribution),
    media_contribution_pct:
      predictedKpiTotal > 0 ? round((totalContribution / predictedKpiTotal) * 100, 1) : 0,
    overall_roi: totalBudget > 0 ? round(totalContribution / totalBudget) : 0,
    r_squared_estimate: bayesResult.r_squared,
    channel_models: channelModels,
    response_curves: responseCurves,
    model_fit: modelFit,
    roi_intervals: roiIntervals,
    contribution_waterfall: contributionWaterfall,
    next_step: 'post_model',
    convergence_diagnostics: bayesResult.convergence,
    mape: bayesResult.mape,
  };
}

function modelHeuristic(data: MMMModelInput): MMMModelOutput | { error: string } {
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
    methodology_note: 'Heuristic estimates — not statistically computed. R-squared, confidence intervals, and model fit are approximations for planning purposes. Full Bayesian MMM with MCMC sampling requires 104+ weeks of weekly KPI and spend data per channel.',
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

export function model(data: MMMModelInput): MMMModelOutput | { error: string } {
  if (shouldUseBayesian(data)) {
    try {
      return modelBayesian(data);
    } catch (err) {
      // Fallback to heuristic if MCMC fails
      const heuristic = modelHeuristic(data);
      if ('error' in heuristic) return heuristic;
      heuristic.methodology_note =
        `Bayesian MCMC failed (${err instanceof Error ? err.message : 'unknown error'}), fell back to heuristic. ` +
        (heuristic.methodology_note ?? '');
      return heuristic;
    }
  }
  return modelHeuristic(data);
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
  const modelResults = data.model_results ?? ({} as MMMModelOutput);
  const channels = modelResults.channel_models ?? [];
  const rSquared = modelResults.r_squared_estimate ?? 0;

  const diagnostics: PostModelOutput['overall_fit'] = [];

  // R-squared diagnostic
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

  // MAPE diagnostic (v4.0 — Bayesian mode)
  if (modelResults.mape !== undefined) {
    const mape = modelResults.mape;
    diagnostics.push({
      metric: 'mape',
      value: mape,
      status: mape < 10 ? 'good' : mape < 20 ? 'acceptable' : 'poor',
      action: mape < 10
        ? 'MAPE is excellent. Model predictions are reliable.'
        : mape < 20
          ? 'MAPE is acceptable. Monitor for drift.'
          : 'MAPE is high. Consider adding controls or re-specifying channels.',
    });
  }

  // Convergence diagnostic (v4.0 — Bayesian mode)
  if (modelResults.convergence_diagnostics) {
    const conv = modelResults.convergence_diagnostics;
    diagnostics.push({
      metric: 'max_r_hat',
      value: conv.max_r_hat,
      status: conv.max_r_hat < 1.05 ? 'good' : conv.max_r_hat < 1.1 ? 'acceptable' : 'poor',
      action: conv.max_r_hat < 1.1
        ? 'MCMC chains converged.'
        : 'Chains have not converged. Increase warmup or check model specification.',
    });
    diagnostics.push({
      metric: 'min_ess',
      value: conv.min_ess,
      status: conv.min_ess > 400 ? 'good' : conv.min_ess > 100 ? 'acceptable' : 'poor',
      action: conv.min_ess > 100
        ? 'Effective sample size is sufficient.'
        : 'ESS is low. Increase num_samples or adjust proposal distribution.',
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

  // Build posterior lookup if available
  const posteriorMap = new Map(
    (data.bayesian_posteriors ?? []).map(p => [p.channel, p])
  );

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

    // Guardrail: no channel > 50% of total
    const maxPctRaw = con.max_pct ?? 100;
    const maxPct = Math.min(maxPctRaw, 50);

    return {
      name: ch.name,
      current_spend: chSpend,
      alpha,
      ec50,
      max_response: maxResponse,
      min_pct: con.min_pct ?? 0,
      max_pct: maxPct,
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

    // Enforce guardrail: changes < 50% per period
    for (const r of reallocation) {
      if (r.current_spend > 0) {
        const changePct = Math.abs(r.delta) / r.current_spend;
        if (changePct > 0.5) {
          const cappedDelta = r.current_spend * 0.5 * (r.delta > 0 ? 1 : -1);
          r.delta = round(cappedDelta);
          r.optimized_spend = round(r.current_spend + cappedDelta);
        }
      }
    }

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

    // Use posterior mROI if available
    const posterior = posteriorMap.get(ch.name);
    const effectiveMroi = posterior?.marginal_roi_mean ??
      marginalResponse(ch.current_spend, ch.max_response, ch.alpha, ch.ec50);
    const effectiveSat = posterior?.saturation_pct ?? satPct;

    if (effectiveSat > 85) {
      recommendations.push({
        priority: 'medium',
        action: `Reduce ${ch.name} spend — ${Math.round(effectiveSat)}% saturated, diminishing returns.`,
        impact: 'Reallocate to under-saturated channels',
      });
    } else if (effectiveSat < 30 && effectiveMroi > 1.5) {
      recommendations.push({
        priority: 'medium',
        action: `Increase ${ch.name} spend — only ${Math.round(effectiveSat)}% saturated, mROI=${effectiveMroi.toFixed(2)}.`,
        impact: 'High marginal returns available',
      });
    }
  }

  // Build confidence interval on KPI lift from Bayesian posteriors
  let kpiLiftConfidence: MMMOptimizeOutput['kpi_lift_confidence'];
  if (posteriorMap.size > 0 && comparison) {
    // Approximate: scale lift by ratio of mROI CI bounds to mean
    const avgMroiRatio5 = Array.from(posteriorMap.values()).reduce(
      (s, p) => s + (p.marginal_roi_mean > 0 ? p.marginal_roi_ci_5 / p.marginal_roi_mean : 0.5), 0,
    ) / posteriorMap.size;
    const avgMroiRatio95 = Array.from(posteriorMap.values()).reduce(
      (s, p) => s + (p.marginal_roi_mean > 0 ? p.marginal_roi_ci_95 / p.marginal_roi_mean : 1.5), 0,
    ) / posteriorMap.size;
    kpiLiftConfidence = {
      ci_5: round(comparison.kpi_lift * avgMroiRatio5),
      ci_95: round(comparison.kpi_lift * avgMroiRatio95),
    };
  }

  return {
    phase: 'scenario_planning',
    methodology: posteriorMap.size > 0
      ? 'Bayesian posterior-informed greedy allocation with Hill saturation'
      : 'Greedy marginal allocation with Hill saturation (Meridian-inspired)',
    total_budget: totalBudget,
    scenarios: scenarioResults,
    comparison_vs_current: comparison ?? {
      kpi_lift: 0,
      kpi_lift_pct: 0,
      roi_improvement: 0,
      reallocation: [],
    },
    recommendations,
    kpi_lift_confidence: kpiLiftConfidence,
  };
}
