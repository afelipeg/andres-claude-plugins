import { describe, it, expect } from 'vitest';
import { preModel, model, postModel, optimize } from '../mmm-scenario-planner.js';

describe('mmm-scenario-planner', () => {
  describe('preModel', () => {
    it('returns READY for sufficient data', () => {
      const result = preModel({
        channels: [
          { name: 'search' },
          { name: 'social_meta' },
          { name: 'programmatic_display' },
        ],
        time_periods: 104,
        geos: 3,
        kpi: 'revenue',
        has_control_variables: true,
        has_gqv: false,
      });
      expect(result.status).toBe('READY');
      expect(result.data_readiness_score).toBeGreaterThanOrEqual(70);
      expect(result.next_step).toBe('model');
    });

    it('returns INSUFFICIENT for very limited data', () => {
      const result = preModel({
        channels: [{ name: 'search' }],
        time_periods: 10,
        geos: 1,
        kpi: 'revenue',
        has_control_variables: false,
        has_gqv: false,
      });
      expect(result.status).toBe('INSUFFICIENT');
      expect(result.next_step).toBe('collect_more_data');
    });

    it('flags channel-level issues', () => {
      const result = preModel({
        channels: [
          { name: 'search', weeks_active: 10, spend_cv: 0.05 },
          { name: 'social_meta', weeks_active: 80, has_roi_prior: true },
          { name: 'programmatic_display' },
        ],
        time_periods: 80,
        geos: 1,
        kpi: 'revenue',
        has_control_variables: false,
        has_gqv: false,
      });
      const searchAssessment = result.channel_assessments.find((c) => c.channel === 'search')!;
      expect(searchAssessment.issues.length).toBeGreaterThan(0);
      expect(searchAssessment.readiness_score).toBeLessThan(100);
    });
  });

  describe('model', () => {
    it('fits channel models with contributions', () => {
      const result = model({
        total_budget: 1000000,
        total_kpi: 5000000,
        channels: [
          { name: 'search', spend: 400000 },
          { name: 'social_meta', spend: 350000 },
          { name: 'programmatic_display', spend: 250000 },
        ],
        time_periods: 52,
      });
      if ('error' in result) throw new Error(result.error);

      expect(result.phase).toBe('model');
      expect(result.channel_models).toHaveLength(3);
      expect(result.media_contribution).toBeGreaterThan(0);
      expect(result.overall_roi).toBeGreaterThan(0);

      // Contribution shares should sum to ~100%
      const totalSharePct = result.channel_models.reduce(
        (s, cm) => s + cm.results.contribution_share_pct,
        0,
      );
      expect(totalSharePct).toBeGreaterThan(99);
      expect(totalSharePct).toBeLessThanOrEqual(100.5);
    });

    it('returns error for zero budget', () => {
      const result = model({
        total_budget: 0,
        total_kpi: 1000,
        channels: [{ name: 'search', spend: 0 }],
        time_periods: 52,
      });
      expect('error' in result).toBe(true);
    });

    it('uses roi_prior when provided', () => {
      const withoutPrior = model({
        total_budget: 100000,
        total_kpi: 500000,
        channels: [{ name: 'search', spend: 100000 }],
        time_periods: 52,
      });
      const withPrior = model({
        total_budget: 100000,
        total_kpi: 500000,
        channels: [{ name: 'search', spend: 100000, roi_prior: 5.0 }],
        time_periods: 52,
      });
      if ('error' in withoutPrior || 'error' in withPrior) throw new Error('unexpected error');
      // ROI prior changes max_response which changes contribution
      expect(withPrior.channel_models[0].parameters.max_response).not.toBe(
        withoutPrior.channel_models[0].parameters.max_response,
      );
    });
  });

  describe('postModel', () => {
    it('flags good model health', () => {
      const result = postModel({
        model_results: {
          phase: 'model',
          model_type: 'test',
          methodology: 'test',
          total_budget: 1000000,
          total_kpi: 5000000,
          predicted_kpi: 4800000,
          base_contribution: 2000000,
          media_contribution: 2800000,
          media_contribution_pct: 58.3,
          overall_roi: 2.8,
          r_squared_estimate: 0.9,
          channel_models: [
            {
              channel: 'search',
              spend: 500000,
              spend_share_pct: 50,
              parameters: { alpha: 2.5, ec50: 200000, max_response: 3000000, decay_rate: 0.1, adstock_half_life_weeks: 0.3 },
              results: { estimated_contribution: 1400000, contribution_share_pct: 50, roi: 2.8, marginal_roi: 1.2, saturation_pct: 46.7 },
            },
          ],
          response_curves: [
            { channel: 'search', current_spend: 500000, current_response: 1400000, points: [{ spend: 0, response: 0 }, { spend: 500000, response: 1400000 }] },
          ],
          model_fit: { periods: ['W1', 'W2'], actual: [100000, 110000], predicted: [99000, 108000] },
          roi_intervals: [
            { channel: 'search', roi: 2.8, lower_ci: 2.24, upper_ci: 3.36, mroi: 1.2, mroi_lower_ci: 0.9, mroi_upper_ci: 1.5 },
          ],
          contribution_waterfall: [
            { channel: 'Base (Non-Media)', contribution: 2000000, contribution_pct: 41.7 },
            { channel: 'search', contribution: 1400000, contribution_pct: 50 },
          ],
          next_step: 'post_model',
        },
      });
      expect(result.model_health).toBe('good');
      expect(result.next_step).toBe('optimize');
    });
  });

  describe('optimize', () => {
    it('optimizes across scenarios', () => {
      const result = optimize({
        total_budget: 500000,
        channels: [
          { name: 'search', spend: 250000 },
          { name: 'social_meta', spend: 150000 },
          { name: 'programmatic_display', spend: 100000 },
        ],
      });
      if ('error' in result) throw new Error(result.error);

      expect(result.phase).toBe('scenario_planning');
      expect(result.scenarios['current']).toBeDefined();
      expect(result.scenarios['optimized']).toBeDefined();
      expect(result.comparison_vs_current).toBeDefined();
    });

    it('optimized has equal or better ROI than current', () => {
      const result = optimize({
        total_budget: 500000,
        channels: [
          { name: 'search', spend: 250000 },
          { name: 'social_meta', spend: 150000 },
          { name: 'programmatic_display', spend: 100000 },
        ],
      });
      if ('error' in result) throw new Error(result.error);

      const currentRoi = result.scenarios['current'].overall_roi;
      const optimizedRoi = result.scenarios['optimized'].overall_roi;
      expect(optimizedRoi).toBeGreaterThanOrEqual(currentRoi);
    });

    it('returns error for zero budget', () => {
      const result = optimize({
        total_budget: 0,
        channels: [{ name: 'search', spend: 0 }],
      });
      expect('error' in result).toBe(true);
    });
  });
});
