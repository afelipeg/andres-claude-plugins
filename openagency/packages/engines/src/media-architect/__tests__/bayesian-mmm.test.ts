import { describe, it, expect } from 'vitest';
import { runBayesianMMM } from '../bayesian-mmm.js';

/**
 * Generate synthetic weekly data with known signal for testing.
 * KPI = baseline + channel_effects + noise
 */
function generateSyntheticData(T: number, numChannels: number, seed: number = 42) {
  // Simple LCG PRNG for deterministic test data
  let state = seed;
  function rand() {
    state = (state * 1664525 + 1013904223) & 0x7fffffff;
    return state / 0x7fffffff;
  }
  function normal(mu = 0, sigma = 1) {
    const u1 = rand() || 0.001;
    const u2 = rand();
    return mu + sigma * Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  }

  const channels: Array<{ channel: string; weekly_spend: number[] }> = [];
  const trueParams = [];

  for (let m = 0; m < numChannels; m++) {
    const baseMean = 10000 + m * 5000;
    const weekly: number[] = [];
    for (let t = 0; t < T; t++) {
      // Varying spend with some pattern
      const seasonal = 1 + 0.3 * Math.sin((2 * Math.PI * t) / 52);
      weekly.push(Math.max(100, baseMean * seasonal + normal(0, baseMean * 0.15)));
    }
    channels.push({ channel: `channel_${m}`, weekly_spend: weekly });
    trueParams.push({ beta: 0.3 + m * 0.1, alpha: 0.5, ec: baseMean, slope: 1.5 });
  }

  // Generate KPI
  const weeklyKpi: number[] = [];
  for (let t = 0; t < T; t++) {
    let kpi = 50000; // baseline
    kpi += 2000 * Math.sin((2 * Math.PI * t) / 52); // seasonality
    kpi += 10 * t; // trend
    for (let m = 0; m < numChannels; m++) {
      const spend = channels[m].weekly_spend[t];
      const ec = trueParams[m].ec;
      const slope = trueParams[m].slope;
      const hillVal = Math.pow(spend / ec, slope) / (1 + Math.pow(spend / ec, slope));
      kpi += trueParams[m].beta * hillVal * 30000;
    }
    kpi += normal(0, 1000); // noise
    weeklyKpi.push(kpi);
  }

  return { weeklyKpi, channels };
}

describe('bayesian-mmm', () => {
  it('runs MCMC and returns valid output structure', () => {
    const T = 104;
    const { weeklyKpi, channels } = generateSyntheticData(T, 3);

    const result = runBayesianMMM({
      weekly_kpi: weeklyKpi,
      channels,
      num_chains: 2,
      warmup: 100,
      num_samples: 200,
      seed: 42,
    });

    expect(result.methodology).toBe('bayesian_mcmc');
    expect(result.num_chains).toBe(2);
    expect(result.warmup).toBe(100);
    expect(result.num_samples).toBe(200);
    expect(result.total_samples).toBe(400); // 2 chains x 200

    // Channel posteriors
    expect(result.channel_posteriors).toHaveLength(3);
    for (const cp of result.channel_posteriors) {
      expect(cp.beta.mean).toBeGreaterThan(0);
      expect(cp.alpha.mean).toBeGreaterThan(0);
      expect(cp.alpha.mean).toBeLessThan(1);
      expect(cp.ec.mean).toBeGreaterThan(0);
      expect(cp.slope.mean).toBeGreaterThan(0);
      // CI should bracket mean
      expect(cp.beta.ci_5).toBeLessThanOrEqual(cp.beta.ci_95);
      expect(cp.roi.ci_5).toBeLessThanOrEqual(cp.roi.ci_95);
    }

    // Predictions
    expect(result.predicted_kpi).toHaveLength(T);
    expect(result.residuals).toHaveLength(T);

    // R-squared should be reasonable (> 0 at least)
    expect(result.r_squared).toBeGreaterThanOrEqual(0);
    expect(result.r_squared).toBeLessThanOrEqual(1);

    // MAPE should be finite
    expect(Number.isFinite(result.mape)).toBe(true);

    // Convergence diagnostics
    expect(result.convergence.max_r_hat).toBeGreaterThan(0);
    expect(result.convergence.min_ess).toBeGreaterThan(0);
    expect(Object.keys(result.convergence.r_hat).length).toBe(12); // 4 params x 3 channels
    expect(Object.keys(result.convergence.ess).length).toBe(12);
  });

  it('handles minimal data gracefully', () => {
    // Even with little data, should not throw
    const T = 52;
    const { weeklyKpi, channels } = generateSyntheticData(T, 2, 123);

    const result = runBayesianMMM({
      weekly_kpi: weeklyKpi,
      channels,
      num_chains: 2,
      warmup: 50,
      num_samples: 100,
      seed: 123,
    });

    expect(result.channel_posteriors).toHaveLength(2);
    expect(result.predicted_kpi).toHaveLength(T);
  });

  it('produces results with controls', () => {
    const T = 104;
    const { weeklyKpi, channels } = generateSyntheticData(T, 2, 999);

    // Add a control variable
    const control = {
      name: 'temperature',
      values: Array.from({ length: T }, (_, t) => 20 + 10 * Math.sin((2 * Math.PI * t) / 52)),
    };

    const result = runBayesianMMM({
      weekly_kpi: weeklyKpi,
      channels,
      controls: [control],
      num_chains: 2,
      warmup: 50,
      num_samples: 100,
      seed: 999,
    });

    expect(result.channel_posteriors).toHaveLength(2);
    expect(result.predicted_kpi).toHaveLength(T);
  });
});
