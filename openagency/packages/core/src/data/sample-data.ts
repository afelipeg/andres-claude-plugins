// ─── Built-in Sample Datasets ───────────────────────────────────────
// Used for onboarding "try with demo data" flow

import type { WasteWaterfallInput, SupplyChainInput, QualityScoreInput } from '@openagency/types';

export const SAMPLE_WASTE_SMALL: WasteWaterfallInput = {
  gross_spend: 50_000,
  industry: 'retail',
  actual_revenue: 120_000,
  non_working: { agency_fees: 4_000, tech_fees: 2_000, data_costs: 1_000 },
  supply_chain: { dsp_fees: 2_500, ssp_fees: 1_500, hidden_margins: 500 },
  quality: { fraud: 2_000, non_viewable: 1_500, brand_unsafe: 500, mfa: 1_500 },
  audience: { off_target: 2_500, frequency_waste: 1_000, duplication: 500 },
  optimization: { poor_pacing: 1_000, stale_creative: 750, wrong_bids: 750 },
  measurement: { misattributed: 750, overcounted: 750 },
};

export const SAMPLE_WASTE_MEDIUM: WasteWaterfallInput = {
  gross_spend: 500_000,
  industry: 'retail',
  actual_revenue: 1_200_000,
  non_working: { agency_fees: 40_000, tech_fees: 20_000, data_costs: 10_000 },
  supply_chain: { dsp_fees: 25_000, ssp_fees: 15_000, hidden_margins: 5_000 },
  quality: { fraud: 20_000, non_viewable: 15_000, brand_unsafe: 5_000, mfa: 15_000 },
  audience: { off_target: 25_000, frequency_waste: 10_000, duplication: 5_000 },
  optimization: { poor_pacing: 10_000, stale_creative: 7_500, wrong_bids: 7_500 },
  measurement: { misattributed: 7_500, overcounted: 7_500 },
};

export const SAMPLE_WASTE_LARGE: WasteWaterfallInput = {
  gross_spend: 2_000_000,
  industry: 'retail',
  actual_revenue: 5_000_000,
  non_working: { agency_fees: 160_000, tech_fees: 80_000, data_costs: 40_000 },
  supply_chain: { dsp_fees: 100_000, ssp_fees: 60_000, hidden_margins: 20_000 },
  quality: { fraud: 80_000, non_viewable: 60_000, brand_unsafe: 20_000, mfa: 60_000 },
  audience: { off_target: 100_000, frequency_waste: 40_000, duplication: 20_000 },
  optimization: { poor_pacing: 40_000, stale_creative: 30_000, wrong_bids: 30_000 },
  measurement: { misattributed: 30_000, overcounted: 30_000 },
};

export const SAMPLE_SUPPLY_CHAIN: SupplyChainInput = {
  gross_spend: 500_000,
  channels: [
    {
      name: 'programmatic_display',
      spend: 200_000,
      publisher_cpm: 4.50,
      intermediaries: [
        { name: 'DV360', type: 'dsp', buying_model: 'transparent', disclosed_fee_pct: 12 },
        { name: 'SSP Partner', type: 'ssp', buying_model: 'transparent', disclosed_fee_pct: 10 },
        { name: 'IAS', type: 'verification', buying_model: 'transparent', disclosed_fee_pct: 3 },
      ],
    },
    {
      name: 'social_meta',
      spend: 200_000,
      intermediaries: [
        { name: 'Meta Ads', type: 'platform', buying_model: 'transparent', disclosed_fee_pct: 0 },
      ],
    },
    {
      name: 'programmatic_video',
      spend: 100_000,
      publisher_cpm: 18.00,
      intermediaries: [
        { name: 'TTD', type: 'dsp', buying_model: 'transparent', disclosed_fee_pct: 15 },
        { name: 'Reseller X', type: 'reseller', buying_model: 'reseller', disclosed_fee_pct: 8 },
      ],
    },
  ],
};

export const SAMPLE_QUALITY: QualityScoreInput = {
  channels: [
    { name: 'programmatic_display', spend: 200_000, ivt_rate_pct: 12, viewability_pct: 48, mfa_rate_pct: 18 },
    { name: 'programmatic_video', spend: 100_000, ivt_rate_pct: 6, viewability_pct: 62, mfa_rate_pct: 5 },
    { name: 'social_meta', spend: 200_000, ivt_rate_pct: 2, viewability_pct: 78, mfa_rate_pct: 1 },
  ],
};

export const ALL_SAMPLES = {
  waste_small: SAMPLE_WASTE_SMALL,
  waste_medium: SAMPLE_WASTE_MEDIUM,
  waste_large: SAMPLE_WASTE_LARGE,
  supply_chain: SAMPLE_SUPPLY_CHAIN,
  quality: SAMPLE_QUALITY,
} as const;
