// ─── TikTok Ads Connector ───────────────────────────────────────────
// Marketing API v1.3. JSON body auth (not form-encoded).
// Multi-level: campaign → ad group → ad. Extended metrics: video views,
// video completion rates, reach, frequency, conversions, revenue.

import type {
  PlatformConnector,
  OAuthTokens,
  PlatformCredentials,
  NormalizedCampaignRow,
  PlatformAccount,
  FetchOptions,
  DataLevel,
} from '@openagency/types';
import { RateLimiter, PLATFORM_RATE_LIMITS } from '../../utils/rate-limiter.js';
import { withRetry } from '../../utils/retry.js';

const BASE_URL = 'https://business-api.tiktok.com/open_api/v1.3';
const AUTH_URL = 'https://business-api.tiktok.com/portal/auth';
const TOKEN_URL = `${BASE_URL}/oauth2/access_token/`;

// TikTok API data_level per our DataLevel
const TIKTOK_DATA_LEVEL: Record<DataLevel, string> = {
  campaign: 'AUCTION_CAMPAIGN',
  ad_set: 'AUCTION_ADGROUP',
  ad: 'AUCTION_AD',
};

// Dimensions per level
const TIKTOK_DIMENSIONS: Record<DataLevel, string[]> = {
  campaign: ['campaign_id', 'stat_time_day'],
  ad_set: ['campaign_id', 'adgroup_id', 'stat_time_day'],
  ad: ['campaign_id', 'adgroup_id', 'ad_id', 'stat_time_day'],
};

// Full set of metrics — covers all levels
const TIKTOK_METRICS = [
  'campaign_name',
  'adgroup_name',
  'ad_name',
  'spend',
  'impressions',
  'clicks',
  'conversion',
  'complete_payment',
  'total_purchase_value',
  'ctr',
  'cpc',
  'cost_per_conversion',
  'reach',
  'frequency',
  'video_play_actions',
  'video_watched_2s',
  'video_watched_6s',
  'video_views_p25',
  'video_views_p50',
  'video_views_p75',
  'video_views_p100',
  'profile_visits_rate',
  'likes',
  'shares',
  'comments',
];

export interface TikTokAdsConnectorConfig {
  appId: string;
  secret: string;
}

export class TikTokAdsConnector implements PlatformConnector {
  readonly platform = 'tiktok_ads' as const;
  private limiter = new RateLimiter(PLATFORM_RATE_LIMITS.tiktok_ads);

  constructor(private config: TikTokAdsConnectorConfig) {}

  getAuthUrl(redirectUri: string, state?: string): string {
    const params = new URLSearchParams({
      app_id: this.config.appId,
      redirect_uri: redirectUri,
      ...(state ? { state } : {}),
    });
    return `${AUTH_URL}?${params.toString()}`;
  }

  async exchangeCode(code: string, _redirectUri: string): Promise<OAuthTokens> {
    const res = await fetch(TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        app_id: this.config.appId,
        secret: this.config.secret,
        auth_code: code,
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`TikTok Ads token exchange failed (${res.status}): ${err}`);
    }

    const data = (await res.json()) as {
      code: number;
      message: string;
      data: {
        access_token: string;
        advertiser_ids: string[];
        scope: number;
      };
    };

    if (data.code !== 0) {
      throw new Error(`TikTok Ads OAuth error: ${data.message}`);
    }

    return {
      access_token: data.data.access_token,
      token_type: 'bearer',
      // TikTok Ads access tokens don't expire in the traditional sense
      expires_at: Date.now() + 86_400_000 * 365, // effectively permanent
      scope: String(data.data.scope),
    };
  }

  async refreshTokens(tokens: OAuthTokens): Promise<OAuthTokens> {
    // TikTok Ads tokens are long-lived, no refresh needed
    return tokens;
  }

  isTokenValid(tokens: OAuthTokens): boolean {
    return tokens.expires_at > Date.now();
  }

  async listAccounts(tokens: OAuthTokens): Promise<PlatformAccount[]> {
    await this.limiter.acquire();

    const params = new URLSearchParams({
      app_id: this.config.appId,
      secret: this.config.secret,
    });

    const res = await withRetry(() =>
      fetch(`${BASE_URL}/oauth2/advertiser/get/?${params.toString()}`, {
        headers: { 'Access-Token': tokens.access_token },
      }),
    );

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`TikTok Ads API error listing advertisers (${res.status}): ${err}`);
    }

    const data = (await res.json()) as {
      code: number;
      data: {
        list: Array<{
          advertiser_id: string;
          advertiser_name: string;
        }>;
      };
    };

    return (data.data.list ?? []).map((a) => ({
      id: a.advertiser_id,
      name: a.advertiser_name,
    }));
  }

  async fetchCampaigns(
    credentials: PlatformCredentials,
    dateRange: { start: string; end: string },
    options?: FetchOptions,
  ): Promise<NormalizedCampaignRow[]> {
    const advertiserId = credentials.account_id;
    if (!advertiserId) throw new Error('TikTok Ads advertiser_id required');

    const level = options?.level ?? 'campaign';
    const rows: NormalizedCampaignRow[] = [];
    let page = 1;
    const pageSize = 500;
    let hasMore = true;

    while (hasMore) {
      await this.limiter.acquire();

      const params = new URLSearchParams({
        advertiser_id: advertiserId,
        report_type: 'BASIC',
        data_level: TIKTOK_DATA_LEVEL[level],
        dimensions: JSON.stringify(TIKTOK_DIMENSIONS[level]),
        metrics: JSON.stringify(TIKTOK_METRICS),
        start_date: dateRange.start.replace(/-/g, ''),
        end_date: dateRange.end.replace(/-/g, ''),
        page: String(page),
        page_size: String(pageSize),
      });

      const res = await withRetry(() =>
        fetch(`${BASE_URL}/report/integrated/get/?${params.toString()}`, {
          headers: { 'Access-Token': credentials.tokens.access_token },
        }),
      );

      if (!res.ok) {
        const err = await res.text();
        throw new Error(`TikTok Ads Insights API error (${res.status}): ${err}`);
      }

      const data = (await res.json()) as {
        code: number;
        message: string;
        data: {
          list: TikTokReportRow[];
          page_info: { total_number: number; page: number; page_size: number; total_page: number };
        };
      };

      if (data.code !== 0) {
        throw new Error(`TikTok Ads report error: ${data.message}`);
      }

      for (const row of data.data.list ?? []) {
        rows.push(normalizeTikTokRow(row, level));
      }

      const pageInfo = data.data.page_info;
      hasMore = page < pageInfo.total_page;
      page++;
    }

    return rows;
  }
}

