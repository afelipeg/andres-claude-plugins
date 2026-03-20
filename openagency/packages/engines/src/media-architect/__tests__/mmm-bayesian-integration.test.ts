import { describe, it, expect } from 'vitest';
import { model } from '../mmm-scenario-planner.js';

/**
 * Generate synthetic weekly data for integration test.
 */
function syntheticWeeklyData(T: number) {
  let seed = 42;
  function rand() {
    seed = (seed * 1664525 + 1013904223) & 0x7fffffff;
    return seed / 0x7fffffff;
  }

  const channels = [
    { name: 'search', baseMean: 15000 },
    { name: 'social_meta', baseMean: 12000 },
    { name: 'programmatic_display', baseMean: 8000 },
  ];

  const weeklyKpi: number[] = [];
  const channelsWithTS = channels.map(ch => {
    const weekly: number[] = [];
    for (let t = 0; t < T; t++) {
      const seasonal = 1 + 0.2 * Math.sin((2 * Math.PI * t) / 52);
      weekly.push(Math.max(100, ch.baseMean * seasonal * (0.8 + 0.4 * rand())));
    }
    return { ...ch, weekly_spend: weekly, spend: weekly.reduce((a, b) => a + b, 0) };
  });

  for (let t = 0; t < T; t++) {
    let kpi = 60000 + 5 * t; // baseline + trend
    kpi += 3000 * Math.sin((2 * Math.PI * t) / 52); // seasonality
    for (const ch of channelsWithTS) {
      const spend = ch.weekly_spend[t];
      const ec = ch.baseMean;
      const hillVal = Math.pow(spend / ec, 1.5) / (1 + Math.pow(spend / ec, 1.5));
      kpi += hillVal * 15000;
    }
    kpi *= 0.9 + 0.2 * rand(); // noise
    weeklyKpi.push(kpi);
  }

  return { weeklyKpi, channels: channelsWithTS };
}

describe('MMM Bayesian integration via model()', () => {
  it('uses Bayesian mode when weekly data is provided with 104+ weeks', () => {
    const T = 104;
    const { weeklyKpi, channels } = syntheticWeeklyData(T);
    const totalBudget = channels.reduce((s, ch) => s + ch.spend, 0);
    const totalKpi = weeklyKpi.reduce((a, b) => a + b, 0);

    const result = model({
      total_budget: totalBudget,
      total_kpi: totalKpi,
      time_periods: T,
      weekly_kpi: weeklyKpi,
      channels: channels.map(ch => ({
        name: ch.name,
        spend: ch.spend,
        weekly_spend: ch.weekly_spend,
      })),
      mcmc_config: { num_chains: 2, warmup: 100, num_samples: 200, seed: 42 },
    });

    if ('error' in result) throw new Error(result.error);

    expect(result.model_type).toBe('bayesian_mmm_mcmc');
    expect(result.methodology).toContain('Bayesian');
    expect(result.convergence_diagnostics).toBeDefined();
    expect(result.mape).toBeDefined();
    expect(result.channel_models).toHaveLength(3);
    expect(result.roi_intervals.length).toBe(3);

    // ROI intervals should come from posterior (not fixed +-20%)
    for (const ri of result.roi_intervals) {
      expect(ri.lower_ci).toBeLessThanOrEqual(ri.roi);
      expect(ri.upper_ci).toBeGreaterThanOrEqual(ri.roi);
    }
  });

  it('falls back to heuristic mode without weekly data', () => {
    const result = model({
      total_budget: 1000000,
      total_kpi: 5000000,
      time_periods: 52,
      channels: [
        { name: 'search', spend: 400000 },
        { name: 'social_meta', spend: 350000 },
        { name: 'programmatic_display', spend: 250000 },
      ],
    });

    if ('error' in result) throw new Error(result.error);

    expect(result.model_type).toBe('simplified_bayesian_mmm');
    expect(result.methodology).toContain('Meridian');
    expect(result.convergence_diagnostics).toBeUndefined();
  });

  it('falls back to heuristic mode with < 104 weeks even with weekly data', () => {
    const T = 52;
    const { weeklyKpi, channels } = syntheticWeeklyData(T);
    const totalBudget = channels.reduce((s, ch) => s + ch.spend, 0);

    const result = model({
      total_budget: totalBudget,
      total_kpi: weeklyKpi.reduce((a, b) => a + b, 0),
      time_periods: T,
      weekly_kpi: weeklyKpi,
      channels: channels.map(ch => ({
        name: ch.name,
        spend: ch.spend,
        weekly_spend: ch.weekly_spend,
      })),
    });

    if ('error' in result) throw new Error(result.error);
    expect(result.model_type).toBe('simplified_bayesian_mmm');
  });

  it('can force Bayesian mode with < 104 weeks', () => {
    const T = 60;
    const { weeklyKpi, channels } = syntheticWeeklyData(T);
    const totalBudget = channels.reduce((s, ch) => s + ch.spend, 0);

    const result = model({
      total_budget: totalBudget,
      total_kpi: weeklyKpi.reduce((a, b) => a + b, 0),
      time_periods: T,
      weekly_kpi: weeklyKpi,
      channels: channels.map(ch => ({
        name: ch.name,
        spend: ch.spend,
        weekly_spend: ch.weekly_spend,
      })),
      force_bayesian: true,
      mcmc_config: { num_chains: 2, warmup: 50, num_samples: 100, seed: 42 },
    });

    if ('error' in result) throw new Error(result.error);
    expect(result.model_type).toBe('bayesian_mmm_mcmc');
  });
});
