// ─── DV360 Writer ──────────────────────────────────────────────────
// Extends DV360Connector with write operations via the Display &
// Video 360 API v3. Uses PATCH lineItems/{id} for budget, entity
// status, and bid strategy updates.

import type {
  PlatformCredentials,
  WritablePlatformConnector,
  WriteResult,
  BudgetUpdateParams,
  BidAdjustParams,
} from '@openagency/types';
import { DV360Connector, type DV360ConnectorConfig } from './dv360-connector.js';
import { withRetry } from '../../utils/retry.js';

const DV360_URL = 'https://displayvideo.googleapis.com/v3';

export class DV360Writer extends DV360Connector implements WritablePlatformConnector {
  constructor(config: DV360ConnectorConfig) {
    super(config);
  }

  async updateCampaignBudget(
    credentials: PlatformCredentials,
    params: BudgetUpdateParams,
  ): Promise<WriteResult> {
    // DV360 budgets are set on line items (insertion order level)
    const url = `${DV360_URL}/advertisers/${credentials.account_id}/lineItems/${params.campaign_id}`;
    const budgetUnit = params.budget_type === 'lifetime' ? 'LINE_ITEM_BUDGET_ALLOCATION_TYPE_FIXED' : 'LINE_ITEM_BUDGET_ALLOCATION_TYPE_UNLIMITED';

    const body = {
      budget: {
        budgetAllocationType: budgetUnit,
        budgetUnit: 'BUDGET_UNIT_CURRENCY',
        maxAmount: String(Math.round(params.new_budget * 1_000_000)), // micros
      },
    };

    const res = await withRetry(() =>
      fetch(url, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${credentials.tokens.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      }),
    );

    const success = res.ok;

    return {
      success,
      platform: 'dv360',
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
    const url = `${DV360_URL}/advertisers/${credentials.account_id}/lineItems/${campaignId}`;
    const body = {
      entityStatus: 'ENTITY_STATUS_PAUSED',
    };

    const res = await withRetry(() =>
      fetch(url, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${credentials.tokens.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      }),
    );

    const success = res.ok;

    return {
      success,
      platform: 'dv360',
      operation: 'campaign_pause',
      target_id: campaignId,
      new_value: 'ENTITY_STATUS_PAUSED',
      timestamp: new Date().toISOString(),
      dry_run: false,
      error: success ? undefined : await res.text(),
    };
  }

  async enableCampaign(
    credentials: PlatformCredentials,
    campaignId: string,
  ): Promise<WriteResult> {
    const url = `${DV360_URL}/advertisers/${credentials.account_id}/lineItems/${campaignId}`;
    const body = {
      entityStatus: 'ENTITY_STATUS_ACTIVE',
    };

    const res = await withRetry(() =>
      fetch(url, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${credentials.tokens.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      }),
    );

    const success = res.ok;

    return {
      success,
      platform: 'dv360',
      operation: 'campaign_enable',
      target_id: campaignId,
      new_value: 'ENTITY_STATUS_ACTIVE',
      timestamp: new Date().toISOString(),
      dry_run: false,
      error: success ? undefined : await res.text(),
    };
  }

  async adjustBid(
    credentials: PlatformCredentials,
    params: BidAdjustParams,
  ): Promise<WriteResult> {
    const url = `${DV360_URL}/advertisers/${credentials.account_id}/lineItems/${params.ad_set_id}`;
    const body = {
      bidStrategy: {
        fixedBid: {
          bidAmountMicros: String(Math.round(params.new_bid * 1_000_000)),
        },
      },
    };

    const res = await withRetry(() =>
      fetch(url, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${credentials.tokens.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      }),
    );

    const success = res.ok;

    return {
      success,
      platform: 'dv360',
      operation: 'bid_adjustment',
      target_id: params.ad_set_id,
      new_value: params.new_bid,
      timestamp: new Date().toISOString(),
      dry_run: false,
      error: success ? undefined : await res.text(),
    };
  }
}
