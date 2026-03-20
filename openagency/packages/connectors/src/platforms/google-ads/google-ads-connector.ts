// ─── Google Ads Connector ───────────────────────────────────────────
// Google Ads API v17 (REST). GAQL queries via searchStream.
// Multi-level: campaign → ad_group → ad. Extended metrics: cost_per_conversion,
// conversion_rate, search_impression_share, video_views, video_view_rate.

import type {
  PlatformConnector,
  OAuthTokens,
  PlatformCredentials,
  NormalizedCampaignRow,
  PlatformAccount,
  FetchOptions,
  DataLevel,
} from '@openagency/types';
import { createGoogleOAuth, googleTokensToOAuth } from '../google-shared/google-oauth.js';
import { RateLimiter, PLATFORM_RATE_LIMITS } from '../../utils/rate-limiter.js';
import { withRetry } from '../../utils/retry.js';

const API_VERSION = 'v23';
const BASE_URL = `https://googleads.googleapis.com/${API_VERSION}`;
const SCOPES = ['https://www.googleapis.com/auth/adwords'];

// Shared metrics available at all levels
const CORE_METRICS = `
  metrics.cost_micros,
  metrics.impressions,
  metrics.clicks,
  metrics.conversions,
  metrics.conversions_value,
  metrics.ctr,
  metrics.average_cpc,
  metrics.cost_per_conversion,
  metrics.conversions_from_interactions_rate,
  metrics.video_views,
  metrics.video_view_rate,
  metrics.search_impression_share,
  metrics.view_through_conversions
`;

// Level-specific GAQL queries
const QUERIES: Record<DataLevel, (start: string, end: string) => string> = {
  campaign: (start, end) => `
    SELECT
      campaign.name, campaign.id,
      segments.date,
      ${CORE_METRICS}
    FROM campaign
    WHERE segments.date BETWEEN '${start}' AND '${end}'
      AND campaign.status != 'REMOVED'
    ORDER BY segments.date DESC
  `,
  ad_set: (start, end) => `
    SELECT
      campaign.name, campaign.id,
      ad_group.name, ad_group.id,
      segments.date,
      ${CORE_METRICS}
    FROM ad_group
    WHERE segments.date BETWEEN '${start}' AND '${end}'
      AND campaign.status != 'REMOVED'
      AND ad_group.status != 'REMOVED'
    ORDER BY segments.date DESC
  `,
  ad: (start, end) => `
    SELECT
      campaign.name, campaign.id,
      ad_group.name, ad_group.id,
      ad_group_ad.ad.id, ad_group_ad.ad.name,
      segments.date,
      ${CORE_METRICS}
    FROM ad_group_ad
    WHERE segments.date BETWEEN '${start}' AND '${end}'
      AND campaign.status != 'REMOVED'
      AND ad_group.status != 'REMOVED'
      AND ad_group_ad.status != 'REMOVED'
    ORDER BY segments.date DESC
  `,
};

export interface GoogleAdsConnectorConfig {
  clientId: string;
  clientSecret: string;
  developerToken: string;
  managerAccountId?: string;
}

export class GoogleAdsConnector implements PlatformConnector {
  readonly platform = 'google_ads' as const;
  private oauth;
  private limiter = new RateLimiter(PLATFORM_RATE_LIMITS.google_ads);

  constructor(private config: GoogleAdsConnectorConfig) {
    this.oauth = createGoogleOAuth(config.clientId, config.clientSecret, SCOPES);
  }

  getAuthUrl(redirectUri: string, state?: string): string {
    return this.oauth.getAuthUrl(redirectUri, state);
  }

  async exchangeCode(code: string, redirectUri: string): Promise<OAuthTokens> {
    const tokens = await this.oauth.exchangeCode(code, redirectUri);
    return googleTokensToOAuth(tokens);
  }

  async refreshTokens(tokens: OAuthTokens): Promise<OAuthTokens> {
    if (!tokens.refresh_token) throw new Error('No refresh token available');
    const refreshed = await this.oauth.refreshToken(tokens.refresh_token);
    return {
      ...googleTokensToOAuth(refreshed),
      refresh_token: tokens.refresh_token,
    };
  }

  isTokenValid(tokens: OAuthTokens): boolean {
    return tokens.expires_at > Date.now() + 300_000;
  }

