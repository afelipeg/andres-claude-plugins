// ─── Google Ads Writer ─────────────────────────────────────────────
// Extends GoogleAdsConnector with write operations via the Google Ads
// API v17 mutate endpoints. Budget in micros (x 1,000,000).
// Uses CampaignBudgetOperation for budgets, Campaign.status for
// pause/enable, and AdGroupBidModifier for bid adjustments.

import type {
  PlatformCredentials,
  WritablePlatformConnector,
  WriteResult,
  BudgetUpdateParams,
  BidAdjustParams,
} from '@openagency/types';
import { GoogleAdsConnector, type GoogleAdsConnectorConfig } from './google-ads-connector.js';
import { withRetry } from '../../utils/retry.js';

const API_VERSION = 'v17';
const BASE_URL = `https://googleads.googleapis.com/${API_VERSION}`;

export class GoogleAdsWriter extends GoogleAdsConnector implements WritablePlatformConnector {
  private writerConfig: GoogleAdsConnectorConfig;

  constructor(config: GoogleAdsConnectorConfig) {
    super(config);
    this.writerConfig = config;
  }

  async updateCampaignBudget(
    credentials: PlatformCredentials,
    params: BudgetUpdateParams,
  ): Promise<WriteResult> {
    const customerId = credentials.account_id;
    if (!customerId) throw new Error('Google Ads customer_id required');

    const url = `${BASE_URL}/customers/${customerId}/campaignBudgets:mutate`;
    const body = {
      operations: [
        {
          updateMask: 'amountMicros',
          update: {
            resourceName: `customers/${customerId}/campaignBudgets/${params.campaign_id}`,
            amountMicros: String(Math.round(params.new_budget * 1_000_000)),
          },
        },
      ],
    };

    const res = await withRetry(() =>
      fetch(url, {
        method: 'POST',
        headers: this.buildWriteHeaders(credentials),
        body: JSON.stringify(body),
      }),
    );

    const success = res.ok;

    return {
      success,
      platform: 'google_ads',
      operation: 'budget_update',
      target_id: params.campaign_id,
      new_value: params.new_budget,
      timestamp: new Date().toISOString(),
      dry_run: false,
      error: success ? undefined : await res.text(),
    };
  }

  async pauseCampaign(
    credentials: PlatformCredentials,
    campaignId: string,
  ): Promise<WriteResult> {
    const customerId = credentials.account_id;
    if (!customerId) throw new Error('Google Ads customer_id required');

    const url = `${BASE_URL}/customers/${customerId}/campaigns:mutate`;
    const body = {
      operations: [
        {
          updateMask: 'status',
          update: {
            resourceName: `customers/${customerId}/campaigns/${campaignId}`,
            status: 'PAUSED',
          },
        },
      ],
    };

    const res = await withRetry(() =>
      fetch(url, {
        method: 'POST',
        headers: this.buildWriteHeaders(credentials),
        body: JSON.stringify(body),
      }),
    );

    const success = res.ok;

    return {
      success,
      platform: 'google_ads',
      operation: 'campaign_pause',
      target_id: campaignId,
      new_value: 'PAUSED',
      timestamp: new Date().toISOString(),
      dry_run: false,
      error: success ? undefined : await res.text(),
    };
  }

  async enableCampaign(
    credentials: PlatformCredentials,
    campaignId: string,
  ): Promise<WriteResult> {
    const customerId = credentials.account_id;
    if (!customerId) throw new Error('Google Ads customer_id required');

    const url = `${BASE_URL}/customers/${customerId}/campaigns:mutate`;
    const body = {
      operations: [
        {
          updateMask: 'status',
          update: {
            resourceName: `customers/${customerId}/campaigns/${campaignId}`,
            status: 'ENABLED',
          },
        },
      ],
    };

    const res = await withRetry(() =>
      fetch(url, {
        method: 'POST',
        headers: this.buildWriteHeaders(credentials),
        body: JSON.stringify(body),
      }),
    );

    const success = res.ok;

    return {
      success,
      platform: 'google_ads',
      operation: 'campaign_enable',
      target_id: campaignId,
      new_value: 'ENABLED',
      timestamp: new Date().toISOString(),
      dry_run: false,
      error: success ? undefined : await res.text(),
    };
  }

  async adjustBid(
    credentials: PlatformCredentials,
    params: BidAdjustParams,
  ): Promise<WriteResult> {
    const customerId = credentials.account_id;
    if (!customerId) throw new Error('Google Ads customer_id required');

    const url = `${BASE_URL}/customers/${customerId}/adGroups:mutate`;
    const body = {
      operations: [
        {
          updateMask: 'cpcBidMicros',
          update: {
            resourceName: `customers/${customerId}/adGroups/${params.ad_set_id}`,
            cpcBidMicros: String(Math.round(params.new_bid * 1_000_000)),
          },
        },
      ],
    };

    const res = await withRetry(() =>
      fetch(url, {
        method: 'POST',
        headers: this.buildWriteHeaders(credentials),
        body: JSON.stringify(body),
      }),
    );

    const success = res.ok;

    return {
      success,
      platform: 'google_ads',
      operation: 'bid_adjustment',
      target_id: params.ad_set_id,
      new_value: params.new_bid,
      timestamp: new Date().toISOString(),
      dry_run: false,
      error: success ? undefined : await res.text(),
    };
  }

  private buildWriteHeaders(credentials: PlatformCredentials): Record<string, string> {
    const headers: Record<string, string> = {
      Authorization: `Bearer ${credentials.tokens.access_token}`,
      'Content-Type': 'application/json',
      'developer-token': this.writerConfig.developerToken,
    };
    if (this.writerConfig.managerAccountId) {
      headers['login-customer-id'] = this.writerConfig.managerAccountId;
    }
    return headers;
  }
}
