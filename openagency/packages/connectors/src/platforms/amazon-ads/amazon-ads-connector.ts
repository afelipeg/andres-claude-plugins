// ─── Amazon Ads Connector ───────────────────────────────────────────
// Amazon Advertising API v3. Login with Amazon (LWA) OAuth2.
// Multi-level: campaign → ad group. Multi-ad-product: SP, SB, SD.
// Extended metrics: ACoS, DPV, viewable impressions, new-to-brand.
// Async reports: create → poll → download gzipped → decompress → parse.

import type {
  PlatformConnector,
  OAuthTokens,
  PlatformCredentials,
  NormalizedCampaignRow,
  PlatformAccount,
  FetchOptions,
  DataLevel,
  AmazonAdProduct,
} from '@openagency/types';
import { OAuth2Client } from '../../auth/oauth2-client.js';
import { RateLimiter, PLATFORM_RATE_LIMITS } from '../../utils/rate-limiter.js';
import { withRetry } from '../../utils/retry.js';

const AUTH_URL = 'https://www.amazon.com/ap/oa';
const TOKEN_URL = 'https://api.amazon.com/auth/o2/token';
const ADS_API_URL = 'https://advertising-api.amazon.com/v3';
const SCOPES = ['advertising::campaign_management'];

// Report type IDs per ad product and level
const REPORT_CONFIG: Record<AmazonAdProduct, Record<DataLevel, { reportTypeId: string; groupBy: string[] }>> = {
  SPONSORED_PRODUCTS: {
    campaign: { reportTypeId: 'spCampaigns', groupBy: ['campaign'] },
    ad_set: { reportTypeId: 'spTargeting', groupBy: ['campaign', 'adGroup'] },
    ad: { reportTypeId: 'spAdvertisedProduct', groupBy: ['campaign', 'adGroup', 'advertiser'] },
  },
  SPONSORED_BRANDS: {
    campaign: { reportTypeId: 'sbCampaigns', groupBy: ['campaign'] },
    ad_set: { reportTypeId: 'sbAdGroups', groupBy: ['campaign', 'adGroup'] },
    ad: { reportTypeId: 'sbAds', groupBy: ['campaign', 'adGroup', 'ad'] },
  },
  SPONSORED_DISPLAY: {
    campaign: { reportTypeId: 'sdCampaigns', groupBy: ['campaign'] },
    ad_set: { reportTypeId: 'sdAdGroups', groupBy: ['campaign', 'adGroup'] },
    ad: { reportTypeId: 'sdAds', groupBy: ['campaign', 'adGroup', 'ad'] },
  },
};

// Core columns available across all ad products
const CORE_COLUMNS = [
  'campaignName',
  'campaignId',
  'date',
  'impressions',
  'clicks',
  'cost',
  'purchases14d',
  'sales14d',
];

// Extended columns for granular levels
const AD_GROUP_COLUMNS = [
  'adGroupName',
  'adGroupId',
];

// Extended metrics columns
const EXTENDED_COLUMNS = [
  'dpv14d',                   // Detail Page Views
  'viewableImpressions',
  'newToBrandPurchases14d',
  'newToBrandSales14d',
  'unitsSold14d',
];

const ALL_AD_PRODUCTS: AmazonAdProduct[] = ['SPONSORED_PRODUCTS', 'SPONSORED_BRANDS', 'SPONSORED_DISPLAY'];

export interface AmazonAdsConnectorConfig {
  clientId: string;
  clientSecret: string;
}

export class AmazonAdsConnector implements PlatformConnector {
  readonly platform = 'amazon_ads' as const;
  private oauth: OAuth2Client;
  private limiter = new RateLimiter(PLATFORM_RATE_LIMITS.amazon_ads);

  constructor(private config: AmazonAdsConnectorConfig) {
    this.oauth = new OAuth2Client({
      authUrl: AUTH_URL,
      tokenUrl: TOKEN_URL,
      clientId: config.clientId,
      clientSecret: config.clientSecret,
      scopes: SCOPES,
    });
  }

  getAuthUrl(redirectUri: string, state?: string): string {
    return this.oauth.getAuthUrl(redirectUri, state);
  }

  async exchangeCode(code: string, redirectUri: string): Promise<OAuthTokens> {
    const tokens = await this.oauth.exchangeCode(code, redirectUri);
    return {
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      token_type: tokens.token_type || 'Bearer',
      expires_at: Date.now() + (tokens.expires_in ?? 3600) * 1000,
      scope: tokens.scope,
    };
  }