  async listAccounts(tokens: OAuthTokens): Promise<PlatformAccount[]> {
    await this.limiter.acquire();

    const query = `
      SELECT customer.id, customer.descriptive_name, customer.currency_code, customer.time_zone, customer.status
      FROM customer
      LIMIT 100
    `;

    if (this.config.managerAccountId) {
      const url = `${BASE_URL}/customers/${this.config.managerAccountId}/googleAds:searchStream`;
      const data = await this.gaqlQuery(url, query, tokens) as unknown as GoogleAdsCustomerRow[];
      return data.map((row) => ({
        id: row.customer.id,
        name: row.customer.descriptiveName || row.customer.id,
        currency: row.customer.currencyCode,
        timezone: row.customer.timeZone,
        status: row.customer.status === 'ENABLED' ? 'active' : 'inactive',
      }));
    }

    const res = await withRetry(() =>
      fetch(`${BASE_URL}/customers:listAccessibleCustomers`, {
        headers: this.buildHeaders(tokens),
      }),
    );

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Google Ads API error (${res.status}): ${err}`);
    }

    const data = (await res.json()) as { resourceNames: string[] };
    return data.resourceNames.map((rn) => {
      const id = rn.replace('customers/', '');
      return { id, name: id };
    });
  }

  async fetchCampaigns(
    credentials: PlatformCredentials,
    dateRange: { start: string; end: string },
    options?: FetchOptions,
  ): Promise<NormalizedCampaignRow[]> {
    const customerId = credentials.account_id;
    if (!customerId) throw new Error('Google Ads customer_id required');

    const level = options?.level ?? 'campaign';
    const query = QUERIES[level](dateRange.start, dateRange.end);

    const url = `${BASE_URL}/customers/${customerId}/googleAds:searchStream`;
    const results = await this.gaqlQuery(url, query, credentials.tokens) as unknown as GoogleAdsRow[];

    return results.map((row) => normalizeGoogleRow(row, level));
  }

  private buildHeaders(tokens: OAuthTokens): Record<string, string> {
    const headers: Record<string, string> = {
      Authorization: `Bearer ${tokens.access_token}`,
      'Content-Type': 'application/json',
      'developer-token': this.config.developerToken,
    };
    if (this.config.managerAccountId) {
      headers['login-customer-id'] = this.config.managerAccountId;
    }
    return headers;
  }

  private async gaqlQuery(
    url: string,
    query: string,
    tokens: OAuthTokens,
  ): Promise<Array<Record<string, unknown>>> {
    await this.limiter.acquire();

    const res = await withRetry(() =>
      fetch(url, {
        method: 'POST',
        headers: this.buildHeaders(tokens),
        body: JSON.stringify({ query }),
      }),
    );

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Google Ads GAQL query failed (${res.status}): ${err}`);
    }

    const data = (await res.json()) as Array<{ results: Array<Record<string, unknown>> }>;
    return data.flatMap((batch) => batch.results ?? []);
  }
}

// ─── Google Ads API response types ──────────────────────────────────

interface GoogleAdsCustomerRow {
  customer: {
    id: string;
    descriptiveName?: string;
    currencyCode?: string;
    timeZone?: string;
    status?: string;
  };
}

interface GoogleAdsRow {
  campaign: { name: string; id: number };
  adGroup?: { name: string; id: number };
  adGroupAd?: { ad: { id: number; name?: string } };
  segments: { date: string };
  metrics: {
    costMicros?: number;
    impressions?: number;
    clicks?: number;
    conversions?: number;
    conversionsValue?: number;
    ctr?: number;
    averageCpc?: number;
    costPerConversion?: number;
    conversionsFromInteractionsRate?: number;
    videoViews?: number;
    videoViewRate?: number;
    searchImpressionShare?: number;
    viewThroughConversions?: number;
  };
}

function normalizeGoogleRow(row: GoogleAdsRow, level: DataLevel): NormalizedCampaignRow {
  const spend = (row.metrics.costMicros ?? 0) / 1_000_000;
  const impressions = row.metrics.impressions ?? 0;
  const clicks = row.metrics.clicks ?? 0;
  const conversions = row.metrics.conversions ?? 0;
  const revenue = row.metrics.conversionsValue ?? 0;
  const ctr = impressions > 0 ? clicks / impressions : 0;
  const cpc = clicks > 0 ? spend / clicks : 0;
  const cpa = conversions > 0 ? spend / conversions : 0;
  const roas = spend > 0 ? revenue / spend : 0;

  return {
    campaign_name: row.campaign.name,
    campaign_id: String(row.campaign.id),
    // Ad group (= ad set level)
    ad_set_name: (level === 'ad_set' || level === 'ad') ? row.adGroup?.name : undefined,
    ad_set_id: (level === 'ad_set' || level === 'ad') && row.adGroup?.id ? String(row.adGroup.id) : undefined,
    // Ad level
    ad_name: level === 'ad' ? row.adGroupAd?.ad?.name : undefined,
    ad_id: level === 'ad' && row.adGroupAd?.ad?.id ? String(row.adGroupAd.ad.id) : undefined,
    platform: 'google_ads',
    date: row.segments.date,
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
    conversion_rate: row.metrics.conversionsFromInteractionsRate,
    video_views: row.metrics.videoViews ?? undefined,
    video_view_rate: row.metrics.videoViewRate ?? undefined,
    search_impression_share: row.metrics.searchImpressionShare ?? undefined,
    viewable_impressions: row.metrics.viewThroughConversions ?? undefined,
  };
}
