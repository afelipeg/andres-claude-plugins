// ─── TikTok Shop Connector ──────────────────────────────────────────
// TikTok Shop API — separate auth system from TikTok Ads.
// Regional endpoints (US/UK/SEA).
// Multi-level: campaign (daily aggregate) → ad (product-level).
// Extended metrics: GMV, units_sold, refund_amount, product details.

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

const AUTH_URL = 'https://services.tiktokshop.com/open/authorize';
const TOKEN_URL = 'https://auth.tiktok-shops.com/api/v2/token/get';

// Regional base URLs
const REGIONAL_URLS: Record<string, string> = {
  US: 'https://open-api.tiktokglobalshop.com',
  UK: 'https://open-api.tiktokglobalshop.com',
  SEA: 'https://open-api.tiktokglobalshop.com',
  default: 'https://open-api.tiktokglobalshop.com',
};

export interface TikTokShopConnectorConfig {
  appKey: string;
  appSecret: string;
  region?: string;
}

export class TikTokShopConnector implements PlatformConnector {
  readonly platform = 'tiktok_shop' as const;
  private limiter = new RateLimiter(PLATFORM_RATE_LIMITS.tiktok_shop);
  private baseUrl: string;

  constructor(private config: TikTokShopConnectorConfig) {
    this.baseUrl = REGIONAL_URLS[config.region ?? 'default'] ?? REGIONAL_URLS.default;
  }

  getAuthUrl(redirectUri: string, state?: string): string {
    const params = new URLSearchParams({
      app_key: this.config.appKey,
      redirect_uri: redirectUri,
      ...(state ? { state } : {}),
    });
    return `${AUTH_URL}?${params.toString()}`;
  }

  async exchangeCode(code: string, _redirectUri: string): Promise<OAuthTokens> {
    const params = new URLSearchParams({
      app_key: this.config.appKey,
      app_secret: this.config.appSecret,
      auth_code: code,
      grant_type: 'authorized_code',
    });

    const res = await fetch(`${TOKEN_URL}?${params.toString()}`);

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`TikTok Shop token exchange failed (${res.status}): ${err}`);
    }

    const data = (await res.json()) as {
      code: number;
      message: string;
      data: {
        access_token: string;
        refresh_token: string;
        access_token_expire_in: number;
        refresh_token_expire_in: number;
      };
    };

    if (data.code !== 0) {
      throw new Error(`TikTok Shop OAuth error: ${data.message}`);
    }

    return {
      access_token: data.data.access_token,
      refresh_token: data.data.refresh_token,
      token_type: 'bearer',
      expires_at: Date.now() + data.data.access_token_expire_in * 1000,
    };
  }

  async refreshTokens(tokens: OAuthTokens): Promise<OAuthTokens> {
    if (!tokens.refresh_token) throw new Error('No refresh token available');

    const params = new URLSearchParams({
      app_key: this.config.appKey,
      app_secret: this.config.appSecret,
      refresh_token: tokens.refresh_token,
      grant_type: 'refresh_token',
    });

    const res = await fetch(`${TOKEN_URL}?${params.toString()}`);

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`TikTok Shop token refresh failed (${res.status}): ${err}`);
    }

    const data = (await res.json()) as {
      code: number;
      message: string;
      data: {
        access_token: string;
        refresh_token: string;
        access_token_expire_in: number;
      };
    };

    if (data.code !== 0) {
      throw new Error(`TikTok Shop refresh error: ${data.message}`);
    }

    return {
      access_token: data.data.access_token,
      refresh_token: data.data.refresh_token,
      token_type: 'bearer',
      expires_at: Date.now() + data.data.access_token_expire_in * 1000,
    };
  }

  isTokenValid(tokens: OAuthTokens): boolean {
    return tokens.expires_at > Date.now() + 300_000;
  }

  async listAccounts(tokens: OAuthTokens): Promise<PlatformAccount[]> {
    await this.limiter.acquire();

    const res = await withRetry(() =>
      fetch(`${this.baseUrl}/api/shop/get_authorized_shop`, {
        headers: {
          'x-tts-access-token': tokens.access_token,
          'Content-Type': 'application/json',
        },
      }),
    );

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`TikTok Shop API error (${res.status}): ${err}`);
    }

    const data = (await res.json()) as {
      code: number;
      data: {
        shops: Array<{
          shop_id: string;
          shop_name: string;
          region: string;
        }>;
      };
    };

    return (data.data.shops ?? []).map((s) => ({
      id: s.shop_id,
      name: s.shop_name,
      timezone: s.region,
    }));
  }

  async fetchCampaigns(
    credentials: PlatformCredentials,
    dateRange: { start: string; end: string },
    options?: FetchOptions,
  ): Promise<NormalizedCampaignRow[]> {
    const shopId = credentials.account_id;
    if (!shopId) throw new Error('TikTok Shop shop_id required');

    const level = options?.level ?? 'campaign';
    const orders = await this.fetchAllOrders(credentials.tokens, shopId, dateRange);

    if (level === 'ad' || level === 'ad_set') {
      // Product-level breakdown
      return aggregateByProduct(orders);
    }

    // Campaign level — aggregate by date
    return aggregateByDate(orders);
  }

  private async fetchAllOrders(
    tokens: OAuthTokens,
    shopId: string,
    dateRange: { start: string; end: string },
  ): Promise<TikTokShopOrder[]> {
    const allOrders: TikTokShopOrder[] = [];
    let cursor = '';
    let hasMore = true;

    while (hasMore) {
      await this.limiter.acquire();

      const body: Record<string, unknown> = {
        shop_id: shopId,
        start_time: Math.floor(new Date(dateRange.start).getTime() / 1000),
        end_time: Math.floor(new Date(dateRange.end + 'T23:59:59').getTime() / 1000),
        page_size: 100,
        sort_by: 'create_time',
        sort_type: 'DESC',
      };

      if (cursor) {
        body.cursor = cursor;
      }

      const res = await withRetry(() =>
        fetch(`${this.baseUrl}/api/orders/search`, {
          method: 'POST',
          headers: {
            'x-tts-access-token': tokens.access_token,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(body),
        }),
      );

      if (!res.ok) {
        const err = await res.text();
        throw new Error(`TikTok Shop orders API error (${res.status}): ${err}`);
      }

      const data = (await res.json()) as {
        code: number;
        data: {
          orders: TikTokShopOrder[];
          next_cursor?: string;
          more: boolean;
        };
      };

      allOrders.push(...(data.data.orders ?? []));
      cursor = data.data.next_cursor ?? '';
      hasMore = data.data.more ?? false;
    }

    return allOrders;
  }
}

