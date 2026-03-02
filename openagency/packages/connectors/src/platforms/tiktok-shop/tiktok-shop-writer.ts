// ─── TikTok Shop Writer ────────────────────────────────────────────
// Extends TikTokShopConnector with write operations. TikTok Shop has
// limited campaign management APIs — bid adjustment is not supported.
// Uses /campaign/update/ and /campaign/status/update/ endpoints.

import type {
  PlatformCredentials,
  WritablePlatformConnector,
  WriteResult,
  BudgetUpdateParams,
  BidAdjustParams,
} from '@openagency/types';
import { TikTokShopConnector, type TikTokShopConnectorConfig } from './tiktok-shop-connector.js';
import { withRetry } from '../../utils/retry.js';

export class TikTokShopWriter extends TikTokShopConnector implements WritablePlatformConnector {
  private writerBaseUrl: string;

  constructor(config: TikTokShopConnectorConfig) {
    super(config);
    // TikTok Shop uses the same regional base URL
    this.writerBaseUrl = 'https://open-api.tiktokglobalshop.com';
  }

  async updateCampaignBudget(
    credentials: PlatformCredentials,
    params: BudgetUpdateParams,
  ): Promise<WriteResult> {
    const url = `${this.writerBaseUrl}/api/campaign/update/`;
    const body = {
      shop_id: credentials.account_id,
      campaign_id: params.campaign_id,
      budget: params.new_budget,
      budget_type: params.budget_type === 'lifetime' ? 'TOTAL' : 'DAILY',
    };

    const res = await withRetry(() =>
      fetch(url, {
        method: 'POST',
        headers: {
          'x-tts-access-token': credentials.tokens.access_token,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      }),
    );

    const data = (await res.json()) as { code: number; message: string };
    const success = res.ok && data.code === 0;

    return {
      success,
      platform: 'tiktok_shop',
      operation: 'budget_update',
      target_id: params.campaign_id,
      new_value: params.new_budget,
      timestamp: new Date().toISOString(),
      dry_run: false,
      error: success ? undefined : data.message,
    };
  }

  async pauseCampaign(
    credentials: PlatformCredentials,
    campaignId: string,
  ): Promise<WriteResult> {
    const url = `${this.writerBaseUrl}/api/campaign/status/update/`;
    const body = {
      shop_id: credentials.account_id,
      campaign_ids: [campaignId],
      opt_status: 'DISABLE',
    };

    const res = await withRetry(() =>
      fetch(url, {
        method: 'POST',
        headers: {
          'x-tts-access-token': credentials.tokens.access_token,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      }),
    );

    const data = (await res.json()) as { code: number; message: string };
    const success = res.ok && data.code === 0;

    return {
      success,
      platform: 'tiktok_shop',
      operation: 'campaign_pause',
      target_id: campaignId,
      new_value: 'DISABLE',
      timestamp: new Date().toISOString(),
      dry_run: false,
      error: success ? undefined : data.message,
    };
  }

  async enableCampaign(
    credentials: PlatformCredentials,
    campaignId: string,
  ): Promise<WriteResult> {
    const url = `${this.writerBaseUrl}/api/campaign/status/update/`;
    const body = {
      shop_id: credentials.account_id,
      campaign_ids: [campaignId],
      opt_status: 'ENABLE',
    };

    const res = await withRetry(() =>
      fetch(url, {
        method: 'POST',
        headers: {
          'x-tts-access-token': credentials.tokens.access_token,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      }),
    );

    const data = (await res.json()) as { code: number; message: string };
    const success = res.ok && data.code === 0;

    return {
      success,
      platform: 'tiktok_shop',
      operation: 'campaign_enable',
      target_id: campaignId,
      new_value: 'ENABLE',
      timestamp: new Date().toISOString(),
      dry_run: false,
      error: success ? undefined : data.message,
    };
  }

  async adjustBid(
    _credentials: PlatformCredentials,
    params: BidAdjustParams,
  ): Promise<WriteResult> {
    // TikTok Shop does not support bid adjustment
    return {
      success: false,
      platform: 'tiktok_shop',
      operation: 'bid_adjustment',
      target_id: params.ad_set_id,
      new_value: params.new_bid,
      timestamp: new Date().toISOString(),
      dry_run: false,
      error: 'Bid adjustment is not supported for TikTok Shop',
    };
  }
}
