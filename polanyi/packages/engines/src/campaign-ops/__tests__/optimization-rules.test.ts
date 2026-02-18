import { describe, it, expect } from 'vitest';
import { analyze, reallocate } from '../optimization-rules.js';

describe('optimization-rules', () => {
  describe('analyze', () => {
    it('detects CPA overshoot', () => {
      const result = analyze({
        campaigns: [
          {
            name: 'Search Brand',
            channel: 'search',
            spend: 10000,
            budget: 30000,
            days_elapsed: 10,
            days_total: 30,
            impressions: 100000,
            clicks: 5000,
            conversions: 10, // CPA = $1000
            revenue: 20000,
            cpa_target: 500, // 100% above target
            roas_target: 3,
            historical_ctr: 0.05,
          },
        ],
      });
      const camp = result.campaigns[0];
      const cpaAlert = camp.alerts.find((a) => a.type === 'cpa_overshoot');
      expect(cpaAlert).toBeDefined();
      expect(cpaAlert!.severity).toBe('critical');
    });

    it('detects zero conversions', () => {
      const result = analyze({
        campaigns: [
          {
            name: 'Display',
            channel: 'programmatic_display',
            spend: 5000,
            budget: 10000,
            days_elapsed: 15,
            days_total: 30,
            impressions: 200000,
            clicks: 400,
            conversions: 0,
            revenue: 0,
            cpa_target: 50,
            roas_target: 2,
            historical_ctr: 0.002,
          },
        ],
      });
      const camp = result.campaigns[0];
      const zeroAlert = camp.alerts.find((a) => a.type === 'zero_conversions');
      expect(zeroAlert).toBeDefined();
      expect(zeroAlert!.severity).toBe('critical');
    });

    it('detects creative fatigue', () => {
      const result = analyze({
        campaigns: [
          {
            name: 'Social',
            channel: 'social_meta',
            spend: 8000,
            budget: 20000,
            days_elapsed: 15,
            days_total: 30,
            impressions: 500000,
            clicks: 2500, // CTR = 0.5%
            conversions: 50,
            revenue: 10000,
            cpa_target: 200,
            roas_target: 2,
            historical_ctr: 0.015, // Was 1.5%, now 0.5% = 66% decline
          },
        ],
      });
      const camp = result.campaigns[0];
      expect(camp.alerts.find((a) => a.type === 'creative_fatigue')).toBeDefined();
    });

    it('returns total alert counts', () => {
      const result = analyze({
        campaigns: [
          {
            name: 'Healthy',
            channel: 'search',
            spend: 5000,
            budget: 15000,
            days_elapsed: 10,
            days_total: 30,
            impressions: 100000,
            clicks: 5000,
            conversions: 100,
            revenue: 25000,
            cpa_target: 100,
            roas_target: 3,
            historical_ctr: 0.05,
          },
        ],
      });
      expect(result.total_alerts).toBeDefined();
      expect(typeof result.total_alerts.critical).toBe('number');
    });
  });

  describe('reallocate', () => {
    it('recommends shifting from worst to best ROAS', () => {
      const result = reallocate({
        campaigns: [
          { name: 'Search', spend: 50000, revenue: 200000 },
          { name: 'Display', spend: 50000, revenue: 25000 },
          { name: 'Social', spend: 50000, revenue: 100000 },
        ],
      });
      expect(result.performances[0].campaign).toBe('Search'); // Highest ROAS
      expect(result.recommendations).toHaveLength(1);
      expect(result.recommendations[0].to_campaign).toBe('Search');
      expect(result.recommendations[0].from_campaign).toBe('Display');
    });
  });
});
