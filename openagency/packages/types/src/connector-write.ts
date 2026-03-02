// ─── Platform Write Types ───────────────────────────────────────────

import type { ConnectorPlatform, PlatformConnector, PlatformCredentials } from './connector.js';

export type WriteOperation =
  | 'budget_update'
  | 'campaign_pause'
  | 'campaign_enable'
  | 'bid_adjustment';

export interface WriteResult {
  success: boolean;
  platform: ConnectorPlatform;
  operation: WriteOperation;
  target_id: string;
  previous_value?: unknown;
  new_value?: unknown;
  timestamp: string; // ISO 8601
  dry_run: boolean;
  error?: string;
}

export interface BudgetUpdateParams {
  campaign_id: string;
  new_budget: number;
  budget_type?: 'daily' | 'lifetime';
}

export interface BidAdjustParams {
  ad_set_id: string;
  new_bid: number;
  bid_strategy?: string;
}

export interface WritablePlatformConnector extends PlatformConnector {
  updateCampaignBudget(
    credentials: PlatformCredentials,
    params: BudgetUpdateParams,
  ): Promise<WriteResult>;

  pauseCampaign(
    credentials: PlatformCredentials,
    campaignId: string,
  ): Promise<WriteResult>;

  enableCampaign(
    credentials: PlatformCredentials,
    campaignId: string,
  ): Promise<WriteResult>;

  adjustBid(
    credentials: PlatformCredentials,
    params: BidAdjustParams,
  ): Promise<WriteResult>;
}

export type SafetyCheckStatus = 'passed' | 'failed' | 'skipped';

export interface SafetyCheckResult {
  gate: string;
  status: SafetyCheckStatus;
  reason?: string;
  metadata?: Record<string, unknown>;
}

export interface SafetyContext {
  current_budget: number;
  daily_spend_rate: number;
  campaign_status: string;
  agent_config: { max_budget_change_pct: number; approval_threshold_usd: number; dry_run: boolean };
  recent_writes: Array<{ operation: WriteOperation; timestamp: string; target_id: string }>;
}

export interface SafetyGate {
  readonly name: string;
  check(action: { type: WriteOperation; parameters: Record<string, unknown> }, context: SafetyContext): SafetyCheckResult;
}

export interface SafetyPipelineResult {
  approved: boolean;
  checks: SafetyCheckResult[];
}
