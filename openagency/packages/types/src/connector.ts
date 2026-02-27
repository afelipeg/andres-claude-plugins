// ─── Platform Connector Types ───────────────────────────────────────

export type ConnectorPlatform =
  | 'google_ads'
  | 'meta_ads'
  | 'dv360'
  | 'tiktok_ads'
  | 'tiktok_shop'
  | 'amazon_ads';

export type ConnectionStatus =
  | 'disconnected'
  | 'connecting'
  | 'connected'
  | 'expired'
  | 'error';

export type SyncInterval = '15m' | '1h' | '6h' | '24h' | 'manual';

/** Granularity level for data fetching */
export type DataLevel = 'campaign' | 'ad_set' | 'ad';

export interface OAuthTokens {
  access_token: string;
  refresh_token?: string;
  token_type: string;
  expires_at: number; // Unix timestamp (ms)
  scope?: string;
}

export interface PlatformCredentials {
  platform: ConnectorPlatform;
  tokens: OAuthTokens;
  account_id?: string;
  manager_id?: string;
  developer_token?: string;
  app_id?: string;
  profile_id?: string;
  connected_at: string; // ISO 8601
  last_sync_at?: string; // ISO 8601
}

export interface ConnectorConfig {
  platform: ConnectorPlatform;
  credentials: PlatformCredentials;
  sync_interval: SyncInterval;
  enabled: boolean;
  date_range_days: number;
}

export interface FetchOptions {
  level?: DataLevel;
  /** Amazon: which ad products to include */
  adProducts?: AmazonAdProduct[];
}

// ─── Normalized Row ─────────────────────────────────────────────────
// Full hierarchy from campaign → ad set → ad, plus extended metrics.
// All optional hierarchy fields are filled when querying at that level.

export interface NormalizedCampaignRow {
  // ── Hierarchy identifiers ──
  campaign_name: string;
  campaign_id: string;
  ad_set_name?: string;   // Meta: ad set, Google: ad group, TikTok: ad group, DV360: line item
  ad_set_id?: string;
  ad_name?: string;
  ad_id?: string;
  /** DV360: insertion order (above line item) */
  line_item_name?: string;
  line_item_id?: string;

  // ── Dimensions ──
  platform: ConnectorPlatform;
  date: string; // YYYY-MM-DD
  /** Amazon: ad product type (SP, SB, SD) */
  ad_product?: AmazonAdProduct;

  // ── Core metrics ──
  spend: number;
  impressions: number;
  clicks: number;
  conversions: number;
  revenue: number;
  ctr: number;  // fraction (0.05 = 5%)
  cpc: number;
  cpa: number;
  roas: number;

  // ── Extended metrics (platform-dependent, undefined if unavailable) ──
  reach?: number;
  frequency?: number;
  video_views?: number;
  video_view_rate?: number;          // fraction
  video_p25?: number;                // 25% watched
  video_p50?: number;
  video_p75?: number;
  video_p100?: number;               // 100% (completed views)
  link_clicks?: number;              // Meta: outbound clicks distinct from "all clicks"
  unique_clicks?: number;
  conversion_rate?: number;          // fraction
  viewable_impressions?: number;
  search_impression_share?: number;  // fraction (Google only)
  /** Amazon: Advertising Cost of Sales = spend / revenue */
  acos?: number;
  /** Amazon: Detail Page Views */
  dpv?: number;
  /** Amazon: New-to-brand purchases */
  new_to_brand_conversions?: number;
  /** TikTok Shop: product-level data */
  product_name?: string;
  units_sold?: number;
  gmv?: number;           // Gross Merchandise Value
  refund_amount?: number;
}

export type AmazonAdProduct = 'SPONSORED_PRODUCTS' | 'SPONSORED_BRANDS' | 'SPONSORED_DISPLAY';

export interface SyncResult {
  platform: ConnectorPlatform;
  status: 'success' | 'partial' | 'error';
  rows: NormalizedCampaignRow[];
  row_count: number;
  date_range: { start: string; end: string };
  synced_at: string; // ISO 8601
  error?: string;
  rate_limit_remaining?: number;
}

export interface RateLimitConfig {
  requests_per_second: number;
  requests_per_minute: number;
  daily_limit?: number;
  retry_after_ms: number;
  max_retries: number;
}

export interface PlatformAccount {
  id: string;
  name: string;
  currency?: string;
  timezone?: string;
  status?: string;
}

export interface PlatformConnector {
  readonly platform: ConnectorPlatform;
  getAuthUrl(redirectUri: string, state?: string): string;
  exchangeCode(code: string, redirectUri: string): Promise<OAuthTokens>;
  refreshTokens(tokens: OAuthTokens): Promise<OAuthTokens>;
  isTokenValid(tokens: OAuthTokens): boolean;
  fetchCampaigns(
    credentials: PlatformCredentials,
    dateRange: { start: string; end: string },
    options?: FetchOptions,
  ): Promise<NormalizedCampaignRow[]>;
  listAccounts(tokens: OAuthTokens): Promise<PlatformAccount[]>;
}
