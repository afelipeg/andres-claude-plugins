// ─── Platform CSV Auto-Detection ─────────────────────────────────────
// Detects advertising platform from CSV column headers and maps
// columns to OpenAgency engine input formats.

export type AdPlatform = 'google_ads' | 'meta_ads' | 'tiktok_ads' | 'generic';

export interface PlatformMapping {
  platform: AdPlatform;
  confidence: number;
  columnMap: ColumnMap;
}

export interface ColumnMap {
  campaign?: string;
  adGroup?: string;
  spend?: string;
  impressions?: string;
  clicks?: string;
  conversions?: string;
  revenue?: string;
  ctr?: string;
  cpc?: string;
  cpa?: string;
  roas?: string;
}

// ─── Signature patterns per platform ────────────────────────────────

const GOOGLE_ADS_SIGNATURES: Record<string, string[]> = {
  campaign: ['Campaign', 'campaign.name', 'Campaign name'],
  adGroup: ['Ad group', 'ad_group.name', 'Ad Group'],
  spend: ['Cost', 'cost_micros', 'metrics.cost_micros'],
  impressions: ['Impr.', 'Impressions', 'metrics.impressions'],
  clicks: ['Clicks', 'metrics.clicks'],
  conversions: ['Conversions', 'metrics.conversions', 'Conv.'],
  revenue: ['Conv. value', 'metrics.conversions_value', 'Conversion value', 'metrics.conversion_value'],
  ctr: ['CTR', 'metrics.ctr'],
  cpc: ['Avg. CPC', 'metrics.average_cpc'],
  cpa: ['Cost / conv.', 'metrics.cost_per_conversion'],
  roas: ['Conv. value / cost', 'metrics.value_per_conversion'],
};

const META_ADS_SIGNATURES: Record<string, string[]> = {
  campaign: ['Campaign Name', 'Campaign name', 'campaign_name'],
  adGroup: ['Ad Set Name', 'Ad set name', 'adset_name'],
  spend: ['Amount Spent', 'Amount spent', 'spend', 'Spend'],
  impressions: ['Impressions', 'impressions'],
  clicks: ['Clicks (all)', 'Link Clicks', 'clicks', 'website_clicks'],
  conversions: ['Results', 'results', 'actions', 'Purchases'],
  revenue: ['Purchase ROAS', 'Conversion Value', 'action_values', 'Website Purchase ROAS'],
  ctr: ['CTR (all)', 'CTR (link click-through rate)', 'ctr'],
  cpc: ['CPC (all)', 'CPC (cost per link click)', 'cpc', 'Cost per Click'],
  cpa: ['Cost per Result', 'Cost per result', 'cost_per_action_type'],
  roas: ['Purchase ROAS', 'Website Purchase ROAS'],
};

const TIKTOK_ADS_SIGNATURES: Record<string, string[]> = {
  campaign: ['Campaign Name', 'Campaign', 'Campaign name'],
  adGroup: ['Ad Group Name', 'Ad Group', 'Ad group name'],
  spend: ['Spend', 'Cost', 'Total Cost'],
  impressions: ['Impressions', 'Impression'],
  clicks: ['Clicks', 'Click'],
  conversions: ['Conversions', 'Result', 'Results', 'Total Complete Payment'],
  revenue: ['Conversion Value', 'Total Complete Payment Value', 'Value'],
  ctr: ['CTR', 'CTR (%)'],
  cpc: ['CPC', 'CPC (Cost Per Click)'],
  cpa: ['CPA', 'Cost Per Conversion', 'Cost Per Result'],
  roas: ['ROAS', 'ROAS (%)'],
};

// ─── Unique discriminators ──────────────────────────────────────────
// Headers that strongly indicate a specific platform

