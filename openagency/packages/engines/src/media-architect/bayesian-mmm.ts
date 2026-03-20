// ─── Bayesian MMM Engine ────────────────────────────────────────────
// Lightweight Metropolis-Hastings MCMC for Marketing Mix Modeling.
// Adstock (geometric decay) -> Hill saturation -> linear combination.
// Pure TypeScript — no Python / TensorFlow dependency.

import { round } from '@openagency/core/utils/math';

// ─── Types ──────────────────────────────────────────────────────────

/** Weekly time-series input per channel */
export interface BayesianTimeSeriesInput {
  /** Channel name */
  channel: string;
  /** Weekly spend values (length = T) */
  weekly_spend: number[];
}

/** Full Bayesian MMM input */
export interface BayesianMMMInput {
  /** Weekly KPI values (length = T) */
  weekly_kpi: number[];
  /** Per-channel weekly spend */
  channels: BayesianTimeSeriesInput[];
  /** Optional weekly control variable values (length = T each) */
  controls?: Array<{ name: string; values: number[] }>;
  /** Number of MCMC chains (default 4) */
  num_chains?: number;
  /** Warmup iterations per chain (default 500) */
  warmup?: number;
  /** Sampling iterations per chain (default 1000) */
  num_samples?: number;
  /** Number of Fourier harmonics for seasonality (default 2) */
  num_harmonics?: number;
  /** Seed for reproducibility */
  seed?: number;
}

/** Posterior summary for a single parameter */
export interface PosteriorSummary {
  mean: number;
  median: number;
  std: number;
  ci_5: number;
  ci_95: number;
}

/** Channel-level posterior results */
export interface ChannelPosterior {
  channel: string;
  beta: PosteriorSummary;
  alpha: PosteriorSummary; // adstock decay
  ec: PosteriorSummary;    // half-saturation (Hill ec)
  slope: PosteriorSummary; // Hill steepness
  roi: PosteriorSummary;
  marginal_roi: PosteriorSummary;
  contribution: PosteriorSummary;
  saturation_pct: number;
}

/** Convergence diagnostics */
export interface ConvergenceDiagnostics {
  r_hat: Record<string, number>;
  ess: Record<string, number>;
  divergences: number;
  max_r_hat: number;
  min_ess: number;
  converged: boolean;
}

/** Full Bayesian MMM output */
export interface BayesianMMMOutput {
  methodology: 'bayesian_mcmc';
  num_chains: number;
  warmup: number;
  num_samples: number;
  total_samples: number;
  r_squared: number;
  mape: number;
  baseline_mean: number;
  channel_posteriors: ChannelPosterior[];
  convergence: ConvergenceDiagnostics;
  predicted_kpi: number[];
  residuals: number[];
}

// ─── Seeded PRNG (xorshift128) ──────────────────────────────────────

class PRNG {
  private s: Uint32Array;
  constructor(seed: number) {
    this.s = new Uint32Array(4);
    this.s[0] = seed >>> 0;
    this.s[1] = (seed * 2654435761) >>> 0;
    this.s[2] = (seed * 2246822519) >>> 0;
    this.s[3] = (seed * 3266489917) >>> 0;
    // Warm up
    for (let i = 0; i < 20; i++) this.next();
  }
  next(): number {
    const s = this.s;
    let t = s[3];
    t ^= t << 11;
    t ^= t >>> 8;
    s[3] = s[2]; s[2] = s[1]; s[1] = s[0];
    const s0 = s[0];
    t ^= s0;
    t ^= s0 >>> 19;
    s[0] = t;
    return (t >>> 0) / 4294967296;
  }
  /** Standard normal via Box-Muller */
  normal(mu = 0, sigma = 1): number {
    const u1 = this.next() || 1e-10;
    const u2 = this.next();
    return mu + sigma * Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  }
  /** Log-normal */
  logNormal(muLog: number, sigmaLog: number): number {
    return Math.exp(this.normal(muLog, sigmaLog));
  }
  /** Beta distribution via gamma (Marsaglia-Tsang) */
  beta(a: number, b: number): number {
    const ga = this.gamma(a);
    const gb = this.gamma(b);
    return ga / (ga + gb);
  }
  /** Gamma distribution (Marsaglia-Tsang method) */
  gamma(shape: number): number {
    if (shape < 1) {
      return this.gamma(shape + 1) * Math.pow(this.next() || 1e-10, 1 / shape);
    }
    const d = shape - 1 / 3;
    const c = 1 / Math.sqrt(9 * d);
    for (;;) {
      let x: number;
      let v: number;
      do {
        x = this.normal();
        v = 1 + c * x;
      } while (v <= 0);
      v = v * v * v;
      const u = this.next() || 1e-10;
      if (u < 1 - 0.0331 * (x * x) * (x * x)) return d * v;
      if (Math.log(u) < 0.5 * x * x + d * (1 - v + Math.log(v))) return d * v;
    }
  }
  /** Uniform in [lo, hi] */
  uniform(lo: number, hi: number): number {
    return lo + this.next() * (hi - lo);
  }
}

