// ─── Safety Pipeline + Write Registry Integration Test ──────────────
// End-to-end: SafetyPipeline.evaluate() → ConnectorWriteRegistry.executeWrite()
// Verifies that gate failures block the fetch and that approved writes execute.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ConnectorWriteRegistry } from '../write-registry.js';
import { SafetyPipeline } from '../safety/pipeline.js';
import { DryRunGate } from '../safety/dry-run-gate.js';
import { BudgetCapGate } from '../safety/budget-cap-gate.js';
import { DailyWriteLimitGate } from '../safety/daily-write-limit-gate.js';
import { RollbackTracker } from '../safety/rollback-tracker.js';
import type { PlatformCredentials, SafetyContext, WritablePlatformConnector, WriteResult, OAuthTokens } from '@openagency/types';

const mockFetch = vi.fn();

const validTokens: OAuthTokens = {
  access_token: 'tok',
  refresh_token: 'ref',
  token_type: 'Bearer',
  expires_at: Date.now() + 3_600_000,
};

const creds: PlatformCredentials = {
  platform: 'google_ads',
  tokens: validTokens,
  account_id: 'cust-1',
  connected_at: new Date().toISOString(),
};

const baseContext: SafetyContext = {
  current_budget: 10000,
  daily_spend_rate: 500,
  campaign_status: 'active',
  agent_config: { max_budget_change_pct: 20, approval_threshold_usd: 5000, dry_run: false },
  recent_writes: [],
};

// Minimal mock writer that records calls
function mockWriter(): WritablePlatformConnector {
  const ok: WriteResult = {
    success: true, platform: 'google_ads', operation: 'budget_update',
    target_id: 'c1', new_value: 11000, timestamp: new Date().toISOString(), dry_run: false,
  };
  return {
    platform: 'google_ads' as const,
    getAuthUrl: vi.fn(),
    exchangeCode: vi.fn(),
    refreshToken: vi.fn(),
    fetchAccounts: vi.fn(),
    fetchCampaigns: vi.fn(),
    updateCampaignBudget: vi.fn(async () => ok),
    pauseCampaign: vi.fn(async () => ({ ...ok, operation: 'campaign_pause' as const })),
    enableCampaign: vi.fn(async () => ({ ...ok, operation: 'campaign_enable' as const })),
    adjustBid: vi.fn(async () => ({ ...ok, operation: 'bid_adjustment' as const })),
  } as unknown as WritablePlatformConnector;
}

describe('Safety → Write Registry integration', () => {
  let registry: ConnectorWriteRegistry;
  let writer: WritablePlatformConnector;

  beforeEach(() => {
    vi.stubGlobal('fetch', mockFetch);
    mockFetch.mockReset();

    const pipeline = new SafetyPipeline([
      new DryRunGate(),
      new BudgetCapGate(),
      new DailyWriteLimitGate(),
      new RollbackTracker(),
    ]);
    registry = new ConnectorWriteRegistry(pipeline);
    writer = mockWriter();
    registry.registerWriter(writer);
  });
  afterEach(() => vi.unstubAllGlobals());

  it('approved write calls the writer', async () => {
    const result = await registry.executeWrite(
      { type: 'budget_update', platform: 'google_ads', parameters: { campaign_id: 'c1', new_budget: 11000 } },
      creds,
      baseContext,
    );

    expect(result.safety.approved).toBe(true);
    expect(result.result).toBeDefined();
    expect(result.result!.success).toBe(true);
    expect((writer.updateCampaignBudget as ReturnType<typeof vi.fn>)).toHaveBeenCalledOnce();
  });

  it('budget cap gate blocks excessive budget change', async () => {
    // 20% cap on 10000 = max 12000. Request 15000 → blocked
    const result = await registry.executeWrite(
      { type: 'budget_update', platform: 'google_ads', parameters: { campaign_id: 'c1', new_budget: 15000 } },
      creds,
      baseContext,
    );

    expect(result.safety.approved).toBe(false);
    expect(result.result).toBeUndefined();
    expect((writer.updateCampaignBudget as ReturnType<typeof vi.fn>)).not.toHaveBeenCalled();
  });

  it('dry run gate blocks when dry_run=true', async () => {
    const dryContext: SafetyContext = {
      ...baseContext,
      agent_config: { ...baseContext.agent_config, dry_run: true },
    };

    const result = await registry.executeWrite(
      { type: 'budget_update', platform: 'google_ads', parameters: { campaign_id: 'c1', new_budget: 11000 } },
      creds,
      dryContext,
    );

    expect(result.safety.approved).toBe(false);
    expect((writer.updateCampaignBudget as ReturnType<typeof vi.fn>)).not.toHaveBeenCalled();
  });

  it('daily write limit gate blocks after max writes', async () => {
    const heavyContext: SafetyContext = {
      ...baseContext,
      recent_writes: Array.from({ length: 50 }, (_, i) => ({
        operation: 'budget_update' as const,
        timestamp: new Date().toISOString(),
        target_id: `c${i}`,
      })),
    };

    const result = await registry.executeWrite(
      { type: 'budget_update', platform: 'google_ads', parameters: { campaign_id: 'c1', new_budget: 11000 } },
      creds,
      heavyContext,
    );

    expect(result.safety.approved).toBe(false);
    expect((writer.updateCampaignBudget as ReturnType<typeof vi.fn>)).not.toHaveBeenCalled();
  });

  it('rollback tracker metadata is included in safety checks', async () => {
    const result = await registry.executeWrite(
      { type: 'budget_update', platform: 'google_ads', parameters: { campaign_id: 'c1', new_budget: 11000 } },
      creds,
      baseContext,
    );

    const tracker = result.safety.checks.find((c) => c.gate === 'rollback_tracker');
    expect(tracker).toBeDefined();
    expect(tracker!.status).toBe('passed');
    expect(tracker!.metadata).toMatchObject({ previous_budget: 10000, new_budget: 11000 });
  });

  it('pause/enable pass through safety pipeline', async () => {
    const pauseResult = await registry.executeWrite(
      { type: 'campaign_pause', platform: 'google_ads', parameters: { campaign_id: 'c1' } },
      creds,
      baseContext,
    );
    expect(pauseResult.safety.approved).toBe(true);
    expect(pauseResult.result!.success).toBe(true);

    const enableResult = await registry.executeWrite(
      { type: 'campaign_enable', platform: 'google_ads', parameters: { campaign_id: 'c1' } },
      creds,
      { ...baseContext, campaign_status: 'paused' },
    );
    expect(enableResult.safety.approved).toBe(true);
    expect(enableResult.result!.success).toBe(true);
  });
});
