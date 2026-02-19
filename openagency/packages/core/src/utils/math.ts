// ─── Shared Math Utilities ──────────────────────────────────────────
// Extracted from all 13 Python scripts for reuse across engines

/**
 * Hill saturation curve response function.
 * Used by channel-optimizer and mmm-scenario-planner.
 * response = maxResponse * (spend^alpha / (spend^alpha + ec50^alpha))
 */
export function hillResponse(
  spend: number,
  maxResponse: number,
  alpha: number,
  ec50: number,
): number {
  if (spend <= 0) return 0;
  const spendA = Math.pow(spend, alpha);
  const ec50A = Math.pow(ec50, alpha);
  return maxResponse * (spendA / (spendA + ec50A));
}

/**
 * Marginal response (approximate derivative of Hill curve).
 * Returns incremental response per $1 of additional spend.
 */
export function marginalResponse(
  spend: number,
  maxResponse: number,
  alpha: number,
  ec50: number,
  delta: number = 1000,
): number {
  const r1 = hillResponse(spend, maxResponse, alpha, ec50);
  const r2 = hillResponse(spend + delta, maxResponse, alpha, ec50);
  return (r2 - r1) / delta;
}

/**
 * Geometric adstock transformation for time-series spend data.
 * adstock[t] = spend[t] + decayRate * adstock[t-1]
 */
export function adstock(spendSeries: number[], decayRate: number): number[] {
  const result: number[] = [];
  let prev = 0;
  for (const s of spendSeries) {
    const val = s + decayRate * prev;
    result.push(val);
    prev = val;
  }
  return result;
}

/**
 * Adstock half-life in weeks from decay rate.
 * halfLife = ln(0.5) / ln(decayRate)
 */
export function adstockHalfLife(decayRate: number): number {
  if (decayRate <= 0 || decayRate >= 1) return 0;
  return Math.log(0.5) / Math.log(decayRate);
}

/**
 * Factorial for Shapley value computation.
 */
export function factorial(n: number): number {
  if (n <= 1) return 1;
  let result = 1;
  for (let i = 2; i <= n; i++) {
    result *= i;
  }
  return result;
}

/**
 * Generate all combinations of size k from array.
 * Used by Shapley attribution for coalition enumeration.
 */
export function* combinations<T>(arr: T[], k: number): Generator<T[]> {
  if (k === 0) {
    yield [];
    return;
  }
  for (let i = 0; i <= arr.length - k; i++) {
    for (const rest of combinations(arr.slice(i + 1), k - 1)) {
      yield [arr[i], ...rest];
    }
  }
}

/**
 * Normal CDF approximation (Abramowitz & Stegun).
 * Used by power analysis for statistical significance.
 */
export function normalCdf(x: number): number {
  const a1 = 0.254829592;
  const a2 = -0.284496736;
  const a3 = 1.421413741;
  const a4 = -1.453152027;
  const a5 = 1.061405429;
  const p = 0.3275911;

  const sign = x < 0 ? -1 : 1;
  const absX = Math.abs(x) / Math.SQRT2;

  const t = 1.0 / (1.0 + p * absX);
  const y = 1.0 - ((((a5 * t + a4) * t + a3) * t + a2) * t + a1) * t * Math.exp(-absX * absX);

  return 0.5 * (1.0 + sign * y);
}

/**
 * Normal PPF (inverse CDF) approximation.
 * Rational approximation for 0 < p < 1.
 */
export function normalPpf(p: number): number {
  if (p <= 0) return -Infinity;
  if (p >= 1) return Infinity;
  if (p === 0.5) return 0;

  // Rational approximation (Abramowitz & Stegun 26.2.23)
  if (p < 0.5) {
    return -normalPpf(1 - p);
  }

  const t = Math.sqrt(-2 * Math.log(1 - p));
  const c0 = 2.515517;
  const c1 = 0.802853;
  const c2 = 0.010328;
  const d1 = 1.432788;
  const d2 = 0.189269;
  const d3 = 0.001308;

  return t - (c0 + c1 * t + c2 * t * t) / (1 + d1 * t + d2 * t * t + d3 * t * t * t);
}

/**
 * Z-score computation for anomaly detection.
 * Returns mean, std, and z-scores for each value.
 */
export function zScoreAnalysis(values: number[]): {
  mean: number;
  std: number;
  scores: number[];
} {
  const n = values.length;
  if (n === 0) return { mean: 0, std: 0, scores: [] };

  const mean = values.reduce((a, b) => a + b, 0) / n;
  const variance = values.reduce((sum, v) => sum + (v - mean) ** 2, 0) / n;
  const std = Math.sqrt(variance);

  const scores = std === 0 ? values.map(() => 0) : values.map((v) => (v - mean) / std);

  return { mean, std, scores };
}

/**
 * Round to specified decimal places.
 */
export function round(value: number, decimals: number = 2): number {
  const factor = Math.pow(10, decimals);
  return Math.round(value * factor) / factor;
}