// ─── Adstock Transformation ─────────────────────────────────────────
// Normalized geometric decay:
// AdStock(x_t, alpha, L) = sum(s=0..L)[alpha^s * x_{t-s}] / sum(s=0..L)[alpha^s]

function adstockTransform(spend: number[], alpha: number, maxLag: number): number[] {
  const T = spend.length;
  const L = Math.min(maxLag, T - 1);
  const result = new Array<number>(T);
  // Normalization constant
  let normSum = 0;
  for (let s = 0; s <= L; s++) normSum += Math.pow(alpha, s);

  for (let t = 0; t < T; t++) {
    let val = 0;
    for (let s = 0; s <= L; s++) {
      const idx = t - s;
      if (idx >= 0) {
        val += Math.pow(alpha, s) * spend[idx];
      }
    }
    result[t] = val / normSum;
  }
  return result;
}

// ─── Hill Saturation ────────────────────────────────────────────────
// Hill(x, ec, slope) = 1 / (1 + (x/ec)^(-slope))
// Equivalent to: x^slope / (x^slope + ec^slope)

function hillSaturation(x: number, ec: number, slope: number): number {
  if (x <= 0 || ec <= 0) return 0;
  const ratio = Math.pow(x / ec, slope);
  return ratio / (1 + ratio);
}

function hillSaturationArray(xs: number[], ec: number, slope: number): number[] {
  return xs.map(x => hillSaturation(x, ec, slope));
}

// ─── Baseline + Seasonality ─────────────────────────────────────────
// baseline_t = mu0 + mu1*t + sum_k[beta_k * sin(2*pi*k*t/52) + gamma_k * cos(2*pi*k*t/52)]

interface BaselineParams {
  mu0: number;
  mu1: number;
  fourier: Array<{ beta_sin: number; gamma_cos: number }>;
}

function computeBaseline(T: number, params: BaselineParams): number[] {
  const result = new Array<number>(T);
  for (let t = 0; t < T; t++) {
    let val = params.mu0 + params.mu1 * t;
    for (let k = 0; k < params.fourier.length; k++) {
      const freq = (2 * Math.PI * (k + 1) * t) / 52;
      val += params.fourier[k].beta_sin * Math.sin(freq);
      val += params.fourier[k].gamma_cos * Math.cos(freq);
    }
    result[t] = val;
  }
  return result;
}

// ─── Full Model Prediction ──────────────────────────────────────────

interface ModelParams {
  baseline: BaselineParams;
  channels: Array<{
    beta: number;   // coefficient (scale)
    alpha: number;  // adstock decay
    ec: number;     // half-saturation point
    slope: number;  // Hill steepness
  }>;
  controlCoefs: number[];
  sigma: number;    // noise std
}

function predict(
  params: ModelParams,
  channelSpend: number[][],
  controls: number[][],
  T: number,
  maxLag: number,
): number[] {
  const baseline = computeBaseline(T, params.baseline);
  const predicted = [...baseline];

  for (let m = 0; m < channelSpend.length; m++) {
    const cp = params.channels[m];
    const adstocked = adstockTransform(channelSpend[m], cp.alpha, maxLag);
    const saturated = hillSaturationArray(adstocked, cp.ec, cp.slope);
    for (let t = 0; t < T; t++) {
      predicted[t] += cp.beta * saturated[t];
    }
  }

  for (let c = 0; c < controls.length; c++) {
    for (let t = 0; t < T; t++) {
      predicted[t] += params.controlCoefs[c] * controls[c][t];
    }
  }

  return predicted;
}

