import { describe, it, expect } from 'vitest';
import { geoLift, conversionLift, holdout } from '../power-analysis.js';

describe('power-analysis', () => {
  describe('geoLift', () => {
    it('designs geo experiment with power estimate', () => {
      const result = geoLift({
        daily_conversions: 1000,
        expected_lift_pct: 10,
        test_duration_days: 28,
        geo_pairs: 5,
      });
      expect(result.test_type).toBe('geo_lift');
      expect(result.statistical_power).toBeGreaterThan(0);
      expect(result.statistical_power).toBeLessThanOrEqual(1);
      expect(result.minimum_detectable_lift_pct).toBeGreaterThan(0);
      expect(result.revenue_at_risk).toBeGreaterThan(0);
      expect(result.confidence_level).toBe(95);
    });

    it('lower daily conversions reduce power', () => {
      const highConv = geoLift({
        daily_conversions: 5000,
        expected_lift_pct: 10,
        test_duration_days: 28,
        geo_pairs: 5,
      });
      const lowConv = geoLift({
        daily_conversions: 100,
        expected_lift_pct: 10,
        test_duration_days: 28,
        geo_pairs: 5,
      });
      expect(highConv.statistical_power).toBeGreaterThanOrEqual(lowConv.statistical_power);
    });
  });

  describe('conversionLift', () => {
    it('designs conversion lift test', () => {
      const result = conversionLift({
        daily_impressions: 500000,
        baseline_cvr: 0.02,
        expected_lift_pct: 15,
        test_duration_days: 14,
      });
      expect(result.test_type).toBe('conversion_lift');
      expect(result.test_group_size).toBeGreaterThan(result.control_group_size);
      expect(result.statistical_power).toBeGreaterThan(0);
      expect(result.revenue_at_risk).toBeGreaterThan(0);
    });
  });

  describe('holdout', () => {
    it('designs holdout test with revenue-at-risk', () => {
      const result = holdout({
        monthly_revenue: 500000,
        channel_contribution_pct: 30,
        holdout_pct: 15,
        test_duration_days: 30,
      });
      expect(result.test_type).toBe('holdout');
      expect(result.revenue_at_risk).toBeGreaterThan(0);
      expect(result.expected_loss).toBeGreaterThan(0);
      expect(result.expected_loss).toBeLessThan(result.revenue_at_risk);
      expect(result.statistical_power).toBeGreaterThan(0);
    });

    it('recommends proceed when power is sufficient', () => {
      const result = holdout({
        monthly_revenue: 1000000,
        channel_contribution_pct: 40,
        holdout_pct: 20,
        test_duration_days: 30,
      });
      // 0.4 * 0.2 * 4 = 0.32, 0.4 + 0.32 = 0.72 >= 0.7
      expect(result.recommendation).toBe('Proceed');
    });

    it('warns when power is insufficient', () => {
      const result = holdout({
        monthly_revenue: 50000,
        channel_contribution_pct: 5,
        holdout_pct: 5,
        test_duration_days: 7,
      });
      // 0.05 * 0.05 * 4 = 0.01, 0.4 + 0.01 = 0.41 < 0.7
      expect(result.recommendation).toContain('Increase');
    });
  });
});