const GOOGLE_UNIQUE = ['Impr.', 'cost_micros', 'metrics.cost_micros', 'campaign.name', 'Conv. value', 'Avg. CPC', 'Cost / conv.', 'Conv. value / cost'];
const META_UNIQUE = ['Amount Spent', 'Amount spent', 'Clicks (all)', 'CTR (all)', 'CPC (all)', 'Ad Set Name', 'Link Clicks', 'Cost per Result', 'Reach', 'Frequency'];
const TIKTOK_UNIQUE = ['CVR', 'CVR (%)', 'Total Complete Payment', 'Video Views', '6-Second Video Views', 'Paid Likes', 'Paid Shares'];

/**
 * Detect which advertising platform a CSV export came from.
 * Returns the platform, confidence score (0-1), and column mapping.
 */
export function detectPlatform(columns: string[]): PlatformMapping {
  const colSet = new Set(columns);
  const colLower = new Set(columns.map((c) => c.toLowerCase().trim()));

  // Score each platform by unique header matches
  const googleScore = scoreUnique(colSet, GOOGLE_UNIQUE);
  const metaScore = scoreUnique(colSet, META_UNIQUE);
  const tiktokScore = scoreUnique(colSet, TIKTOK_UNIQUE);

  const maxScore = Math.max(googleScore, metaScore, tiktokScore);

  if (maxScore === 0) {
    return {
      platform: 'generic',
      confidence: 0,
      columnMap: buildGenericMap(columns, colLower),
    };
  }

  if (googleScore === maxScore && googleScore > metaScore && googleScore > tiktokScore) {
    return {
      platform: 'google_ads',
      confidence: Math.min(googleScore / 3, 1),
      columnMap: buildMap(columns, GOOGLE_ADS_SIGNATURES),
    };
  }

  if (metaScore === maxScore && metaScore > tiktokScore) {
    return {
      platform: 'meta_ads',
      confidence: Math.min(metaScore / 3, 1),
      columnMap: buildMap(columns, META_ADS_SIGNATURES),
    };
  }

  return {
    platform: 'tiktok_ads',
    confidence: Math.min(tiktokScore / 3, 1),
    columnMap: buildMap(columns, TIKTOK_ADS_SIGNATURES),
  };
}

function scoreUnique(columns: Set<string>, unique: string[]): number {
  let score = 0;
  for (const u of unique) {
    if (columns.has(u)) score++;
  }
  return score;
}

function buildMap(
  columns: string[],
  signatures: Record<string, string[]>,
): ColumnMap {
  const map: ColumnMap = {};
  for (const [field, candidates] of Object.entries(signatures)) {
    for (const candidate of candidates) {
      if (columns.includes(candidate)) {
        (map as Record<string, string>)[field] = candidate;
        break;
      }
    }
  }
  return map;
}

function buildGenericMap(columns: string[], colLower: Set<string>): ColumnMap {
  const map: ColumnMap = {};
  const find = (needles: string[]): string | undefined => {
    for (const n of needles) {
      for (const c of columns) {
        if (c.toLowerCase().trim() === n) return c;
      }
    }
    return undefined;
  };

  map.campaign = find(['campaign', 'campaign name', 'campaign_name']);
  map.spend = find(['spend', 'cost', 'amount spent', 'amount_spent']);
  map.impressions = find(['impressions', 'impr.', 'impr']);
  map.clicks = find(['clicks', 'click']);
  map.conversions = find(['conversions', 'conv.', 'results', 'result']);
  map.revenue = find(['revenue', 'conversion value', 'conv. value', 'value']);
  map.ctr = find(['ctr', 'ctr (%)']);
  map.cpc = find(['cpc', 'avg. cpc', 'cost per click']);
  map.cpa = find(['cpa', 'cost per conversion', 'cost / conv.', 'cost per result']);
  map.roas = find(['roas', 'roas (%)', 'return on ad spend']);

  // Check if we found enough to be useful
  if (colLower.size > 0 && (map.campaign ?? map.spend)) {
    return map;
  }
  return map;
}

// ─── Transform CSV rows to engine inputs ────────────────────────────

export interface TransformOptions {
  platform: AdPlatform;
  columnMap: ColumnMap;
}