// ─── Log-Likelihood + Log-Prior ─────────────────────────────────────

function logLikelihood(observed: number[], predicted: number[], sigma: number): number {
  const T = observed.length;
  let ll = -T * Math.log(sigma) - T * 0.5 * Math.log(2 * Math.PI);
  for (let t = 0; t < T; t++) {
    const diff = observed[t] - predicted[t];
    ll -= (diff * diff) / (2 * sigma * sigma);
  }
  return ll;
}

function logPrior(params: ModelParams, channelMeanSpend: number[]): number {
  let lp = 0;

  // Baseline intercept: Normal(0, kpi_scale * 10) — very wide
  // mu1 (trend): Normal(0, 100) — wide
  // Fourier coefficients: Normal(0, kpi_scale) — wide
  // These are essentially flat so we skip them for speed

  for (let m = 0; m < params.channels.length; m++) {
    const cp = params.channels[m];
    const meanSpend = channelMeanSpend[m];

    // beta ~ LogNormal(log(0.2), 0.9) -> positive, median ~0.2
    if (cp.beta <= 0) return -Infinity;
    const logBeta = Math.log(cp.beta);
    const muLN = Math.log(0.2);
    const sigmaLN = 0.9;
    lp -= (logBeta - muLN) * (logBeta - muLN) / (2 * sigmaLN * sigmaLN);
    lp -= logBeta; // Jacobian

    // alpha ~ Beta(2, 2) -> mode at 0.5
    if (cp.alpha <= 0 || cp.alpha >= 1) return -Infinity;
    lp += Math.log(cp.alpha) + Math.log(1 - cp.alpha); // Beta(2,2) kernel

    // ec ~ LogNormal(log(meanSpend), 0.5) — centered on mean spend
    if (cp.ec <= 0) return -Infinity;
    const logEc = Math.log(cp.ec);
    const muEc = Math.log(Math.max(meanSpend, 1));
    lp -= (logEc - muEc) * (logEc - muEc) / (2 * 0.5 * 0.5);
    lp -= logEc;

    // slope ~ LogNormal(log(1.5), 0.5) -> positive, centered ~1.5
    if (cp.slope <= 0) return -Infinity;
    const logSlope = Math.log(cp.slope);
    lp -= (logSlope - Math.log(1.5)) * (logSlope - Math.log(1.5)) / (2 * 0.5 * 0.5);
    lp -= logSlope;
  }

  // sigma ~ HalfNormal(kpiStd) — implicitly enforced by sigma > 0
  if (params.sigma <= 0) return -Infinity;

  return lp;
}

// ─── Metropolis-Hastings Sampler ────────────────────────────────────

interface FlatParams {
  mu0: number;
  mu1: number;
  fourier: number[]; // [beta_sin_1, gamma_cos_1, beta_sin_2, gamma_cos_2, ...]
  channelBeta: number[];
  channelAlpha: number[];
  channelEc: number[];
  channelSlope: number[];
  controlCoefs: number[];
  sigma: number;
}

function flatToModel(flat: FlatParams, numHarmonics: number): ModelParams {
  const fourier: BaselineParams['fourier'] = [];
  for (let k = 0; k < numHarmonics; k++) {
    fourier.push({
      beta_sin: flat.fourier[k * 2] ?? 0,
      gamma_cos: flat.fourier[k * 2 + 1] ?? 0,
    });
  }
  return {
    baseline: { mu0: flat.mu0, mu1: flat.mu1, fourier },
    channels: flat.channelBeta.map((beta, i) => ({
      beta,
      alpha: flat.channelAlpha[i],
      ec: flat.channelEc[i],
      slope: flat.channelSlope[i],
    })),
    controlCoefs: [...flat.controlCoefs],
    sigma: flat.sigma,
  };
}

function cloneFlat(f: FlatParams): FlatParams {
  return {
    mu0: f.mu0,
    mu1: f.mu1,
    fourier: [...f.fourier],
    channelBeta: [...f.channelBeta],
    channelAlpha: [...f.channelAlpha],
    channelEc: [...f.channelEc],
    channelSlope: [...f.channelSlope],
    controlCoefs: [...f.controlCoefs],
    sigma: f.sigma,
  };
}

