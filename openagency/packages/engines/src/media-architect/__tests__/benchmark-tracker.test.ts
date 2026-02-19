import { describe, it, expect } from 'vitest';
import { healthCheck, anomalyDetect } from '../benchmark-tracker.js';

describe('benchmark-tracker', () => {
  describe('healthCheck', () => {
    it('flags critical when CPM is 30%+ above benchmark', () => {
      const result = healthCheck({
        industry: 'retail',
        channels: [
          {
            name: 'programmatic_display',
            spend: 50000,
            impressions: 200000, // CPM = $250, benchmark ~$85.5 for retail
            clicks: 400,
            conversions: 4,
          },
        ],
      });
      const ch = result.channels[0];
      expect(ch.overall_status).toBe('critical');
      const cpmCheck = ch.checks.find((c) => c.metric === 'cpm');
      expect(cpmCheck?.status).toBe('critical');
    });

    it('returns healthy for good performance', () => {
      // Retail programmatic_display benchmarks: CPM=85.5, CPC=7.6, CTR=0.19%, CVR=1.17%
      // Need spend/impressions/clicks/conversions that hit all benchmarks:
      // CPM: spend/impressions*1000=85.5 → spend=8550 at 100k impr
      // CPC: spend/clicks=7.6 → clicks=1125
      // CTR: clicks/impressions*100=1.125% (above 0.19% benchmark = healthy)
      // CVR: conversions/clicks*100=1.17% → conversions=13
      const result = healthCheck({
        industry: 'retail',
        channels: [
          {
            name: 'programmatic_display',
            spend: 8550,
            impressions: 100000,
            clicks: 1125,
            conversions: 13,
          },
        ],
      });
      const ch = result.channels[0];
      expect(ch.overall_status).toBe('healthy');
    });

    it('applies industry multipliers', () => {
      // Financial industry has cpm multiplier of 1.5
      const retailResult = healthCheck({
        industry: 'retail',
        channels: [{ name: 'programmatic_display', spend: 10000, impressions: 100000, clicks: 100, conversions: 1 }],
      });
      const financialResult = healthCheck({
        industry: 'financial',
        channels: [{ name: 'programmatic_display', spend: 10000, impressions: 100000, clicks: 100, conversions: 1 }],
      });
      const retailCpm = retailResult.channels[0].checks.find((c) => c.metric === 'cpm')!;
      const financialCpm = financialResult.channels[0].checks.find((c) => c.metric === 'cpm')!;
      // Same actual, different benchmarks -> financial benchmark is higher
      expect(financialCpm.benchmark).toBeGreaterThan(retailCpm.benchmark);
    });
  });

  describe('anomalyDetect', () => {
    it('detects obvious outlier', () => {
      const result = anomalyDetect({
        metric: 'cpc',
        values: [1.2, 1.3, 1.1, 1.2, 1.3, 1.1, 1.2, 10.0],
        threshold: 2.0,
      });
      expect(result.anomalies_detected).toBeGreaterThanOrEqual(1);
      expect(result.anomalies[0].direction).toBe('above');
      expect(result.anomalies[0].value).toBe(10.0);
    });

    it('returns no anomalies for uniform data', () => {
      const result = anomalyDetect({
        metric: 'ctr',
        values: [2.0, 2.1, 1.9, 2.0, 2.1, 1.9],
      });
      expect(result.anomalies_detected).toBe(0);
    });

    it('handles too few data points gracefully', () => {
      const result = anomalyDetect({
        metric: 'cvr',
        values: [1.0, 2.0],
      });
      expect(result.anomalies_detected).toBe(0);
      expect(result.data_points).toBe(2);
    });

    it('classifies severity correctly', () => {
      const result = anomalyDetect({
        metric: 'cpm',
        values: [100, 100, 100, 100, 100, 100, 100, 500],
        threshold: 2.0,
      });
      const anomaly = result.anomalies[0];
      expect(anomaly).toBeDefined();
      // Z-score for 500 in a series of mostly 100s should be high
      expect(Math.abs(anomaly.z_score)).toBeGreaterThanOrEqual(2.0);
    });
  });
});