/**
 * Clean a numeric value: strip currency symbols, commas, percentage signs.
 * Handles Google Ads cost_micros (divide by 1,000,000).
 */
function cleanNumber(val: unknown, isMicros = false): number {
  if (typeof val === 'number') return isMicros ? val / 1_000_000 : val;
  if (typeof val !== 'string') return 0;
  const cleaned = val.replace(/[$€£¥,\s%]/g, '').trim();
  if (cleaned === '' || cleaned === '--' || cleaned === 'N/A') return 0;
  const num = Number(cleaned);
  if (isNaN(num)) return 0;
  return isMicros ? num / 1_000_000 : num;
}

/**
 * Transform parsed CSV rows into a waste waterfall input for the Leak Detector.
 * Aggregates spend across all campaigns/rows.
 */
export function toWasteInput(
  rows: Record<string, unknown>[],
  opts: TransformOptions,
): { gross_spend: number; industry: string; actual_revenue?: number } {
  const isMicros = opts.platform === 'google_ads' && (opts.columnMap.spend === 'cost_micros' || opts.columnMap.spend === 'metrics.cost_micros');

  let totalSpend = 0;
  let totalRevenue = 0;

  for (const row of rows) {
    if (opts.columnMap.spend) {
      totalSpend += cleanNumber(row[opts.columnMap.spend], isMicros);
    }
    if (opts.columnMap.revenue) {
      totalRevenue += cleanNumber(row[opts.columnMap.revenue], isMicros);
    }
  }

  return {
    gross_spend: Math.round(totalSpend * 100) / 100,
    industry: 'retail',
    ...(totalRevenue > 0 ? { actual_revenue: Math.round(totalRevenue * 100) / 100 } : {}),
  };
}

/**
 * Transform parsed CSV rows into channel optimizer input for Media Architect.
 * Each row becomes a channel.
 */
export function toChannelInput(
  rows: Record<string, unknown>[],
  opts: TransformOptions,
): { total_budget: number; channels: Array<{ name: string; spend: number }> } {
  const isMicros = opts.platform === 'google_ads' && (opts.columnMap.spend === 'cost_micros' || opts.columnMap.spend === 'metrics.cost_micros');

  const channels: Array<{ name: string; spend: number }> = [];
  let total = 0;

  for (const row of rows) {
    const name = opts.columnMap.campaign
      ? String(row[opts.columnMap.campaign] ?? 'Unknown')
      : 'Unknown';
    const spend = opts.columnMap.spend
      ? cleanNumber(row[opts.columnMap.spend], isMicros)
      : 0;
    channels.push({ name, spend });
    total += spend;
  }

  return {
    total_budget: Math.round(total * 100) / 100,
    channels,
  };
}

/**
 * Transform parsed CSV rows into optimization input for Campaign Ops.
 */
export function toOptimizationInput(
  rows: Record<string, unknown>[],
  opts: TransformOptions,
): { campaigns: Array<Record<string, unknown>> } {
  const isMicros = opts.platform === 'google_ads' && (opts.columnMap.spend === 'cost_micros' || opts.columnMap.spend === 'metrics.cost_micros');

  const campaigns = rows.map((row) => ({
    name: opts.columnMap.campaign ? String(row[opts.columnMap.campaign] ?? 'Unknown') : 'Unknown',
    channel: opts.platform,
    spend: opts.columnMap.spend ? cleanNumber(row[opts.columnMap.spend], isMicros) : 0,
    budget: opts.columnMap.spend ? cleanNumber(row[opts.columnMap.spend], isMicros) * 1.2 : 0,
    days_elapsed: 15,
    days_total: 30,
    impressions: opts.columnMap.impressions ? cleanNumber(row[opts.columnMap.impressions]) : 0,
    clicks: opts.columnMap.clicks ? cleanNumber(row[opts.columnMap.clicks]) : 0,
    conversions: opts.columnMap.conversions ? cleanNumber(row[opts.columnMap.conversions]) : 0,
    revenue: opts.columnMap.revenue ? cleanNumber(row[opts.columnMap.revenue], isMicros) : 0,
    cpa_target: 100,
    roas_target: 3.0,
    historical_ctr: opts.columnMap.ctr ? cleanNumber(row[opts.columnMap.ctr]) : 2.0,
  }));

  return { campaigns };
}

