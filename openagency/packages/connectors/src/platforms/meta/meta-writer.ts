// ─── Meta Ads Writer ───────────────────────────────────────────────
// Extends MetaConnector with write operations: budget update, pause,
// enable, and bid adjustment. Uses Graph API v21.0 POST endpoints.
// Budget and bid values are sent in cents (Meta's micro-currency).

import type {
  PlatformCredentials,
  WritablePlatformConnector,
  WriteResult,
  BudgetUpdateParams,
  BidAdjustParams,
} from '@openagency/types';
import { MetaConnector, type MetaConnectorConfig } from './meta-connector.js';
import { withRetry } from '../../utils/retry.js';

const API_VERSION = 'v21.0';
const GRAPH_URL = `https://graph.facebook.com/${API_VERSION}`;

export class MetaWriter extends MetaConnector implements WritablePlatformConnector {
  constructor(config: MetaConnectorConfig) {
    super(config);
  }

  async updateCampaignBudget(
    credentials: PlatformCredentials,
    params: BudgetUpdateParams,
  ): Promise<WriteResult> {
    const url = `${GRAPH_URL}/${params.campaign_id}`;
    const budgetField = params.budget_type === 'lifetime' ? 'lifetime_budget' : 'daily_budget';
    const body = new URLSearchParams({
      [budgetField]: String(Math.round(params.new_budget * 100)), // Meta uses cents
      access_token: credentials.tokens.access_token,
    });

    const res = await withRetry(() => fetch(url, { method: 'POST', body }));
    const success = res.ok;

    return {
      success,
      platform: 'meta_ads',
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
    const url = `${GRAPH_URL}/${campaignId}`;
    const body = new URLSearchParams({
      status: 'PAUSED',
      access_token: credentials.tokens.access_token,
    });

    const res = await withRetry(() => fetch(url, { method: 'POST', body }));
    const success = res.ok;

    return {
      success,
      platform: 'meta_ads',
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
    const url = `${GRAPH_URL}/${campaignId}`;
    const body = new URLSearchParams({
      status: 'ACTIVE',
      access_token: credentials.tokens.access_token,
    });

    const res = await withRetry(() => fetch(url, { method: 'POST', body }));
    const success = res.ok;

    return {
      success,
      platform: 'meta_ads',
      operation: 'campaign_enable',
      target_id: campaignId,
      new_value: 'ACTIVE',
      timestamp: new Date().toISOString(),
      dry_run: false,
      error: success ? undefined : await res.text(),
    };
  }

  async adjustBid(
    credentials: PlatformCredentials,
    params: BidAdjustParams,
  ): Promise<WriteResult> {
    const url = `${GRAPH_URL}/${params.ad_set_id}`;
    const body = new URLSearchParams({
      bid_amount: String(Math.round(params.new_bid * 100)), // Meta uses cents
      access_token: credentials.tokens.access_token,
    });

    const res = await withRetry(() => fetch(url, { method: 'POST', body }));
    const success = res.ok;

    return {
      success,
      platform: 'meta_ads',
      operation: 'bid_adjustment',
      target_id: params.ad_set_id,
      new_value: params.new_bid,
      timestamp: new Date().toISOString(),
      dry_run: false,
      error: success ? undefined : await res.text(),
    };
  }
}
