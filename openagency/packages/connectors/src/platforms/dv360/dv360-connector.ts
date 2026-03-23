// ─── DV360 Connector ────────────────────────────────────────────────
// Display & Video 360 Reporting API v3. Async report generation.
// Supports insertion order + line item granularity.
// Extended metrics: CTR, CPC, viewable impressions, active views.
// Supports both OAuth2 and service account authentication.

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
import {
  parseServiceAccountJson,
  getServiceAccountToken,
  type GoogleServiceAccountKey,
} from '../google-shared/google-service-account.js';
import { RateLimiter, PLATFORM_RATE_LIMITS } from '../../utils/rate-limiter.js';
import { withRetry } from '../../utils/retry.js';

const DV360_URL = 'https://displayvideo.googleapis.com/v3';
const DBM_URL = 'https://doubleclickbidmanager.googleapis.com/v2';
const SCOPES = [
  'https://www.googleapis.com/auth/display-video',
  'https://www.googleapis.com/auth/doubleclickbidmanager',
];

const FULL_METRICS = [
  'METRIC_IMPRESSIONS',
  'METRIC_CLICKS',
  'METRIC_CTR',
  'METRIC_TOTAL_MEDIA_COST_ADVERTISER',
  'METRIC_TOTAL_CONVERSIONS',
  'METRIC_REVENUE_ADVERTISER',
  'METRIC_ACTIVE_VIEW_VIEWABLE_IMPRESSIONS',
  'METRIC_ACTIVE_VIEW_MEASURABLE_IMPRESSIONS',
  'METRIC_TRUEVIEW_VIEWS',
  'METRIC_TRUEVIEW_VIEW_RATE',
  'METRIC_REACH_IMPRESSION_REACH',
  'METRIC_REACH_AVERAGE_IMPRESSION_FREQUENCY',
];

// DV360 hierarchy: Partner → Advertiser → Insertion Order → Line Item
// campaign = IO level, ad_set = line item level
const GROUP_BYS: Record<DataLevel, string[]> = {
  campaign: [
    'FILTER_ADVERTISER_NAME',
    'FILTER_INSERTION_ORDER_NAME',
    'FILTER_DATE',
  ],
  ad_set: [
    'FILTER_ADVERTISER_NAME',
    'FILTER_INSERTION_ORDER_NAME',
    'FILTER_LINE_ITEM_NAME',
    'FILTER_DATE',
  ],
  ad: [
    'FILTER_ADVERTISER_NAME',
    'FILTER_INSERTION_ORDER_NAME',
    'FILTER_LINE_ITEM_NAME',
    'FILTER_CREATIVE_ID',
    'FILTER_DATE',
  ],
};

/** OAuth2 configuration (client_id + client_secret flow) */
export interface DV360ConnectorConfig {
  clientId: string;
  clientSecret: string;
}

/** Service account configuration (JWT assertion flow) */
export interface DV360ServiceAccountConfig {
  serviceAccountJson: string;
}

/** Type guard: is this a service account config? */
function isServiceAccountConfig(
  config: DV360ConnectorConfig | DV360ServiceAccountConfig,
): config is DV360ServiceAccountConfig {
  return 'serviceAccountJson' in config && !!config.serviceAccountJson;
}

export class DV360Connector implements PlatformConnector {
  readonly platform = 'dv360' as const;
  private oauth: ReturnType<typeof createGoogleOAuth> | null = null;
  private serviceAccount: GoogleServiceAccountKey | null = null;
  private limiter = new RateLimiter(PLATFORM_RATE_LIMITS.dv360);

  // Cached service account token to avoid re-signing on every call
  private saTokenCache: { access_token: string; expires_at: number } | null = null;

  constructor(private config: DV360ConnectorConfig | DV360ServiceAccountConfig) {
    if (isServiceAccountConfig(config)) {
      this.serviceAccount = parseServiceAccountJson(config.serviceAccountJson);
    } else {
      this.oauth = createGoogleOAuth(config.clientId, config.clientSecret, SCOPES);
    }
  }

  /**
   * Get a valid access token for service account auth.
   * Caches the token and refreshes 5 minutes before expiry.
   */
  async getServiceAccountAccessToken(): Promise<string> {
    if (!this.serviceAccount) {
      throw new Error('DV360 connector not configured with service account');
    }

    // Return cached token if still valid (5 min buffer)
    if (this.saTokenCache && this.saTokenCache.expires_at > Date.now() + 300_000) {
      return this.saTokenCache.access_token;
    }

    const result = await getServiceAccountToken(this.serviceAccount, SCOPES);
    this.saTokenCache = {
      access_token: result.access_token,
      expires_at: Date.now() + result.expires_in * 1000,
    };
    return result.access_token;
  }