function proposeParams(current: FlatParams, rng: PRNG, stepScale: number): FlatParams {
  const p = cloneFlat(current);

  // Baseline
  p.mu0 += rng.normal(0, stepScale * 50);
  p.mu1 += rng.normal(0, stepScale * 0.5);
  for (let i = 0; i < p.fourier.length; i++) {
    p.fourier[i] += rng.normal(0, stepScale * 20);
  }

  // Channel params — propose in log/logit space for positivity/boundedness
  for (let m = 0; m < p.channelBeta.length; m++) {
    // beta (positive) — log-normal walk
    p.channelBeta[m] *= Math.exp(rng.normal(0, stepScale * 0.15));

    // alpha (0,1) — logit walk
    let logitAlpha = Math.log(p.channelAlpha[m] / (1 - p.channelAlpha[m]));
    logitAlpha += rng.normal(0, stepScale * 0.3);
    p.channelAlpha[m] = 1 / (1 + Math.exp(-logitAlpha));

    // ec (positive) — log-normal walk
    p.channelEc[m] *= Math.exp(rng.normal(0, stepScale * 0.15));

    // slope (positive) — log-normal walk
    p.channelSlope[m] *= Math.exp(rng.normal(0, stepScale * 0.1));
  }

  // Control coefficients
  for (let c = 0; c < p.controlCoefs.length; c++) {
    p.controlCoefs[c] += rng.normal(0, stepScale * 10);
  }

  // sigma (positive) — log-normal walk
  p.sigma *= Math.exp(rng.normal(0, stepScale * 0.1));

  return p;
}

interface ChainResult {
  samples: FlatParams[];
  acceptRate: number;
}

function runChain(
  observed: number[],
  channelSpend: number[][],
  controls: number[][],
  channelMeanSpend: number[],
  init: FlatParams,
  numHarmonics: number,
  warmup: number,
  numSamples: number,
  rng: PRNG,
  maxLag: number,
): ChainResult {
  const T = observed.length;
  let current = cloneFlat(init);
  let currentModel = flatToModel(current, numHarmonics);
  let currentPred = predict(currentModel, channelSpend, controls, T, maxLag);
  let currentLL = logLikelihood(observed, currentPred, currentModel.sigma);
  let currentLP = logPrior(currentModel, channelMeanSpend);
  let currentLogPost = currentLL + currentLP;

  const samples: FlatParams[] = [];
  let accepted = 0;
  const totalIter = warmup + numSamples;

  // Adaptive step scale
  let stepScale = 1.0;

  for (let iter = 0; iter < totalIter; iter++) {
    const proposed = proposeParams(current, rng, stepScale);
    const proposedModel = flatToModel(proposed, numHarmonics);
    const proposedPred = predict(proposedModel, channelSpend, controls, T, maxLag);
    const proposedLL = logLikelihood(observed, proposedPred, proposedModel.sigma);
    const proposedLP = logPrior(proposedModel, channelMeanSpend);
    const proposedLogPost = proposedLL + proposedLP;

    const logAcceptRatio = proposedLogPost - currentLogPost;

    if (Math.log(rng.next() || 1e-10) < logAcceptRatio) {
      current = proposed;
      currentModel = proposedModel;
      currentPred = proposedPred;
      currentLL = proposedLL;
      currentLP = proposedLP;
      currentLogPost = proposedLogPost;
      accepted++;
    }

    // Adaptive step during warmup — target ~25% acceptance
    if (iter < warmup && iter > 0 && iter % 50 === 0) {
      const rate = accepted / (iter + 1);
      if (rate < 0.15) stepScale *= 0.8;
      else if (rate > 0.35) stepScale *= 1.2;
      stepScale = Math.max(0.01, Math.min(stepScale, 10));
    }

    if (iter >= warmup) {
      samples.push(cloneFlat(current));
    }
  }

  return { samples, acceptRate: accepted / totalIter };
}

// ─── Convergence Diagnostics ────────────────────────────────────────

