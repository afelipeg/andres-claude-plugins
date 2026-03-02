// ─── Amazon Ads Writer ─────────────────────────────────────────────
// Extends AmazonAdsConnector with write operations via the Amazon
// Advertising API v3. Uses PUT /sp/campaigns for Sponsored Products
// budget and status. Uses PUT /sp/adGroups for bid adjustments.

import type {
  PlatformCredentials,
  WritablePlatformConnector,
  WriteResult,
  BudgetUpdateParams,
  BidAdjustParams,
} from '@openagency/types';
import { AmazonAdsConnector, type AmazonAdsConnectorConfig } from './amazon-ads-connector.js';
import { withRetry } from '../../utils/retry.js';

const ADS_API_URL = 'https://advertising-api.amazon.com/v3';

export class AmazonAdsWriter extends AmazonAdsConnector implements WritablePlatformConnector {
  private writerConfig: AmazonAdsConnectorConfig;

  constructor(config: AmazonAdsConnectorConfig) {
    super(config);
    this.writerConfig = config;
  }

  async updateCampaignBudget(
    credentials: PlatformCredentials,
    params: BudgetUpdateParams,
  ): Promise<WriteResult> {
    const profileId = credentials.profile_id ?? credentials.account_id;
    if (!profileId) throw new Error('Amazon Ads profile_id required');

    const url = `${ADS_API_URL}/sp/campaigns`;
    const body = {
      campaigns: [
        {
          campaignId: params.campaign_id,
          budget: {
            budget: params.new_budget,
            budgetType: params.budget_type === 'lifetime' ? 'LIFETIME' : 'DAILY',
          },
        },
      ],
    };

    const res = await withRetry(() =>
      fetch(url, {
        method: 'PUT',
        headers: this.buildWriteHeaders(credentials, profileId),
        body: JSON.stringify(body),
      }),
    );

    const success = res.ok;

    return {
      success,
      platform: 'amazon_ads',
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
    const profileId = credentials.profile_id ?? credentials.account_id;
    if (!profileId) throw new Error('Amazon Ads profile_id required');

    const url = `${ADS_API_URL}/sp/campaigns`;
    const body = {
      campaigns: [
        {
          campaignId,
          state: 'PAUSED',
        },
      ],
    };

    const res = await withRetry(() =>
      fetch(url, {
        method: 'PUT',
        headers: this.buildWriteHeaders(credentials, profileId),
        body: JSON.stringify(body),
      }),
    );

    const success = res.ok;

    return {
      success,
      platform: 'amazon_ads',
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
    const profileId = credentials.profile_id ?? credentials.account_id;
    if (!profileId) throw new Error('Amazon Ads profile_id required');

    const url = `${ADS_API_URL}/sp/campaigns`;
    const body = {
      campaigns: [
        {
          campaignId,
          state: 'ENABLED',
        },
      ],
    };

    const res = await withRetry(() =>
      fetch(url, {
        method: 'PUT',
        headers: this.buildWriteHeaders(credentials, profileId),
        body: JSON.stringify(body),
      }),
    );

    const success = res.ok;

    return {
      success,
      platform: 'amazon_ads',
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
    const profileId = credentials.profile_id ?? credentials.account_id;
    if (!profileId) throw new Error('Amazon Ads profile_id required');

    const url = `${ADS_API_URL}/sp/adGroups`;
    const body = {
      adGroups: [
        {
          adGroupId: params.ad_set_id,
          defaultBid: params.new_bid,
        },
      ],
    };

    const res = await withRetry(() =>
      fetch(url, {
        method: 'PUT',
        headers: this.buildWriteHeaders(credentials, profileId),
        body: JSON.stringify(body),
      }),
    );

    const success = res.ok;

    return {
      success,
      platform: 'amazon_ads',
      operation: 'bid_adjustment',
      target_id: params.ad_set_id,
      new_value: params.new_bid,
      timestamp: new Date().toISOString(),
      dry_run: false,
      error: success ? undefined : await res.text(),
    };
  }

  private buildWriteHeaders(
    credentials: PlatformCredentials,
    profileId: string,
  ): Record<string, string> {
    return {
      Authorization: `Bearer ${credentials.tokens.access_token}`,
      'Amazon-Advertising-API-ClientId': this.writerConfig.clientId,
      'Amazon-Advertising-API-Scope': profileId,
      'Content-Type': 'application/json',
    };
  }
}