  /** Returns true if this connector uses service account auth */
  get isServiceAccount(): boolean {
    return this.serviceAccount !== null;
  }

  getAuthUrl(redirectUri: string, state?: string): string {
    if (!this.oauth) throw new Error('getAuthUrl not available for service account auth');
    return this.oauth.getAuthUrl(redirectUri, state);
  }

  async exchangeCode(code: string, redirectUri: string): Promise<OAuthTokens> {
    if (!this.oauth) throw new Error('exchangeCode not available for service account auth');
    const tokens = await this.oauth.exchangeCode(code, redirectUri);
    return googleTokensToOAuth(tokens);
  }

  async refreshTokens(tokens: OAuthTokens): Promise<OAuthTokens> {
    // Service account: generate a fresh token via JWT assertion
    if (this.serviceAccount) {
      const accessToken = await this.getServiceAccountAccessToken();
      return {
        access_token: accessToken,
        token_type: 'Bearer',
        expires_at: this.saTokenCache!.expires_at,
      };
    }

    if (!this.oauth) throw new Error('No OAuth client configured');
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

  /**
   * Resolve a valid access token from OAuthTokens.
   * For service accounts, ignores the tokens param and generates a fresh one.
   * For OAuth2, returns the token from the tokens param.
   */
  private async resolveAccessToken(tokens: OAuthTokens): Promise<string> {
    if (this.serviceAccount) {
      return this.getServiceAccountAccessToken();
    }
    return tokens.access_token;
  }

  async listAccounts(tokens: OAuthTokens): Promise<PlatformAccount[]> {
    await this.limiter.acquire();

    const accessToken = await this.resolveAccessToken(tokens);

    const res = await withRetry(() =>
      fetch(`${DV360_URL}/partners`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      }),
    );

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`DV360 API error listing partners (${res.status}): ${err}`);
    }

    const data = (await res.json()) as {
      partners?: Array<{
        partnerId: string;
        displayName: string;
        entityStatus: string;
      }>;
    };

    return (data.partners ?? []).map((p) => ({
      id: p.partnerId,
      name: p.displayName,
      status: p.entityStatus === 'ENTITY_STATUS_ACTIVE' ? 'active' : 'inactive',
    }));
  }

  async fetchCampaigns(
    credentials: PlatformCredentials,
    dateRange: { start: string; end: string },
    options?: FetchOptions,
  ): Promise<NormalizedCampaignRow[]> {
    const partnerId = credentials.account_id;
    if (!partnerId) throw new Error('DV360 partner_id required');

    const level = options?.level ?? 'campaign';

    const queryId = await this.createQuery(credentials.tokens, partnerId, dateRange, level);
    await this.runQuery(credentials.tokens, queryId);
    const reportUrl = await this.pollForReport(credentials.tokens, queryId);
    return this.downloadAndParse(reportUrl, credentials.tokens, level);
  }

  private async createQuery(
    tokens: OAuthTokens,
    partnerId: string,
    dateRange: { start: string; end: string },
    level: DataLevel,
  ): Promise<string> {
    await this.limiter.acquire();

    const accessToken = await this.resolveAccessToken(tokens);

    const [startYear, startMonth, startDay] = dateRange.start.split('-').map(Number);
    const [endYear, endMonth, endDay] = dateRange.end.split('-').map(Number);

    const body = {
      metadata: {
        title: `OpenAgency Report ${Date.now()}`,
        dataRange: {
          range: 'CUSTOM_DATES',
          customStartDate: { year: startYear, month: startMonth, day: startDay },
          customEndDate: { year: endYear, month: endMonth, day: endDay },
        },
        format: 'CSV',
      },
      params: {
        type: 'STANDARD',
        metrics: FULL_METRICS,
        groupBys: GROUP_BYS[level],
        filters: [{ type: 'FILTER_PARTNER', value: partnerId }],
      },
    };

    const res = await withRetry(() =>
      fetch(`${DBM_URL}/queries`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      }),
    );

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`DV360 create query failed (${res.status}): ${err}`);
    }

    const data = (await res.json()) as { queryId: string };
    return data.queryId;
  }

  private async runQuery(tokens: OAuthTokens, queryId: string): Promise<void> {
    await this.limiter.acquire();

    const accessToken = await this.resolveAccessToken(tokens);

    const res = await withRetry(() =>
      fetch(`${DBM_URL}/queries/${queryId}:run`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      }),
    );

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`DV360 run query failed (${res.status}): ${err}`);
    }
  }

  private async pollForReport(tokens: OAuthTokens, queryId: string): Promise<string> {
    const maxAttempts = 30;
    const pollIntervalMs = 10_000;

    for (let i = 0; i < maxAttempts; i++) {
      await this.limiter.acquire();

      const accessToken = await this.resolveAccessToken(tokens);

      const res = await fetch(`${DBM_URL}/queries/${queryId}/reports`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      if (!res.ok) {
        const err = await res.text();
        throw new Error(`DV360 poll report failed (${res.status}): ${err}`);
      }

      const data = (await res.json()) as {
        reports?: Array<{
          metadata: { status: { state: string }; googleCloudStoragePath?: string };
        }>;
      };

      const latest = data.reports?.[0];
      if (latest?.metadata.status.state === 'DONE' && latest.metadata.googleCloudStoragePath) {
        return latest.metadata.googleCloudStoragePath;
      }

      if (latest?.metadata.status.state === 'FAILED') {
        throw new Error('DV360 report generation failed');
      }

      await sleep(pollIntervalMs);
    }

    throw new Error('DV360 report poll timed out');
  }

  private async downloadAndParse(
    reportUrl: string,
    tokens: OAuthTokens,
    level: DataLevel,
  ): Promise<NormalizedCampaignRow[]> {
    const accessToken = await this.resolveAccessToken(tokens);

    const res = await withRetry(() =>
      fetch(reportUrl, {
        headers: { Authorization: `Bearer ${accessToken}` },
      }),
    );

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`DV360 report download failed (${res.status}): ${err}`);
    }

    const csv = await res.text();
    return parseDV360Csv(csv, level);
  }
}

