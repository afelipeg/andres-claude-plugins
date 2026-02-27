// ─── Meta Ads Connector ─────────────────────────────────────────────
// Marketing API v21.0 (Graph API). Supports Facebook + Instagram campaigns.
// Multi-level: campaign → ad set → ad. Extended metrics: reach, frequency,
// video views, link clicks, unique clicks.

import type {
  PlatformConnector,
  OAuthTokens,
  PlatformCredentials,
  NormalizedCampaignRow,
  PlatformAccount,
  FetchOptions,
  DataLevel,
} from '@openagency/types';
import { OAuth2Client } from '../../auth/oauth2-client.js';
import { RateLimiter, PLATFORM_RATE_LIMITS } from '../../utils/rate-limiter.js';
import { withRetry } from '../../utils/retry.js';

const API_VERSION = 'v21.0';
const AUTH_URL = `https://www.facebook.com/${API_VERSION}/dialog/oauth`;
const TOKEN_URL = `https://graph.facebook.com/${API_VERSION}/oauth/access_token`;
const GRAPH_URL = `https://graph.facebook.com/${API_VERSION}`;
const SCOPES = ['ads_read', 'ads_management', 'read_insights'];

// Full set of insight fields — covers campaign, ad set, and ad levels
const INSIGHTS_FIELDS = [
  'campaign_name',
  'campaign_id',
  'adset_name',
  'adset_id',
  'ad_name',
  'ad_id',
  'spend',
  'impressions',
  'clicks',
  'reach',
  'frequency',
  'actions',
  'action_values',
  'cost_per_action_type',
  'ctr',
  'cpc',
  'outbound_clicks',
  'unique_clicks',
  'video_p25_watched_actions',
  'video_p50_watched_actions',
  'video_p75_watched_actions',
  'video_p100_watched_actions',
].join(',');

const META_LEVEL: Record<DataLevel, string> = {
  campaign: 'campaign',
  ad_set: 'adset',
  ad: 'ad',
};

export interface MetaConnectorConfig {
  appId: string;
  appSecret: string;
}

export class MetaConnector implements PlatformConnector {
  readonly platform = 'meta_ads' as const;
  private oauth: OAuth2Client;
  private limiter = new RateLimiter(PLATFORM_RATE_LIMITS.meta_ads);

  constructor(private config: MetaConnectorConfig) {
    this.oauth = new OAuth2Client({
      authUrl: AUTH_URL,
      tokenUrl: TOKEN_URL,
      clientId: config.appId,
      clientSecret: config.appSecret,
      scopes: SCOPES,
    });
  }

  getAuthUrl(redirectUri: string, state?: string): string {
    return this.oauth.getAuthUrl(redirectUri, state);
  }

  async exchangeCode(code: string, redirectUri: string): Promise<OAuthTokens> {
    const tokens = await this.oauth.exchangeCode(code, redirectUri);
    const longLived = await this.exchangeForLongLived(tokens.access_token);

    return {
      access_token: longLived.access_token,
      token_type: 'bearer',
      expires_at: Date.now() + (longLived.expires_in ?? 5_184_000) * 1000,
      scope: SCOPES.join(','),
    };
  }

  async refreshTokens(tokens: OAuthTokens): Promise<OAuthTokens> {
    const refreshed = await this.exchangeForLongLived(tokens.access_token);
    return {
      access_token: refreshed.access_token,
      token_type: 'bearer',
      expires_at: Date.now() + (refreshed.expires_in ?? 5_184_000) * 1000,
      scope: tokens.scope,
    };
  }

  isTokenValid(tokens: OAuthTokens): boolean {
    return tokens.expires_at > Date.now() + 3_600_000;
  }

  async listAccounts(tokens: OAuthTokens): Promise<PlatformAccount[]> {
    await this.limiter.acquire();
    const url = `${GRAPH_URL}/me/adaccounts?fields=name,currency,timezone_name,account_status&access_token=${tokens.access_token}`;

    const res = await withRetry(() => fetch(url));
    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Meta API error listing accounts (${res.status}): ${err}`);
    }

    const data = (await res.json()) as {
      data: Array<{
        id: string;
        name: string;
        currency: string;
        timezone_name: string;
        account_status: number;
      }>;
    };

    return data.data.map((acc) => ({
      id: acc.id.replace('act_', ''),
      name: acc.name,
      currency: acc.currency,
      timezone: acc.timezone_name,
      status: acc.account_status === 1 ? 'active' : 'inactive',
    }));
  }

  async fetchCampaigns(
    credentials: PlatformCredentials,
    dateRange: { start: string; end: string },
    options?: FetchOptions,
  ): Promise<NormalizedCampaignRow[]> {
    const accountId = credentials.account_id;
    if (!accountId) throw new Error('Meta account_id required');

    const level = options?.level ?? 'campaign';
    const metaLevel = META_LEVEL[level];

    const timeRange = JSON.stringify({
      since: dateRange.start,
      until: dateRange.end,
    });

    const params = new URLSearchParams({
      fields: INSIGHTS_FIELDS,
      level: metaLevel,
      time_range: timeRange,
      time_increment: '1',
      access_token: credentials.tokens.access_token,
    });

    const rows: NormalizedCampaignRow[] = [];
    let url: string | null = `${GRAPH_URL}/act_${accountId}/insights?${params.toString()}`;

    while (url) {
      await this.limiter.acquire();
      const res = await withRetry(() => fetch(url!));

      if (!res.ok) {
        const err = await res.text();
        throw new Error(`Meta Insights API error (${res.status}): ${err}`);
      }

      const data = (await res.json()) as {
        data: MetaInsightRow[];
        paging?: { next?: string };
      };

      for (const row of data.data) {
        rows.push(normalizeInsightRow(row));
      }

      url = data.paging?.next ?? null;
    }

    return rows;
  }

  private async exchangeForLongLived(
    shortLivedToken: string,
  ): Promise<{ access_token: string; expires_in?: number }> {
    const params = new URLSearchParams({
      grant_type: 'fb_exchange_token',
      client_id: this.config.appId,
      client_secret: this.config.appSecret,
      fb_exchange_token: shortLivedToken,
    });

    const res = await fetch(`${GRAPH_URL}/oauth/access_token?${params.toString()}`);
    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Meta long-lived token exchange failed (${res.status}): ${err}`);
    }

    return (await res.json()) as { access_token: string; expires_in?: number };
  }
}