  async refreshTokens(tokens: OAuthTokens): Promise<OAuthTokens> {
    if (!tokens.refresh_token) throw new Error('No refresh token available');
    const refreshed = await this.oauth.refreshToken(tokens.refresh_token);
    return {
      access_token: refreshed.access_token,
      refresh_token: tokens.refresh_token,
      token_type: 'Bearer',
      expires_at: Date.now() + (refreshed.expires_in ?? 3600) * 1000,
      scope: tokens.scope,
    };
  }

  isTokenValid(tokens: OAuthTokens): boolean {
    return tokens.expires_at > Date.now() + 300_000;
  }

  async listAccounts(tokens: OAuthTokens): Promise<PlatformAccount[]> {
    await this.limiter.acquire();

    const res = await withRetry(() =>
      fetch(`${ADS_API_URL}/profiles`, {
        headers: this.buildHeaders(tokens),
      }),
    );

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Amazon Ads API error listing profiles (${res.status}): ${err}`);
    }

    const profiles = (await res.json()) as AmazonProfile[];
    return profiles.map((p) => ({
      id: String(p.profileId),
      name: p.accountInfo?.name ?? `Profile ${p.profileId}`,
      currency: p.currencyCode,
      timezone: p.timezone,
      status: 'active',
    }));
  }

  async fetchCampaigns(
    credentials: PlatformCredentials,
    dateRange: { start: string; end: string },
    options?: FetchOptions,
  ): Promise<NormalizedCampaignRow[]> {
    const profileId = credentials.profile_id ?? credentials.account_id;
    if (!profileId) throw new Error('Amazon Ads profile_id required');

    const level = options?.level ?? 'campaign';
    const adProducts = options?.adProducts ?? ALL_AD_PRODUCTS;

    // Fetch reports for each ad product in parallel
    const results = await Promise.all(
      adProducts.map((adProduct) =>
        this.fetchAdProductReport(credentials.tokens, profileId, dateRange, level, adProduct),
      ),
    );

    return results.flat();
  }

  private async fetchAdProductReport(
    tokens: OAuthTokens,
    profileId: string,
    dateRange: { start: string; end: string },
    level: DataLevel,
    adProduct: AmazonAdProduct,
  ): Promise<NormalizedCampaignRow[]> {
    try {
      const reportId = await this.createReport(tokens, profileId, dateRange, level, adProduct);
      const downloadUrl = await this.pollReport(tokens, profileId, reportId);
      return this.downloadReport(tokens, profileId, downloadUrl, adProduct, level);
    } catch (err) {
      // Some ad products may not be enabled — return empty rather than failing
      const message = err instanceof Error ? err.message : String(err);
      if (message.includes('406') || message.includes('not enabled') || message.includes('not found')) {
        return [];
      }
      throw err;
    }
  }

  private buildHeaders(
    tokens: OAuthTokens,
    profileId?: string,
  ): Record<string, string> {
    const headers: Record<string, string> = {
      Authorization: `Bearer ${tokens.access_token}`,
      'Amazon-Advertising-API-ClientId': this.config.clientId,
      'Content-Type': 'application/json',
    };
    if (profileId) {
      headers['Amazon-Advertising-API-Scope'] = profileId;
    }
    return headers;
  }

  private async createReport(
    tokens: OAuthTokens,
    profileId: string,
    dateRange: { start: string; end: string },
    level: DataLevel,
    adProduct: AmazonAdProduct,
  ): Promise<string> {
    await this.limiter.acquire();

    const config = REPORT_CONFIG[adProduct][level];
    const columns = [
      ...CORE_COLUMNS,
      ...(level === 'ad_set' || level === 'ad' ? AD_GROUP_COLUMNS : []),
      ...EXTENDED_COLUMNS,
    ];

    const body = {
      reportDate: dateRange.start,
      configuration: {
        adProduct: adProduct,
        groupBy: config.groupBy,
        columns,
        reportTypeId: config.reportTypeId,
        timeUnit: 'DAILY',
        format: 'GZIP_JSON',
      },
      startDate: dateRange.start,
      endDate: dateRange.end,
    };

    const res = await withRetry(() =>
      fetch(`${ADS_API_URL}/reporting/reports`, {
        method: 'POST',
        headers: this.buildHeaders(tokens, profileId),
        body: JSON.stringify(body),
      }),
    );

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Amazon Ads create report failed (${res.status}): ${err}`);
    }

    const data = (await res.json()) as { reportId: string };
    return data.reportId;
  }

  private async pollReport(
    tokens: OAuthTokens,
    profileId: string,
    reportId: string,
  ): Promise<string> {
    const maxAttempts = 30;
    const pollInterval = 10_000;

    for (let i = 0; i < maxAttempts; i++) {
      await this.limiter.acquire();

      const res = await fetch(`${ADS_API_URL}/reporting/reports/${reportId}`, {
        headers: this.buildHeaders(tokens, profileId),
      });

      if (!res.ok) {
        const err = await res.text();
        throw new Error(`Amazon Ads poll report failed (${res.status}): ${err}`);
      }

      const data = (await res.json()) as {
        status: string;
        url?: string;
        failureReason?: string;
      };

      if (data.status === 'COMPLETED' && data.url) {
        return data.url;
      }

      if (data.status === 'FAILURE') {
        throw new Error(`Amazon Ads report failed: ${data.failureReason ?? 'unknown'}`);
      }

      await sleep(pollInterval);
    }

    throw new Error('Amazon Ads report poll timed out');
  }

  private async downloadReport(
    tokens: OAuthTokens,
    profileId: string,
    downloadUrl: string,
    adProduct: AmazonAdProduct,
    level: DataLevel,
  ): Promise<NormalizedCampaignRow[]> {
    const res = await withRetry(() =>
      fetch(downloadUrl, {
        headers: this.buildHeaders(tokens, profileId),
      }),
    );

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Amazon Ads report download failed (${res.status}): ${err}`);
    }

    // Response is gzipped JSON — decompress
    const buffer = await res.arrayBuffer();
    const text = await decompressGzip(new Uint8Array(buffer));
    const rows = JSON.parse(text) as AmazonReportRow[];

    return rows.map((row) => normalizeAmazonRow(row, adProduct, level));
  }
}

interface AmazonProfile {
  profileId: number;
  countryCode: string;
  currencyCode: string;
  timezone: string;
  accountInfo?: { name: string };
}

interface AmazonReportRow {
  campaignName: string;
  campaignId: string;
  adGroupName?: string;
  adGroupId?: string;
  date: string;
  impressions: number;
  clicks: number;
  cost: number;
  purchases14d: number;
  sales14d: number;
  dpv14d?: number;
  viewableImpressions?: number;
  newToBrandPurchases14d?: number;
  newToBrandSales14d?: number;
  unitsSold14d?: number;
}

function normalizeAmazonRow(
  row: AmazonReportRow,
  adProduct: AmazonAdProduct,
  level: DataLevel,
): NormalizedCampaignRow {
  const spend = row.cost ?? 0;
  const impressions = row.impressions ?? 0;
  const clicks = row.clicks ?? 0;
  const conversions = row.purchases14d ?? 0;
  const revenue = row.sales14d ?? 0;
  const acos = revenue > 0 ? spend / revenue : undefined;
  const conversionRate = clicks > 0 ? conversions / clicks : undefined;

  return {
    campaign_name: row.campaignName,
    campaign_id: String(row.campaignId),
    // Ad group level
    ad_set_name: (level === 'ad_set' || level === 'ad') ? row.adGroupName : undefined,
    ad_set_id: (level === 'ad_set' || level === 'ad') && row.adGroupId ? String(row.adGroupId) : undefined,
    platform: 'amazon_ads',
    ad_product: adProduct,
    date: row.date,
    spend,
    impressions,
    clicks,
    conversions,
    revenue,
    ctr: impressions > 0 ? clicks / impressions : 0,
    cpc: clicks > 0 ? spend / clicks : 0,
    cpa: conversions > 0 ? spend / conversions : 0,
    roas: spend > 0 ? revenue / spend : 0,
    // Extended Amazon metrics
    acos,
    dpv: row.dpv14d ?? undefined,
    viewable_impressions: row.viewableImpressions ?? undefined,
    new_to_brand_conversions: row.newToBrandPurchases14d ?? undefined,
    units_sold: row.unitsSold14d ?? undefined,
    conversion_rate: conversionRate,
  };
}

async function decompressGzip(data: Uint8Array): Promise<string> {
  const ds = new DecompressionStream('gzip');
  const writer = ds.writable.getWriter();
  writer.write(data.buffer as ArrayBuffer);
  writer.close();

  const reader = ds.readable.getReader();
  const chunks: Uint8Array[] = [];
  let done = false;

  while (!done) {
    const result = await reader.read();
    done = result.done;
    if (result.value) chunks.push(result.value);
  }

  const totalLength = chunks.reduce((sum, c) => sum + c.length, 0);
  const combined = new Uint8Array(totalLength);
  let offset = 0;
  for (const chunk of chunks) {
    combined.set(chunk, offset);
    offset += chunk.length;
  }

  return new TextDecoder().decode(combined);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