function parseDV360Csv(csv: string, level: DataLevel): NormalizedCampaignRow[] {
  const lines = csv.trim().split('\n');
  if (lines.length < 2) return [];

  const headers = lines[0].split(',').map((h) => h.trim());
  const rows: NormalizedCampaignRow[] = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const values = line.split(',');
    const r: Record<string, string> = {};
    headers.forEach((h, idx) => {
      r[h] = values[idx]?.trim() ?? '';
    });

    const spend = parseFloat(r['Total Media Cost (Advertiser Currency)'] ?? '0') || 0;
    const impressions = parseInt(r['Impressions'] ?? '0') || 0;
    const clicks = parseInt(r['Clicks'] ?? '0') || 0;
    const conversions = parseFloat(r['Total Conversions'] ?? '0') || 0;
    const revenue = parseFloat(r['Revenue (Advertiser Currency)'] ?? '0') || 0;
    const ctrVal = parseFloat(r['Click Rate'] ?? '0') || 0;
    const viewableImpressions = parseInt(r['Active View: Viewable Impressions'] ?? '0') || 0;
    const trueviewViews = parseInt(r['TrueView Views'] ?? '0') || 0;
    const trueviewViewRate = parseFloat(r['TrueView VTR'] ?? '0') || 0;
    const reachVal = parseInt(r['Unique Reach: Impression Reach'] ?? '0') || 0;
    const freqVal = parseFloat(r['Unique Reach: Average Impression Frequency'] ?? '0') || 0;

    const ioName = r['Insertion Order'] ?? r['Advertiser'] ?? 'Unknown';
    const lineItemName = r['Line Item'] ?? undefined;
    const creativeId = r['Creative ID'] ?? undefined;

    rows.push({
      // DV360 hierarchy: IO = campaign, Line Item = ad_set, Creative = ad
      campaign_name: ioName,
      campaign_id: r['Insertion Order ID'] ?? '',
      ad_set_name: (level === 'ad_set' || level === 'ad') ? lineItemName : undefined,
      ad_set_id: (level === 'ad_set' || level === 'ad') ? (r['Line Item ID'] ?? undefined) : undefined,
      line_item_name: lineItemName,
      line_item_id: r['Line Item ID'] ?? undefined,
      ad_name: level === 'ad' ? creativeId : undefined,
      ad_id: level === 'ad' ? creativeId : undefined,
      platform: 'dv360',
      date: r['Date'] ?? '',
      spend,
      impressions,
      clicks,
      conversions,
      revenue,
      ctr: ctrVal || (impressions > 0 ? clicks / impressions : 0),
      cpc: clicks > 0 ? spend / clicks : 0,
      cpa: conversions > 0 ? spend / conversions : 0,
      roas: spend > 0 ? revenue / spend : 0,
      viewable_impressions: viewableImpressions || undefined,
      video_views: trueviewViews || undefined,
      video_view_rate: trueviewViewRate || undefined,
      reach: reachVal || undefined,
      frequency: freqVal || undefined,
    });
  }

  return rows;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