// ─── Meta API response types ──────────────────────────────────────

interface MetaInsightRow {
  campaign_name: string;
  campaign_id: string;
  adset_name?: string;
  adset_id?: string;
  ad_name?: string;
  ad_id?: string;
  date_start: string;
  spend: string;
  impressions: string;
  clicks: string;
  reach?: string;
  frequency?: string;
  ctr: string;
  cpc: string;
  actions?: Array<{ action_type: string; value: string }>;
  action_values?: Array<{ action_type: string; value: string }>;
  cost_per_action_type?: Array<{ action_type: string; value: string }>;
  outbound_clicks?: Array<{ action_type: string; value: string }>;
  unique_clicks?: string;
  video_p25_watched_actions?: Array<{ action_type: string; value: string }>;
  video_p50_watched_actions?: Array<{ action_type: string; value: string }>;
  video_p75_watched_actions?: Array<{ action_type: string; value: string }>;
  video_p100_watched_actions?: Array<{ action_type: string; value: string }>;
}

function normalizeInsightRow(row: MetaInsightRow): NormalizedCampaignRow {
  const spend = parseFloat(row.spend) || 0;
  const impressions = parseInt(row.impressions) || 0;
  const clicks = parseInt(row.clicks) || 0;
  const reach = row.reach ? parseInt(row.reach) : undefined;
  const frequency = row.frequency ? parseFloat(row.frequency) : undefined;

  // Purchase conversions
  const conversions = extractAction(row.actions, [
    'purchase', 'offsite_conversion.fb_pixel_purchase', 'omni_purchase',
  ]);

  // Revenue
  const revenue = extractAction(row.action_values, [
    'purchase', 'offsite_conversion.fb_pixel_purchase', 'omni_purchase',
  ]);

  // CPA
  const cpaPlatform = extractAction(row.cost_per_action_type, [
    'purchase', 'offsite_conversion.fb_pixel_purchase',
  ]);

  // Link clicks (outbound)
  const linkClicks = extractAction(row.outbound_clicks, ['outbound_click']);

  // Video views
  const videoP25 = extractVideoAction(row.video_p25_watched_actions);
  const videoP50 = extractVideoAction(row.video_p50_watched_actions);
  const videoP75 = extractVideoAction(row.video_p75_watched_actions);
  const videoP100 = extractVideoAction(row.video_p100_watched_actions);
  // Total video views = p25 (first meaningful view threshold)
  const videoViews = videoP25 || undefined;

  const ctr = impressions > 0 ? clicks / impressions : 0;
  const cpc = clicks > 0 ? spend / clicks : 0;
  const roas = spend > 0 ? revenue / spend : 0;
  const uniqueClicks = row.unique_clicks ? parseInt(row.unique_clicks) : undefined;
  const conversionRate = clicks > 0 ? conversions / clicks : undefined;

  return {
    campaign_name: row.campaign_name,
    campaign_id: row.campaign_id,
    ad_set_name: row.adset_name,
    ad_set_id: row.adset_id,
    ad_name: row.ad_name,
    ad_id: row.ad_id,
    platform: 'meta_ads',
    date: row.date_start,
    spend,
    impressions,
    clicks,
    conversions,
    revenue,
    ctr,
    cpc,
    cpa: cpaPlatform || (conversions > 0 ? spend / conversions : 0),
    roas,
    reach,
    frequency,
    video_views: videoViews,
    video_p25: videoP25 || undefined,
    video_p50: videoP50 || undefined,
    video_p75: videoP75 || undefined,
    video_p100: videoP100 || undefined,
    video_view_rate: videoViews && impressions > 0 ? videoViews / impressions : undefined,
    link_clicks: linkClicks || undefined,
    unique_clicks: uniqueClicks,
    conversion_rate: conversionRate,
  };
}

function extractAction(
  actions: Array<{ action_type: string; value: string }> | undefined,
  types: string[],
): number {
  if (!actions) return 0;
  for (const type of types) {
    const found = actions.find((a) => a.action_type === type);
    if (found) return parseFloat(found.value) || 0;
  }
  return 0;
}

function extractVideoAction(
  actions: Array<{ action_type: string; value: string }> | undefined,
): number {
  if (!actions) return 0;
  // Sum all action types (video_view across placements)
  let total = 0;
  for (const a of actions) {
    total += parseFloat(a.value) || 0;
  }
  return total;
}