/** Gelman-Rubin R-hat statistic for a single scalar parameter across chains */
function computeRHat(chains: number[][]): number {
  const m = chains.length;
  const n = chains[0].length;
  if (m < 2 || n < 2) return 1.0;

  const chainMeans = chains.map(c => c.reduce((a, b) => a + b, 0) / n);
  const overallMean = chainMeans.reduce((a, b) => a + b, 0) / m;

  // Between-chain variance
  let B = 0;
  for (const cm of chainMeans) B += (cm - overallMean) ** 2;
  B = (B * n) / (m - 1);

  // Within-chain variance
  let W = 0;
  for (let i = 0; i < m; i++) {
    let s2 = 0;
    for (const v of chains[i]) s2 += (v - chainMeans[i]) ** 2;
    W += s2 / (n - 1);
  }
  W /= m;

  if (W === 0) return 1.0;
  const varHat = ((n - 1) / n) * W + B / n;
  return Math.sqrt(varHat / W);
}

/** Effective sample size (ESS) using autocorrelation */
function computeESS(chains: number[][]): number {
  // Pool all chains
  const all: number[] = [];
  for (const c of chains) all.push(...c);
  const n = all.length;
  if (n < 4) return n;

  const mean = all.reduce((a, b) => a + b, 0) / n;
  const variance = all.reduce((s, v) => s + (v - mean) ** 2, 0) / n;
  if (variance === 0) return n;

  // Compute autocorrelation up to lag maxLag
  const maxLag = Math.min(n - 1, 100);
  let tauSum = 0;
  for (let lag = 1; lag <= maxLag; lag++) {
    let autoCorr = 0;
    for (let t = 0; t < n - lag; t++) {
      autoCorr += (all[t] - mean) * (all[t + lag] - mean);
    }
    autoCorr /= (n * variance);
    if (autoCorr < 0.05) break; // Cut off when autocorrelation is negligible
    tauSum += autoCorr;
  }

  return Math.max(1, n / (1 + 2 * tauSum));
}

function summarizeSamples(values: number[]): PosteriorSummary {
  const sorted = [...values].sort((a, b) => a - b);
  const n = sorted.length;
  const mean = values.reduce((a, b) => a + b, 0) / n;
  const variance = values.reduce((s, v) => s + (v - mean) ** 2, 0) / n;
  return {
    mean: round(mean, 4),
    median: round(sorted[Math.floor(n * 0.5)], 4),
    std: round(Math.sqrt(variance), 4),
    ci_5: round(sorted[Math.floor(n * 0.05)], 4),
    ci_95: round(sorted[Math.floor(n * 0.95)], 4),
  };
}

// ─── Main Entry Point ───────────────────────────────────────────────