interface TikTokShopOrder {
  order_id: string;
  create_time: number;
  order_status: string;
  payment_info: {
    total_amount: string;
    currency: string;
  };
  line_items: Array<{
    product_id: string;
    product_name: string;
    sku_name: string;
    quantity: number;
    sale_price: string;
  }>;
  refund_info?: {
    refund_amount?: string;
  };
}

/**
 * Aggregate TikTok Shop orders by date (campaign-level view).
 */
function aggregateByDate(orders: TikTokShopOrder[]): NormalizedCampaignRow[] {
  const byDate = new Map<string, {
    revenue: number;
    orders: number;
    units: number;
    gmv: number;
    refunds: number;
  }>();

  for (const order of orders) {
    const date = new Date(order.create_time * 1000).toISOString().slice(0, 10);
    const existing = byDate.get(date) ?? { revenue: 0, orders: 0, units: 0, gmv: 0, refunds: 0 };

    const orderAmount = parseFloat(order.payment_info.total_amount) || 0;
    existing.revenue += orderAmount;
    existing.gmv += orderAmount;
    existing.orders += 1;
    existing.units += order.line_items.reduce((sum, li) => sum + li.quantity, 0);
    existing.refunds += parseFloat(order.refund_info?.refund_amount ?? '0') || 0;

    byDate.set(date, existing);
  }

  return Array.from(byDate.entries()).map(([date, agg]) => ({
    campaign_name: 'TikTok Shop Sales',
    campaign_id: `tts_${date}`,
    platform: 'tiktok_shop' as const,
    date,
    spend: 0, // Shop doesn't have ad spend — populated separately
    impressions: 0,
    clicks: 0,
    conversions: agg.orders,
    revenue: agg.revenue,
    ctr: 0,
    cpc: 0,
    cpa: 0,
    roas: 0,
    units_sold: agg.units,
    gmv: agg.gmv,
    refund_amount: agg.refunds || undefined,
  }));
}

/**
 * Aggregate TikTok Shop orders by product (ad/product-level view).
 */
function aggregateByProduct(orders: TikTokShopOrder[]): NormalizedCampaignRow[] {
  const byProduct = new Map<string, {
    productName: string;
    revenue: number;
    orders: number;
    units: number;
    gmv: number;
    refunds: number;
    dates: Set<string>;
  }>();

  for (const order of orders) {
    const date = new Date(order.create_time * 1000).toISOString().slice(0, 10);
    const refundPerItem = order.line_items.length > 0
      ? (parseFloat(order.refund_info?.refund_amount ?? '0') || 0) / order.line_items.length
      : 0;

    for (const li of order.line_items) {
      const key = `${li.product_id}_${date}`;
      const existing = byProduct.get(key) ?? {
        productName: li.product_name,
        revenue: 0,
        orders: 0,
        units: 0,
        gmv: 0,
        refunds: 0,
        dates: new Set<string>(),
      };

      const itemRevenue = parseFloat(li.sale_price) * li.quantity;
      existing.revenue += itemRevenue;
      existing.gmv += itemRevenue;
      existing.orders += 1;
      existing.units += li.quantity;
      existing.refunds += refundPerItem;
      existing.dates.add(date);

      byProduct.set(key, existing);
    }
  }

  return Array.from(byProduct.entries()).map(([key, agg]) => {
    const productId = key.split('_')[0];
    const date = key.split('_').slice(1).join('_');

    return {
      campaign_name: 'TikTok Shop Sales',
      campaign_id: `tts_${date}`,
      ad_set_name: agg.productName,
      ad_set_id: productId,
      ad_name: agg.productName,
      ad_id: productId,
      product_name: agg.productName,
      platform: 'tiktok_shop' as const,
      date,
      spend: 0,
      impressions: 0,
      clicks: 0,
      conversions: agg.orders,
      revenue: agg.revenue,
      ctr: 0,
      cpc: 0,
      cpa: 0,
      roas: 0,
      units_sold: agg.units,
      gmv: agg.gmv,
      refund_amount: agg.refunds || undefined,
    };
  });
}
