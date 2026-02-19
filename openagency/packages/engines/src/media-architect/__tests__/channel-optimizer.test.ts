import { describe, it, expect } from 'vitest';
import { optimize, scenarioAnalysis } from '../channel-optimizer.js';

describe('channel-optimizer', () => {
  const baseInput = {
    total_budget: 500000,
    channels: [
      { name: 'search', spend: 200000 },
      { name: 'social_meta', spend: 150000 },
      { name: 'programmatic_display', spend: 100000 },
      { name: 'native', spend: 50000 },
    ],
  };

  it('allocates total budget to channels', () => {
    const result = optimize(baseInput);
    const totalAllocated = result.channels.reduce((s, c) => s + c.spend, 0);
    // Total allocated should be approximately equal to total budget
    expect(Math.abs(totalAllocated - result.total_budget)).toBeLessThan(baseInput.total_budget / 100 + 1);
  });

  it('produces non-negative response for each channel', () => {
    const result = optimize(baseInput);
    const totalResponse = result.channels.reduce((s, c) => s + c.expected_response, 0);
    expect(totalResponse).toBeGreaterThan(0);
    for (const ch of result.channels) {
      expect(ch.expected_response).toBeGreaterThanOrEqual(0);
      expect(ch.spend).toBeGreaterThanOrEqual(0);
      expect(ch.saturation_pct).toBeGreaterThanOrEqual(0);
      expect(ch.saturation_pct).toBeLessThanOrEqual(100);
    }
  });

  it('respects min_spend constraints', () => {
    const input = {
      total_budget: 200000,
      channels: [
        { name: 'search', spend: 100000, min_spend: 50000 },
        { name: 'social_meta', spend: 100000, min_spend: 30000 },
      ],
    };
    const result = optimize(input);
    const search = result.channels.find((c) => c.channel === 'search')!;
    const social = result.channels.find((c) => c.channel === 'social_meta')!;
    expect(search.spend).toBeGreaterThanOrEqual(50000);
    expect(social.spend).toBeGreaterThanOrEqual(30000);
  });

  it('respects max_spend constraints', () => {
    const input = {
      total_budget: 500000,
      channels: [
        { name: 'search', spend: 200000, max_spend: 100000 },
        { name: 'social_meta', spend: 150000 },
      ],
    };
    const result = optimize(input);
    const search = result.channels.find((c) => c.channel === 'search')!;
    expect(search.spend).toBeLessThanOrEqual(100000 + input.total_budget / 100);
  });

  it('returns spend_pct that sums roughly to 100%', () => {
    const result = optimize(baseInput);
    const totalPct = result.channels.reduce((s, c) => s + c.spend_pct, 0);
    expect(totalPct).toBeGreaterThan(95);
    expect(totalPct).toBeLessThanOrEqual(100.5);
  });

  it('sorts channels by spend descending', () => {
    const result = optimize(baseInput);
    for (let i = 1; i < result.channels.length; i++) {
      expect(result.channels[i - 1].spend).toBeGreaterThanOrEqual(result.channels[i].spend);
    }
  });

  describe('scenarioAnalysis', () => {
    it('runs multiple budget scenarios', () => {
      const result = scenarioAnalysis({
        total_budget: 500000,
        channels: baseInput.channels,
      });
      expect(result.scenarios).toHaveLength(4);
      expect(result.scenarios[0].label).toBe('-20%');
      expect(result.scenarios[1].label).toBe('Current');
      expect(result.scenarios[0].budget).toBeLessThan(result.scenarios[1].budget);
      expect(result.scenarios[2].budget).toBeGreaterThan(result.scenarios[1].budget);
    });

    it('higher budget produces higher or equal response', () => {
      const result = scenarioAnalysis({
        total_budget: 500000,
        channels: baseInput.channels,
      });
      for (let i = 1; i < result.scenarios.length; i++) {
        expect(result.scenarios[i].result.total_expected_response).toBeGreaterThanOrEqual(
          result.scenarios[i - 1].result.total_expected_response,
        );
      }
    });
  });
});
