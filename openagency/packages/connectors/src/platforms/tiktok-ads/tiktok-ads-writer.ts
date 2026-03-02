// ─── TikTok Ads Writer ─────────────────────────────────────────────
// Extends TikTokAdsConnector with write operations via the TikTok
// Marketing API v1.3. JSON body auth with Access-Token header.
// Uses /campaign/update/, /campaign/status/update/, /adgroup/update/.

import type {
  PlatformCredentials,
  WritablePlatformConnector,
  WriteResult,
  BudgetUpdateParams,
  BidAdjustParams,
} from '@openagency/types';
import { TikTokAdsConnector, type TikTokAdsConnectorConfig } from './tiktok-ads-connector.js';
import { withRetry } from '../../utils/retry.js';

const BASE_URL = 'https://business-api.tiktok.com/open_api/v1.3';

export class TikTokAdsWriter extends TikTokAdsConnector implements WritablePlatformConnector {
  constructor(config: TikTokAdsConnectorConfig) {
    super(config);
  }

  async updateCampaignBudget(
    credentials: PlatformCredentials,
    params: BudgetUpdateParams,
  ): Promise<WriteResult> {
    const advertiserId = credentials.account_id;
    if (!advertiserId) throw new Error('TikTok Ads advertiser_id required');

    const url = `${BASE_URL}/campaign/update/`;
    const body = {
      advertiser_id: advertiserId,
      campaign_id: params.campaign_id,
      budget: params.new_budget,
      budget_mode: params.budget_type === 'lifetime' ? 'BUDGET_MODE_TOTAL' : 'BUDGET_MODE_DAY',
    };

    const res = await withRetry(() =>
      fetch(url, {
        method: 'POST',
        headers: {
          'Access-Token': credentials.tokens.access_token,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      }),
    );

    const data = (await res.json()) as { code: number; message: string };
    const success = res.ok && data.code === 0;

    return {
      success,
      platform: 'tiktok_ads',
      operation: 'budget_update',
      target_id: params.campaign_id,
      new_value: params.new_budget,
      timestamp: new Date().toISOString(),
      dry_run: false,
      error: success ? undefined : data.message || await res.text(),
    };
  }

  async pauseCampaign(
    credentials: PlatformCredentials,
    campaignId: string,
  ): Promise<WriteResult> {
    const advertiserId = credentials.account_id;
    if (!advertiserId) throw new Error('TikTok Ads advertiser_id required');

    const url = `${BASE_URL}/campaign/status/update/`;
    const body = {
      advertiser_id: advertiserId,
      campaign_ids: [campaignId],
      opt_status: 'DISABLE',
    };

    const res = await withRetry(() =>
      fetch(url, {
        method: 'POST',
        headers: {
          'Access-Token': credentials.tokens.access_token,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      }),
    );

    const data = (await res.json()) as { code: number; message: string };
    const success = res.ok && data.code === 0;

    return {
      success,
      platform: 'tiktok_ads',
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
    const advertiserId = credentials.account_id;
    if (!advertiserId) throw new Error('TikTok Ads advertiser_id required');

    const url = `${BASE_URL}/campaign/status/update/`;
    const body = {
      advertiser_id: advertiserId,
      campaign_ids: [campaignId],
      opt_status: 'ENABLE',
    };

    const res = await withRetry(() =>
      fetch(url, {
        method: 'POST',
        headers: {
          'Access-Token': credentials.tokens.access_token,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      }),
    );

    const data = (await res.json()) as { code: number; message: string };
    const success = res.ok && data.code === 0;

    return {
      success,
      platform: 'tiktok_ads',
      operation: 'campaign_enable',
      target_id: campaignId,
      new_value: 'ENABLE',
      timestamp: new Date().toISOString(),
      dry_run: false,
      error: success ? undefined : data.message,
    };
  }

  async adjustBid(
    credentials: PlatformCredentials,
    params: BidAdjustParams,
  ): Promise<WriteResult> {
    const advertiserId = credentials.account_id;
    if (!advertiserId) throw new Error('TikTok Ads advertiser_id required');

    const url = `${BASE_URL}/adgroup/update/`;
    const body = {
      advertiser_id: advertiserId,
      adgroup_id: params.ad_set_id,
      bid: params.new_bid,
      ...(params.bid_strategy ? { bid_type: params.bid_strategy } : {}),
    };

    const res = await withRetry(() =>
      fetch(url, {
        method: 'POST',
        headers: {
          'Access-Token': credentials.tokens.access_token,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      }),
    );

    const data = (await res.json()) as { code: number; message: string };
    const success = res.ok && data.code === 0;

    return {
      success,
      platform: 'tiktok_ads',
      operation: 'bid_adjustment',
      target_id: params.ad_set_id,
      new_value: params.new_bid,
      timestamp: new Date().toISOString(),
      dry_run: false,
      error: success ? undefined : data.message,
    };
  }
}