interface TikTokReportRow {
  dimensions: {
    campaign_id: string;
    adgroup_id?: string;
    ad_id?: string;
    stat_time_day: string;
  };
  metrics: {
    campaign_name?: string;
    adgroup_name?: string;
    ad_name?: string;
    spend: string;
    impressions: string;
    clicks: string;
    conversion: string;
    complete_payment: string;
    total_purchase_value: string;
    ctr: string;
    cpc: string;
    cost_per_conversion: string;
    reach?: string;
    frequency?: string;
    video_play_actions?: string;
    video_watched_2s?: string;
    video_watched_6s?: string;
    video_views_p25?: string;
    video_views_p50?: string;
    video_views_p75?: string;
    video_views_p100?: string;
    profile_visits_rate?: string;
    likes?: string;
    shares?: string;
    comments?: string;
  };
}

function normalizeTikTokRow(row: TikTokReportRow, level: DataLevel): NormalizedCampaignRow {
  const spend = parseFloat(row.metrics.spend) || 0;
  const impressions = parseInt(row.metrics.impressions) || 0;
  const clicks = parseInt(row.metrics.clicks) || 0;
  const conversions = parseFloat(row.metrics.complete_payment || row.metrics.conversion) || 0;
  const revenue = parseFloat(row.metrics.total_purchase_value) || 0;
  const ctr = impressions > 0 ? clicks / impressions : 0; // fraction
  const cpc = parseFloat(row.metrics.cpc) || (clicks > 0 ? spend / clicks : 0);
  const cpa = parseFloat(row.metrics.cost_per_conversion) || (conversions > 0 ? spend / conversions : 0);
  const roas = spend > 0 ? revenue / spend : 0;

  // TikTok date format: YYYYMMDD → YYYY-MM-DD
  const raw = row.dimensions.stat_time_day;
  const date = raw.length === 8
    ? `${raw.slice(0, 4)}-${raw.slice(4, 6)}-${raw.slice(6, 8)}`
    : raw;

  // Extended metrics
  const reachVal = row.metrics.reach ? parseInt(row.metrics.reach) : undefined;
  const freqVal = row.metrics.frequency ? parseFloat(row.metrics.frequency) : undefined;
  const videoPlays = row.metrics.video_play_actions ? parseInt(row.metrics.video_play_actions) : undefined;
  const videoP25 = row.metrics.video_views_p25 ? parseInt(row.metrics.video_views_p25) : undefined;
  const videoP50 = row.metrics.video_views_p50 ? parseInt(row.metrics.video_views_p50) : undefined;
  const videoP75 = row.metrics.video_views_p75 ? parseInt(row.metrics.video_views_p75) : undefined;
  const videoP100 = row.metrics.video_views_p100 ? parseInt(row.metrics.video_views_p100) : undefined;
  const videoViewRate = videoPlays && impressions > 0 ? videoPlays / impressions : undefined;
  const conversionRate = clicks > 0 ? conversions / clicks : undefined;

  return {
    campaign_name: row.metrics.campaign_name ?? row.dimensions.campaign_id,
    campaign_id: row.dimensions.campaign_id,
    // Ad group (= ad set level)
    ad_set_name: (level === 'ad_set' || level === 'ad') ? row.metrics.adgroup_name : undefined,
    ad_set_id: (level === 'ad_set' || level === 'ad') ? row.dimensions.adgroup_id : undefined,
    // Ad level
    ad_name: level === 'ad' ? row.metrics.ad_name : undefined,
    ad_id: level === 'ad' ? row.dimensions.ad_id : undefined,
    platform: 'tiktok_ads',
    date,
    spend,
    impressions,
    clicks,
    conversions,
    revenue,
    ctr,
    cpc,
    cpa,
    roas,
    // Extended
    reach: reachVal,
    frequency: freqVal,
    video_views: videoPlays,
    video_view_rate: videoViewRate,
    video_p25: videoP25,
    video_p50: videoP50,
    video_p75: videoP75,
    video_p100: videoP100,
    conversion_rate: conversionRate,
  };
}