export function runBayesianMMM(input: BayesianMMMInput): BayesianMMMOutput {
  const T = input.weekly_kpi.length;
  const M = input.channels.length;
  const numChains = input.num_chains ?? 4;
  const warmup = input.warmup ?? 500;
  const numSamples = input.num_samples ?? 1000;
  const numHarmonics = input.num_harmonics ?? 2;
  const seed = input.seed ?? 42;
  const maxLag = 8; // max adstock lag in weeks

  const channelSpend = input.channels.map(c => c.weekly_spend);
  const controls = (input.controls ?? []).map(c => c.values);

  // Compute statistics for initialization
  const kpiMean = input.weekly_kpi.reduce((a, b) => a + b, 0) / T;
  const kpiStd = Math.sqrt(
    input.weekly_kpi.reduce((s, v) => s + (v - kpiMean) ** 2, 0) / T
  );
  const channelMeanSpend = channelSpend.map(
    s => s.reduce((a, b) => a + b, 0) / T
  );

  // Initialize parameters
  function initParams(rng: PRNG): FlatParams {
    const fourier: number[] = [];
    for (let k = 0; k < numHarmonics * 2; k++) {
      fourier.push(rng.normal(0, kpiStd * 0.1));
    }
    return {
      mu0: kpiMean * 0.4 + rng.normal(0, kpiStd * 0.1),
      mu1: rng.normal(0, 1),
      fourier,
      channelBeta: channelMeanSpend.map(ms =>
        Math.max(0.01, rng.logNormal(Math.log(0.2), 0.3)) * (kpiMean / Math.max(ms, 1)) * 0.1
      ),
      channelAlpha: channelMeanSpend.map(() => rng.beta(2, 2)),
      channelEc: channelMeanSpend.map(ms => ms * rng.uniform(0.5, 2)),
      channelSlope: channelMeanSpend.map(() => Math.max(0.3, rng.logNormal(Math.log(1.5), 0.3))),
      controlCoefs: controls.map(() => rng.normal(0, 10)),
      sigma: kpiStd * rng.uniform(0.3, 0.7),
    };
  }

  // Run chains
  const chainResults: ChainResult[] = [];
  for (let c = 0; c < numChains; c++) {
    const rng = new PRNG(seed + c * 7919);
    const init = initParams(rng);
    const chainRng = new PRNG(seed + c * 7919 + 1000);
    chainResults.push(
      runChain(
        input.weekly_kpi, channelSpend, controls, channelMeanSpend,
        init, numHarmonics, warmup, numSamples, chainRng, maxLag,
      )
    );
  }

  // Collect all samples across chains
  const allSamples: FlatParams[] = [];
  for (const cr of chainResults) allSamples.push(...cr.samples);

  // ─── Convergence diagnostics ──────────────────────────────────────
  const rHatMap: Record<string, number> = {};
  const essMap: Record<string, number> = {};

  // Extract per-chain traces for key parameters
  for (let m = 0; m < M; m++) {
    const chName = input.channels[m].channel;
    const betaChains = chainResults.map(cr => cr.samples.map(s => s.channelBeta[m]));
    const alphaChains = chainResults.map(cr => cr.samples.map(s => s.channelAlpha[m]));
    const ecChains = chainResults.map(cr => cr.samples.map(s => s.channelEc[m]));
    const slopeChains = chainResults.map(cr => cr.samples.map(s => s.channelSlope[m]));

    rHatMap[`beta_${chName}`] = round(computeRHat(betaChains), 3);
    rHatMap[`alpha_${chName}`] = round(computeRHat(alphaChains), 3);
    rHatMap[`ec_${chName}`] = round(computeRHat(ecChains), 3);
    rHatMap[`slope_${chName}`] = round(computeRHat(slopeChains), 3);

    essMap[`beta_${chName}`] = round(computeESS(betaChains));
    essMap[`alpha_${chName}`] = round(computeESS(alphaChains));
    essMap[`ec_${chName}`] = round(computeESS(ecChains));
    essMap[`slope_${chName}`] = round(computeESS(slopeChains));
  }

  const rHatValues = Object.values(rHatMap);
  const essValues = Object.values(essMap);
  const maxRHat = Math.max(...rHatValues);
  const minESS = Math.min(...essValues);

  const convergence: ConvergenceDiagnostics = {
    r_hat: rHatMap,
    ess: essMap,
    divergences: 0, // MH doesn't have divergences like NUTS
    max_r_hat: round(maxRHat, 3),
    min_ess: round(minESS),
    converged: maxRHat < 1.1 && minESS > 100,
  };

  // ─── Posterior summaries ──────────────────────────────────────────

  const channelPosteriors: ChannelPosterior[] = [];

  for (let m = 0; m < M; m++) {
    const chName = input.channels[m].channel;
    const betas = allSamples.map(s => s.channelBeta[m]);
    const alphas = allSamples.map(s => s.channelAlpha[m]);
    const ecs = allSamples.map(s => s.channelEc[m]);
    const slopes = allSamples.map(s => s.channelSlope[m]);

    // Compute per-sample ROI and contribution
    const totalSpend = channelSpend[m].reduce((a, b) => a + b, 0);
    const rois: number[] = [];
    const mRois: number[] = [];
    const contributions: number[] = [];

    for (const sample of allSamples) {
      const cp = {
        beta: sample.channelBeta[m],
        alpha: sample.channelAlpha[m],
        ec: sample.channelEc[m],
        slope: sample.channelSlope[m],
      };
      const adstocked = adstockTransform(channelSpend[m], cp.alpha, maxLag);
      const saturated = hillSaturationArray(adstocked, cp.ec, cp.slope);
      const contribution = saturated.reduce((s, v) => s + cp.beta * v, 0);
      contributions.push(contribution);
      rois.push(totalSpend > 0 ? contribution / totalSpend : 0);

      // Marginal ROI at mean spend: derivative of Hill at mean adstocked spend
      const meanAdstocked = adstocked.reduce((a, b) => a + b, 0) / T;
      const delta = Math.max(1, meanAdstocked * 0.01);
      const h1 = hillSaturation(meanAdstocked, cp.ec, cp.slope);
      const h2 = hillSaturation(meanAdstocked + delta, cp.ec, cp.slope);
      mRois.push(cp.beta * (h2 - h1) / delta);
    }

    // Saturation at mean adstocked spend using posterior mean params
    const meanAlpha = alphas.reduce((a, b) => a + b, 0) / alphas.length;
    const meanEc = ecs.reduce((a, b) => a + b, 0) / ecs.length;
    const meanSlope = slopes.reduce((a, b) => a + b, 0) / slopes.length;
    const adstockedMean = adstockTransform(channelSpend[m], meanAlpha, maxLag);
    const meanAdstockedVal = adstockedMean.reduce((a, b) => a + b, 0) / T;
    const satPct = hillSaturation(meanAdstockedVal, meanEc, meanSlope) * 100;

    channelPosteriors.push({
      channel: chName,
      beta: summarizeSamples(betas),
      alpha: summarizeSamples(alphas),
      ec: summarizeSamples(ecs),
      slope: summarizeSamples(slopes),
      roi: summarizeSamples(rois),
      marginal_roi: summarizeSamples(mRois),
      contribution: summarizeSamples(contributions),
      saturation_pct: round(satPct, 1),
    });
  }

  // ─── Predicted KPI + R-squared + MAPE ─────────────────────────────

  // Use posterior mean params for point prediction
  const meanParams: FlatParams = {
    mu0: allSamples.reduce((s, p) => s + p.mu0, 0) / allSamples.length,
    mu1: allSamples.reduce((s, p) => s + p.mu1, 0) / allSamples.length,
    fourier: Array.from({ length: numHarmonics * 2 }, (_, i) =>
      allSamples.reduce((s, p) => s + p.fourier[i], 0) / allSamples.length
    ),
    channelBeta: Array.from({ length: M }, (_, m) =>
      allSamples.reduce((s, p) => s + p.channelBeta[m], 0) / allSamples.length
    ),
    channelAlpha: Array.from({ length: M }, (_, m) =>
      allSamples.reduce((s, p) => s + p.channelAlpha[m], 0) / allSamples.length
    ),
    channelEc: Array.from({ length: M }, (_, m) =>
      allSamples.reduce((s, p) => s + p.channelEc[m], 0) / allSamples.length
    ),
    channelSlope: Array.from({ length: M }, (_, m) =>
      allSamples.reduce((s, p) => s + p.channelSlope[m], 0) / allSamples.length
    ),
    controlCoefs: Array.from({ length: controls.length }, (_, c) =>
      allSamples.reduce((s, p) => s + p.controlCoefs[c], 0) / allSamples.length
    ),
    sigma: allSamples.reduce((s, p) => s + p.sigma, 0) / allSamples.length,
  };

  const meanModel = flatToModel(meanParams, numHarmonics);
  const predictedKpi = predict(meanModel, channelSpend, controls, T, maxLag);
  const residuals = input.weekly_kpi.map((y, t) => y - predictedKpi[t]);

  // R-squared
  const ssTot = input.weekly_kpi.reduce((s, y) => s + (y - kpiMean) ** 2, 0);
  const ssRes = residuals.reduce((s, r) => s + r * r, 0);
  const rSquared = ssTot > 0 ? 1 - ssRes / ssTot : 0;

  // MAPE
  const mape =
    input.weekly_kpi.reduce((s, y, t) => {
      if (y === 0) return s;
      return s + Math.abs((y - predictedKpi[t]) / y);
    }, 0) /
    input.weekly_kpi.filter(y => y !== 0).length *
    100;

  return {
    methodology: 'bayesian_mcmc',
    num_chains: numChains,
    warmup,
    num_samples: numSamples,
    total_samples: allSamples.length,
    r_squared: round(Math.max(0, rSquared), 4),
    mape: round(mape, 2),
    baseline_mean: round(
      allSamples.reduce((s, p) => s + p.mu0, 0) / allSamples.length
    ),
    channel_posteriors: channelPosteriors,
    convergence,
    predicted_kpi: predictedKpi.map(v => round(v)),
    residuals: residuals.map(v => round(v)),
  };
}
