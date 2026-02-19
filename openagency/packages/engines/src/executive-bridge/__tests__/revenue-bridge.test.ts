import { describe, it, expect } from 'vitest';
import { translate, compareChannels } from '../revenue-bridge.js';

describe('revenue-bridge', () => {
  describe('translate', () => {
    it('translates L3 -> L2 -> L1 metrics', () => {
      const result = translate({
        channels: [
          { name: 'search', spend: 50000, impressions: 1000000, clicks: 50000, conversions: 500, revenue: 150000 },
          { name: 'social', spend: 30000, impressions: 2000000, clicks: 40000, conversions: 200, revenue: 60000 },
        ],
        aov: 300,
        retention_rate: 0.35,
        avg_customer_months: 18,
      });

      // L1 metrics
      expect(result.l1_metrics.total_spend).toBe(80000);
      expect(result.l1_metrics.total_revenue).toBe(210000);
      expect(result.l1_metrics.cac).toBeGreaterThan(0);
      expect(result.l1_metrics.clv).toBeGreaterThan(0);
      expect(result.l1_metrics.roi_pct).toBeGreaterThan(0);

      // Channels
      expect(result.channels).toHaveLength(2);
      const search = result.channels.find((c) => c.channel === 'search')!;
      expect(search.l3_metrics.cpm).toBeDefined();
      expect(search.l3_metrics.cpc).toBeDefined();
      expect(search.l2_metrics.roas).toBe(3); // 150k/50k

      // C-Suite
      expect(result.csuite_summary.ceo).toContain('$80,000');
      expect(result.csuite_summary.cfo).toContain('ROI');
      expect(result.csuite_summary.cmo).toContain('search'); // top by ROAS

      // Efficiency score
      expect(result.efficiency_score).toBeGreaterThanOrEqual(0);
      expect(result.efficiency_score).toBeLessThanOrEqual(100);
    });

    it('computes CLV correctly', () => {
      const result = translate({
        channels: [
          { name: 'test', spend: 10000, impressions: 100000, clicks: 1000, conversions: 100, revenue: 30000 },
        ],
        aov: 300,
        retention_rate: 0.4,
        avg_customer_months: 24,
      });
      // CLV = 300 * 0.4 * 24 = 2880
      expect(result.l1_metrics.clv).toBe(2880);
    });

    it('uses aov for revenue when not provided', () => {
      const result = translate({
        channels: [
          { name: 'test', spend: 5000, impressions: 50000, clicks: 500, conversions: 50 },
        ],
        aov: 200,
      });
      // Revenue should be conversions * aov = 50 * 200 = 10000
      expect(result.channels[0].revenue).toBe(10000);
    });
  });

  describe('compareChannels', () => {
    it('ranks by ROAS descending', () => {
      const result = compareChannels({
        channels: [
          { name: 'search', spend: 100000, revenue: 400000, conversions: 1000 },
          { name: 'display', spend: 50000, revenue: 50000, conversions: 200 },
          { name: 'social', spend: 80000, revenue: 200000, conversions: 500 },
        ],
      });
      expect(result.comparison[0].channel).toBe('search');
      expect(result.comparison[0].efficiency_rank).toBe(1);
      expect(result.comparison[2].efficiency_rank).toBe(3);
    });
  });
});
