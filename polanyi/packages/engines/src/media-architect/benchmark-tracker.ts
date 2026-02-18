// ─── Benchmark Tracker ──────────────────────────────────────────────
// Compares campaign actuals vs market benchmarks and detects anomalies.
// Port of benchmark_tracker.py

import { round } from '@openagency/core/utils/math';
import { getAdjustedBenchmark } from './benchmarks.js';
import type {
  BenchmarkHealthInput,
  BenchmarkHealthOutput,
  BenchmarkCheck,
  AnomalyDetectInput,
  AnomalyDetectOutput,
} from '@openagency/types';

export function healthCheck(data: BenchmarkHealthInput): BenchmarkHealthOutput {
  const industry = data.industry;
  const channels = data.channels;
  const results: BenchmarkHealthOutput['channels'] = [];

  for (const ch of channels) {
    const name = ch.name;
    const spend = ch.spend ?? 0;
    const impressions = ch.impressions ?? 0;
    const clicks = ch.clicks ?? 0;
    const conversions = ch.conversions ?? 0;

    const actuals: Record<string, number> = {};
    if (impressions > 0) {
      actuals.cpm = (spend / impressions) * 1000;
      if (clicks > 0) {
        actuals.ctr = (clicks / impressions) * 100;
        actuals.cpc = spend / clicks;
      }
      if (conversions > 0 && clicks > 0) {
        actuals.cvr = (conversions / clicks) * 100;
      }
    }

    const checks: BenchmarkCheck[] = [];
    for (const [metric, actual] of Object.entries(actuals)) {
      const benchmark = getAdjustedBenchmark(name, metric, industry);
      if (benchmark === null) continue;

      const deviationPct = ((actual - benchmark) / benchmark) * 100;

      let status: BenchmarkCheck['status'];
      if (metric === 'cpm' || metric === 'cpc') {
        // Higher cost = worse
        if (deviationPct > 30) status = 'critical';
        else if (deviationPct > 15) status = 'warning';
        else status = 'healthy';
      } else {
        // Lower performance = worse
        if (deviationPct < -30) status = 'critical';
        else if (deviationPct < -15) status = 'warning';
        else status = 'healthy';
      }

      let recommendation = '';
      if (status === 'critical') {
        if (metric === 'cpm' || metric === 'cpc') {
          recommendation =
            `Review targeting and bidding. ` +
            `${metric.toUpperCase()} is ${Math.abs(Math.round(deviationPct))}% above benchmark.`;
        } else {
          recommendation =
            `Investigate low ${metric.toUpperCase()}. ` +
            `Check creative, landing page, and tracking.`;
        }
      } else if (status === 'warning') {
        recommendation = `Monitor ${metric.toUpperCase()} closely.`;
      }

      checks.push({
        metric,
        actual: round(actual),
        benchmark: round(benchmark),
        deviation_pct: round(deviationPct, 1),
        status,
        recommendation,
      });
    }

    let overallStatus: 'healthy' | 'warning' | 'critical' = 'healthy';
    if (checks.some((c) => c.status === 'critical')) overallStatus = 'critical';
    else if (checks.some((c) => c.status === 'warning')) overallStatus = 'warning';

    results.push({
      channel: name,
      overall_status: overallStatus,
      checks,
    });
  }

  return { industry, channels: results };
}

export function anomalyDetect(data: AnomalyDetectInput): AnomalyDetectOutput {
  const metric = data.metric;
  const values = data.values;
  const threshold = data.threshold ?? 2.0;

  if (values.length < 3) {
    return {
      metric,
      data_points: values.length,
      mean: 0,
      std: 0,
      threshold,
      anomalies_detected: 0,
      anomalies: [],
    };
  }

  const n = values.length;
  const mean = values.reduce((a, b) => a + b, 0) / n;
  const variance = values.reduce((sum, v) => sum + (v - mean) ** 2, 0) / n;
  const std = Math.sqrt(variance) || 0.0001;

  const anomalies: AnomalyDetectOutput['anomalies'] = [];
  for (let i = 0; i < values.length; i++) {
    const z = (values[i] - mean) / std;
    if (Math.abs(z) >= threshold) {
      anomalies.push({
        index: i,
        value: values[i],
        z_score: round(z),
        severity: Math.abs(z) >= 3.0 ? 'high' : 'medium',
        direction: z > 0 ? 'above' : 'below',
      });
    }
  }

  return {
    metric,
    data_points: n,
    mean: round(mean),
    std: round(std),
    threshold,
    anomalies_detected: anomalies.length,
    anomalies,
  };
}