/**
 * Transform parsed CSV rows into MMM model input for Media Architect.
 * Aggregates by campaign name, computes ROI priors from revenue/spend.
 */
export function toMMMInput(
  rows: Record<string, unknown>[],
  opts: TransformOptions,
): {
  total_budget: number;
  total_kpi: number;
  time_periods: number;
  channels: Array<{
    name: string;
    spend: number;
    roi_prior?: number;
  }>;
} {
  const isMicros = opts.platform === 'google_ads' && (opts.columnMap.spend === 'cost_micros' || opts.columnMap.spend === 'metrics.cost_micros');

  // Aggregate by campaign name
  const channelMap = new Map<string, { spend: number; revenue: number; conversions: number }>();

  for (const row of rows) {
    const name = opts.columnMap.campaign
      ? String(row[opts.columnMap.campaign] ?? 'Unknown')
      : 'Unknown';
    const spend = opts.columnMap.spend ? cleanNumber(row[opts.columnMap.spend], isMicros) : 0;
    const revenue = opts.columnMap.revenue ? cleanNumber(row[opts.columnMap.revenue], isMicros) : 0;
    const conversions = opts.columnMap.conversions ? cleanNumber(row[opts.columnMap.conversions]) : 0;

    const existing = channelMap.get(name) ?? { spend: 0, revenue: 0, conversions: 0 };
    existing.spend += spend;
    existing.revenue += revenue;
    existing.conversions += conversions;
    channelMap.set(name, existing);
  }

  let totalBudget = 0;
  let totalKpi = 0;
  const channels: Array<{ name: string; spend: number; roi_prior?: number }> = [];

  for (const [name, agg] of channelMap.entries()) {
    totalBudget += agg.spend;
    totalKpi += agg.revenue > 0 ? agg.revenue : agg.conversions * 100; // estimate $100 AOV if no revenue
    const roiPrior = agg.spend > 0 && agg.revenue > 0 ? agg.revenue / agg.spend : undefined;
    channels.push({
      name,
      spend: Math.round(agg.spend * 100) / 100,
      ...(roiPrior != null ? { roi_prior: Math.round(roiPrior * 100) / 100 } : {}),
    });
  }

  return {
    total_budget: Math.round(totalBudget * 100) / 100,
    total_kpi: Math.round(totalKpi * 100) / 100,
    time_periods: 52, // default to 1 year; CSV doesn't tell us time range
    channels,
  };
}

/**
 * Transform parsed CSV rows into revenue bridge input for Executive Bridge.
 */
export function toRevenueBridgeInput(
  rows: Record<string, unknown>[],
  opts: TransformOptions,
): {
  channels: Array<{
    name: string;
    spend: number;
    impressions: number;
    clicks: number;
    conversions: number;
    revenue?: number;
  }>;
} {
  const isMicros = opts.platform === 'google_ads' && (opts.columnMap.spend === 'cost_micros' || opts.columnMap.spend === 'metrics.cost_micros');

  const channels = rows.map((row) => ({
    name: opts.columnMap.campaign ? String(row[opts.columnMap.campaign] ?? 'Unknown') : 'Unknown',
    spend: opts.columnMap.spend ? cleanNumber(row[opts.columnMap.spend], isMicros) : 0,
    impressions: opts.columnMap.impressions ? cleanNumber(row[opts.columnMap.impressions]) : 0,
    clicks: opts.columnMap.clicks ? cleanNumber(row[opts.columnMap.clicks]) : 0,
    conversions: opts.columnMap.conversions ? cleanNumber(row[opts.columnMap.conversions]) : 0,
    ...(opts.columnMap.revenue
      ? { revenue: cleanNumber(row[opts.columnMap.revenue], isMicros) }
      : {}),
  }));

  return { channels };
}
