// ─── Media Architect Benchmarks & Defaults ──────────────────────────

/** Hill curve defaults by channel for channel-optimizer */
export const CHANNEL_DEFAULTS: Record<
  string,
  { alpha: number; ec50_ratio: number; max_mult: number; decay: number }
> = {
  search: { alpha: 2.5, ec50_ratio: 0.4, max_mult: 6.0, decay: 0.1 },
  social_meta: { alpha: 1.8, ec50_ratio: 0.5, max_mult: 4.0, decay: 0.3 },
  social_tiktok: { alpha: 1.6, ec50_ratio: 0.45, max_mult: 3.5, decay: 0.25 },
  programmatic_display: { alpha: 1.2, ec50_ratio: 0.6, max_mult: 2.5, decay: 0.5 },
  programmatic_video: { alpha: 1.5, ec50_ratio: 0.55, max_mult: 3.0, decay: 0.6 },
  native: { alpha: 1.3, ec50_ratio: 0.5, max_mult: 2.0, decay: 0.4 },
  linkedin: { alpha: 1.4, ec50_ratio: 0.5, max_mult: 3.0, decay: 0.35 },
  tv: { alpha: 1.0, ec50_ratio: 0.7, max_mult: 2.0, decay: 0.85 },
  ooh: { alpha: 0.9, ec50_ratio: 0.6, max_mult: 1.5, decay: 0.7 },
  radio: { alpha: 1.1, ec50_ratio: 0.5, max_mult: 1.8, decay: 0.6 },
};

const DEFAULT_CHANNEL = { alpha: 1.5, ec50_ratio: 0.5, max_mult: 3.0, decay: 0.4 };

export function getChannelDefaults(name: string) {
  return CHANNEL_DEFAULTS[name] ?? DEFAULT_CHANNEL;
}

/** Mexico market benchmarks (base rates) by channel */
export const MEXICO_BENCHMARKS: Record<string, Record<string, number>> = {
  search: { cpc: 16.5, ctr: 5.75, cvr: 3.5 },
  social_display: { cpm: 165, cpc: 7.5, ctr: 1.65, cvr: 2.25 },
  social_video: { cpm: 235, cpc: 11.5, ctr: 2.0, cvr: 1.65 },
  social_tiktok: { cpm: 130, cpc: 6.0, ctr: 2.6, cvr: 1.25 },
  programmatic_display: { cpm: 95, cpc: 9.5, ctr: 0.19, cvr: 0.9 },
  programmatic_video: { cpm: 380, cpc: 19.0, ctr: 1.25, cvr: 1.25 },
  email: { cpm: 12.5, open_rate: 22.5, cvr: 3.0 },
  native: { cpm: 115, cpc: 7.5, ctr: 0.75, cvr: 1.25 },
  linkedin: { cpm: 400, cpc: 32.5, ctr: 0.7, cvr: 1.5 },
  amazon: { cpc: 12.5, ctr: 0.65, cvr: 10.0 },
};

/** Industry multipliers applied to base benchmarks */
export const INDUSTRY_MULTIPLIERS: Record<string, Record<string, number>> = {
  automotive: { cpm: 1.3, cpc: 1.4, cvr: 0.7 },
  fmcg: { cpm: 0.8, cpc: 0.7, cvr: 1.2 },
  financial: { cpm: 1.5, cpc: 1.6, cvr: 0.6 },
  retail: { cpm: 0.9, cpc: 0.8, cvr: 1.3 },
  telecom: { cpm: 1.1, cpc: 1.0, cvr: 0.9 },
};

export function getAdjustedBenchmark(
  channel: string,
  metric: string,
  industry: string,
): number | null {
  const base = MEXICO_BENCHMARKS[channel]?.[metric];
  if (base == null) return null;
  const multiplier = INDUSTRY_MULTIPLIERS[industry]?.[metric] ?? 1.0;
  return base * multiplier;
}

/** Platform spec sheets for media plan generation */
export const PLATFORM_SPECS: Record<string, Record<string, unknown>> = {
  google_ads: {
    search: { headline_chars: 30, description_chars: 90, headlines_max: 15 },
    display: {
      formats: ['300x250', '728x90', '160x600', '320x50'],
      max_file_kb: 150,
      file_types: ['jpg', 'png', 'gif', 'html5'],
    },
    video: {
      formats: ['16:9', '1:1', '9:16'],
      max_duration_sec: 180,
      max_file_mb: 256,
      file_types: ['mp4', 'mov'],
    },
  },
  meta: {
    feed: {
      image_ratio: '1:1',
      image_px: '1080x1080',
      headline_chars: 40,
      text_chars: 125,
      max_file_mb: 30,
    },
    stories: { image_ratio: '9:16', image_px: '1080x1920', max_duration_sec: 15 },
    reels: { video_ratio: '9:16', max_duration_sec: 90 },
  },
  dv360: {
    display: {
      formats: ['300x250', '728x90', '160x600', '970x250', '320x50'],
      max_file_kb: 200,
      file_types: ['jpg', 'png', 'html5'],
    },
    video: { formats: ['16:9'], max_duration_sec: 120, file_types: ['mp4'] },
  },
  tiktok: {
    in_feed: {
      video_ratio: '9:16',
      min_duration_sec: 5,
      max_duration_sec: 60,
      max_file_mb: 500,
    },
    topview: { video_ratio: '9:16', max_duration_sec: 60 },
  },
  amazon: {
    sponsored_products: { headline_chars: 50, image_px: '1000x1000' },
    dsp_display: { formats: ['300x250', '728x90', '160x600', '970x250'] },
  },
};
