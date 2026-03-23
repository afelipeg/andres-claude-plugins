// ─── Data Pipeline E2E Tests ───────────────────────────────────────
// Full pipeline: ingestion → context assembly → engines → billing → HFL.
// Tests the complete data flow without external services (no DB, no LLM).

import { describe, it, expect, vi, beforeAll, beforeEach, afterEach } from 'vitest';
import { OpenAgency } from '@openagency/core';
import {
  LeakDetectorEngine,
  MediaArchitectEngine,
  CampaignOpsEngine,
  ExecutiveBridgeEngine,
} from '@openagency/engines';
import { calculateBillingFromEngines, type EngineOutputs } from '@openagency/core';
import {
  apiToWasteInput,
  apiToChannelInput,
  apiToOptimizationInput,
  apiToRevenueBridgeInput,
} from '@openagency/connectors';
import { InMemoryEventBus } from '@openagency/events';
import { HFLCoordinator, createDefaultConfig } from '@openagency/hfl';
import type { MeshRunSummary, HFLConfig } from '@openagency/hfl';
import type {
  NormalizedCampaignRow,
  SyncResult,
  ConnectorPlatform,
  EventBus,
  EngineEvent,
} from '@openagency/types';
import {
  assembleContextFromSync,
  validateSkillContext,
} from '../connectors/context-assembler.js';

// ─── Helpers ──────────────────────────────────────────────────────────

function makeRow(
  platform: ConnectorPlatform,
  campaignName: string,
  overrides?: Partial<NormalizedCampaignRow>,
): NormalizedCampaignRow {
  const spend = overrides?.spend ?? 50_000;
  const impressions = overrides?.impressions ?? 1_000_000;
  const clicks = overrides?.clicks ?? 20_000;
  const conversions = overrides?.conversions ?? 200;
  const revenue = overrides?.revenue ?? 150_000;

  return {
    campaign_name: campaignName,
    campaign_id: `${platform}_${campaignName.toLowerCase().replace(/\s+/g, '_')}`,
    platform,
    date: '2026-03-15',
    spend,
    impressions,
    clicks,
    conversions,
    revenue,
    ctr: clicks / impressions,
    cpc: spend / clicks,
    cpa: spend / conversions,
    roas: revenue / spend,
    ...overrides,
  };
}

function makeSyncResult(
  platform: ConnectorPlatform,
  rows: NormalizedCampaignRow[],
): SyncResult {
  return {
    platform,
    status: 'success',
    rows,
    row_count: rows.length,
    date_range: { start: '2026-02-15', end: '2026-03-15' },
    synced_at: new Date().toISOString(),
  };
}

function createMockEventBus(): EventBus {
  const events: EngineEvent[] = [];
  return {
    publish: vi.fn(async (event: EngineEvent) => { events.push(event); }),
    subscribe: vi.fn(() => () => {}),
    onAny: vi.fn(() => () => {}),
    _events: events,
  } as unknown as EventBus & { _events: EngineEvent[] };
}

// ─── Synthetic Data ───────────────────────────────────────────────────

const GOOGLE_ROWS: NormalizedCampaignRow[] = [
  makeRow('google_ads', 'Google Brand Search', { spend: 80_000, revenue: 320_000, impressions: 5_000_000, clicks: 100_000, conversions: 800 }),
  makeRow('google_ads', 'Google Performance Max', { spend: 120_000, revenue: 480_000, impressions: 8_000_000, clicks: 160_000, conversions: 1200 }),
];

const META_ROWS: NormalizedCampaignRow[] = [
  makeRow('meta_ads', 'Meta Retargeting', { spend: 60_000, revenue: 240_000, impressions: 4_000_000, clicks: 80_000, conversions: 600 }),
  makeRow('meta_ads', 'Meta Prospecting', { spend: 90_000, revenue: 270_000, impressions: 6_000_000, clicks: 90_000, conversions: 450 }),
];

const TIKTOK_ROWS: NormalizedCampaignRow[] = [
  makeRow('tiktok_ads', 'TikTok Awareness', { spend: 40_000, revenue: 120_000, impressions: 10_000_000, clicks: 200_000, conversions: 300 }),
];

// ─── Setup ────────────────────────────────────────────────────────────

let agency: OpenAgency;

beforeAll(() => {
  agency = new OpenAgency();
  agency.engines.register(new LeakDetectorEngine());
  agency.engines.register(new MediaArchitectEngine());
  agency.engines.register(new CampaignOpsEngine());
  agency.engines.register(new ExecutiveBridgeEngine());
});

// ─── Test 1: Context assembly with synthetic sync data ────────────────

describe('Context Assembly', () => {
  it('assembles context from 3 platforms with correct channels and campaigns', () => {
    const cache = new Map<string, SyncResult>();
    cache.set('test_agency:google_ads', makeSyncResult('google_ads', GOOGLE_ROWS));
    cache.set('test_agency:meta_ads', makeSyncResult('meta_ads', META_ROWS));
    cache.set('test_agency:tiktok_ads', makeSyncResult('tiktok_ads', TIKTOK_ROWS));

    const ctx = assembleContextFromSync(cache, undefined, 'test_agency');

    // Channels array: one entry per platform
    const channels = ctx.channels as Array<{ name: string; spend: number }>;
    expect(channels).toBeDefined();
    expect(channels.length).toBe(3);

    // Verify each channel has spend > 0 and name matches platform
    const channelNames = channels.map((c) => c.name);
    expect(channelNames).toContain('google_ads');
    expect(channelNames).toContain('meta_ads');
    expect(channelNames).toContain('tiktok_ads');

    for (const ch of channels) {
      expect(ch.spend).toBeGreaterThan(0);
    }

    // Campaigns array: one per unique campaign_id
    const campaigns = ctx.campaigns as Array<{ name: string; channel: string }>;
    expect(campaigns).toBeDefined();
    expect(campaigns.length).toBe(5); // 2 google + 2 meta + 1 tiktok

    // Source count via validation
    const validation = validateSkillContext(ctx);
    expect(validation.has_sync_data).toBe(true);
    expect(validation.source_count).toBeGreaterThanOrEqual(1);
    expect(validation.sync_platforms.length).toBe(3);
    expect(validation.gross_spend).toBeGreaterThan(0);
  });

  it('computes correct gross_spend as sum across all platforms', () => {
    const cache = new Map<string, SyncResult>();
    cache.set('test_agency:google_ads', makeSyncResult('google_ads', GOOGLE_ROWS));
    cache.set('test_agency:meta_ads', makeSyncResult('meta_ads', META_ROWS));
    cache.set('test_agency:tiktok_ads', makeSyncResult('tiktok_ads', TIKTOK_ROWS));

    const ctx = assembleContextFromSync(cache, undefined, 'test_agency');

    const expectedSpend = 80_000 + 120_000 + 60_000 + 90_000 + 40_000; // 390,000
    expect(ctx.gross_spend).toBe(expectedSpend);
  });
});

// ─── Test 2: Context assembly tenant isolation ────────────────────────

describe('Context Assembly Tenant Isolation', () => {
  it('returns only agency_a data when queried for agency_a', () => {
    const cache = new Map<string, SyncResult>();
    cache.set('agency_a:google_ads', makeSyncResult('google_ads', GOOGLE_ROWS));
    cache.set('agency_a:meta_ads', makeSyncResult('meta_ads', META_ROWS));
    cache.set('agency_b:tiktok_ads', makeSyncResult('tiktok_ads', TIKTOK_ROWS));
    cache.set('agency_b:google_ads', makeSyncResult('google_ads', [
      makeRow('google_ads', 'Agency B Campaign', { spend: 999_999 }),
    ]));

    const ctx = assembleContextFromSync(cache, undefined, 'agency_a');

    const channels = ctx.channels as Array<{ name: string; spend: number }>;
    const channelNames = channels.map((c) => c.name);

    // agency_a has google_ads and meta_ads
    expect(channelNames).toContain('google_ads');
    expect(channelNames).toContain('meta_ads');

    // agency_b's tiktok_ads should NOT appear
    expect(channelNames).not.toContain('tiktok_ads');

    // Verify spend does not include agency_b's data
    const googleChannel = channels.find((c) => c.name === 'google_ads')!;
    expect(googleChannel.spend).toBe(80_000 + 120_000); // only agency_a's google rows
    expect(googleChannel.spend).not.toBe(999_999);
  });

  it('returns empty context when agency has no synced data', () => {
    const cache = new Map<string, SyncResult>();
    cache.set('agency_b:google_ads', makeSyncResult('google_ads', GOOGLE_ROWS));

    const ctx = assembleContextFromSync(cache, undefined, 'agency_a');

    // No data for agency_a — should return empty
    expect(Object.keys(ctx).length).toBe(0);
  });
});

// ─── Test 3: Engine execution with assembled context ──────────────────

describe('Engine Execution with Assembled Context', () => {
  const allRows = [...GOOGLE_ROWS, ...META_ROWS, ...TIKTOK_ROWS];

  it('runs leak-detector with apiToWasteInput transform', async () => {
    const wasteInput = apiToWasteInput(allRows);

    expect(wasteInput.gross_spend).toBeGreaterThan(0);

    const result = await agency.run('leak-detector', 'waste-waterfall', wasteInput);

    expect(result.engine).toBe('leak-detector');
    expect(result.skill).toBe('waste-waterfall');
    expect(result.data).toBeDefined();
    expect(result.duration_ms).toBeGreaterThanOrEqual(0);

    const data = result.data as Record<string, unknown>;
    const summary = data['waste_summary'] as Record<string, unknown>;
    expect(summary).toBeDefined();
    expect(typeof summary['total_waste']).toBe('number');
  });

  it('runs media-architect with apiToChannelInput transform', async () => {
    const channelInput = apiToChannelInput(allRows);

    expect(channelInput.total_budget).toBeGreaterThan(0);
    expect(channelInput.channels.length).toBeGreaterThanOrEqual(1);

    const result = await agency.run('media-architect', 'mmm-optimize', channelInput);

    expect(result.engine).toBe('media-architect');
    expect(result.data).toBeDefined();

    const data = result.data as Record<string, unknown>;
    expect(data['scenarios']).toBeDefined();
  });

  it('runs campaign-ops with apiToOptimizationInput transform', async () => {
    const optInput = apiToOptimizationInput(allRows);

    expect(optInput.campaigns.length).toBe(allRows.length);

    const result = await agency.run('campaign-ops', 'optimization-analyze', optInput);

    expect(result.engine).toBe('campaign-ops');
    expect(result.data).toBeDefined();

    const data = result.data as Record<string, unknown>;
    expect(data['campaigns']).toBeDefined();
    expect(data['total_alerts']).toBeDefined();
  });

  it('runs executive-bridge with apiToRevenueBridgeInput transform', async () => {
    const revenueInput = apiToRevenueBridgeInput(allRows);

    expect(revenueInput.channels.length).toBe(allRows.length);

    const result = await agency.run('executive-bridge', 'revenue-translate', revenueInput);

    expect(result.engine).toBe('executive-bridge');
    expect(result.data).toBeDefined();
  });
});

// ─── Test 4: Full pipeline simulation ─────────────────────────────────

describe('Full Pipeline Simulation', () => {
  it('runs all 4 engines from assembled context and calculates billing', async () => {
    // Step 1: Populate sync cache
    const cache = new Map<string, SyncResult>();
    cache.set('acme:google_ads', makeSyncResult('google_ads', GOOGLE_ROWS));
    cache.set('acme:meta_ads', makeSyncResult('meta_ads', META_ROWS));
    cache.set('acme:tiktok_ads', makeSyncResult('tiktok_ads', TIKTOK_ROWS));

    // Step 2: Assemble context
    const ctx = assembleContextFromSync(cache, undefined, 'acme');
    const validation = validateSkillContext(ctx);
    expect(validation.has_sync_data).toBe(true);
    expect(validation.gross_spend).toBeGreaterThan(0);

    const allRows = [...GOOGLE_ROWS, ...META_ROWS, ...TIKTOK_ROWS];
    const grossSpend = validation.gross_spend;

    // Step 3: Transform and run all 4 engines
    const [leakResult, mmmResult, campaignResult, revenueResult] = await Promise.all([
      agency.run('leak-detector', 'waste-waterfall', apiToWasteInput(allRows)),
      agency.run('media-architect', 'mmm-optimize', apiToChannelInput(allRows)),
      agency.run('campaign-ops', 'optimization-analyze', apiToOptimizationInput(allRows)),
      agency.run('executive-bridge', 'revenue-translate', apiToRevenueBridgeInput(allRows)),
    ]);

    // All engines produced data
    expect(leakResult.data).toBeDefined();
    expect(mmmResult.data).toBeDefined();
    expect(campaignResult.data).toBeDefined();
    expect(revenueResult.data).toBeDefined();

    // Step 4: Calculate billing
    const engineOutputs: EngineOutputs = {
      ad_spend: grossSpend,
      leak_detector: {
        waste_waterfall: leakResult.data as Record<string, unknown>,
      },
      media_architect: {
        mmm_optimize: mmmResult.data as Record<string, unknown>,
      },
      campaign_ops: {
        optimization_analyze: campaignResult.data as Record<string, unknown>,
      },
      executive_bridge: {
        revenue_translate: revenueResult.data as Record<string, unknown>,
      },
    };

    const billing = calculateBillingFromEngines(engineOutputs);

    expect(billing.ad_spend).toBe(grossSpend);
    expect(billing.tier).toBeDefined();
    expect(billing.tier.label).toBeDefined();
    expect(billing.total_fee).toBeGreaterThanOrEqual(0);
    expect(billing.fee_as_pct_of_spend).toBeGreaterThanOrEqual(0);

    // Fee breakdown consistency
    expect(billing.total_fee).toBeCloseTo(
      billing.recovery_fee.fee + billing.lift_fee.fee + billing.efficiency_fee.fee,
      0,
    );
  });
});

// ─── Test 5: Sync persistence roundtrip ───────────────────────────────

describe('Sync Persistence Roundtrip (mock)', () => {
  it('preserves row_count, date_range, and rows through cache roundtrip', () => {
    // Simulate writing to sync_results cache (in-memory equivalent of DB)
    const cache = new Map<string, SyncResult>();
    const originalRows = GOOGLE_ROWS;
    const syncResult = makeSyncResult('google_ads', originalRows);

    // Write
    const compositeKey = 'persist_test:google_ads';
    cache.set(compositeKey, syncResult);

    // Read back
    const retrieved = cache.get(compositeKey);
    expect(retrieved).toBeDefined();
    expect(retrieved!.row_count).toBe(originalRows.length);
    expect(retrieved!.date_range.start).toBe('2026-02-15');
    expect(retrieved!.date_range.end).toBe('2026-03-15');
    expect(retrieved!.rows).toHaveLength(originalRows.length);

    // Verify row data integrity
    for (let i = 0; i < originalRows.length; i++) {
      expect(retrieved!.rows[i].campaign_name).toBe(originalRows[i].campaign_name);
      expect(retrieved!.rows[i].spend).toBe(originalRows[i].spend);
      expect(retrieved!.rows[i].platform).toBe(originalRows[i].platform);
    }
  });

  it('supports composite key lookup by agency + platform', () => {
    const cache = new Map<string, SyncResult>();

    cache.set('agency_x:google_ads', makeSyncResult('google_ads', GOOGLE_ROWS));
    cache.set('agency_x:meta_ads', makeSyncResult('meta_ads', META_ROWS));
    cache.set('agency_y:google_ads', makeSyncResult('google_ads', [
      makeRow('google_ads', 'Agency Y Campaign', { spend: 777 }),
    ]));

    // Lookup agency_x:google_ads
    const xGoogle = cache.get('agency_x:google_ads');
    expect(xGoogle).toBeDefined();
    expect(xGoogle!.rows[0].spend).toBe(80_000);

    // Lookup agency_y:google_ads
    const yGoogle = cache.get('agency_y:google_ads');
    expect(yGoogle).toBeDefined();
    expect(yGoogle!.rows[0].spend).toBe(777);

    // Assembly scoped to agency_x
    const ctx = assembleContextFromSync(cache, undefined, 'agency_x');
    const channels = ctx.channels as Array<{ name: string; spend: number }>;
    expect(channels.length).toBe(2); // google_ads + meta_ads
    expect(channels.find((c) => c.name === 'google_ads')!.spend).toBe(80_000 + 120_000);
  });

  it('serializes and deserializes rows via JSON (simulates DB rows_json column)', () => {
    const originalRows = [...GOOGLE_ROWS, ...META_ROWS];
    const serialized = JSON.stringify(originalRows);
    const deserialized: NormalizedCampaignRow[] = JSON.parse(serialized);

    expect(deserialized).toHaveLength(originalRows.length);

    for (let i = 0; i < originalRows.length; i++) {
      expect(deserialized[i].campaign_name).toBe(originalRows[i].campaign_name);
      expect(deserialized[i].spend).toBe(originalRows[i].spend);
      expect(deserialized[i].impressions).toBe(originalRows[i].impressions);
      expect(deserialized[i].clicks).toBe(originalRows[i].clicks);
      expect(deserialized[i].conversions).toBe(originalRows[i].conversions);
      expect(deserialized[i].revenue).toBe(originalRows[i].revenue);
      expect(deserialized[i].ctr).toBeCloseTo(originalRows[i].ctr, 10);
      expect(deserialized[i].roas).toBeCloseTo(originalRows[i].roas, 10);
    }
  });
});

// ─── Test 6: HFL evaluation trigger ──────────────────────────────────

describe('HFL Evaluation Trigger', () => {
  let eventBus: EventBus;
  let mockFetch: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    eventBus = createMockEventBus();
    mockFetch = vi.fn().mockResolvedValue(new Response('OK', { status: 200 }));
    vi.stubGlobal('fetch', mockFetch);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  function makeHFLConfig(overrides?: Partial<HFLConfig>): HFLConfig {
    return {
      client_id: 'pipeline-test-client',
      auto_approve_threshold: 50_000,
      channels: [
        { id: 'webhook-1', type: 'webhook', url: 'https://hooks.example.com/test', render_level: 'rich', active: true },
      ],
      default_channel: 'webhook-1',
      escalation_rules: [],
      timeout_ms: 0,
      ...overrides,
    };
  }

  function makeMeshRun(overrides?: Partial<MeshRunSummary>): MeshRunSummary {
    return {
      id: 'pipeline-run-1',
      pipeline_id: 'full-optimization',
      status: 'completed',
      total_duration_ms: 3500,
      client_id: 'pipeline-test-client',
      stage_results: {
        'leak-detector': { agent_id: 'leak-detector', status: 'completed', duration_ms: 1000, skills_invoked: ['waste-waterfall'] },
        'media-architect': { agent_id: 'media-architect', status: 'completed', duration_ms: 800, skills_invoked: ['mmm-optimize'] },
        'campaign-ops': { agent_id: 'campaign-ops', status: 'completed', duration_ms: 900, skills_invoked: ['optimization-analyze'] },
        'executive-bridge': { agent_id: 'exec-bridge', status: 'completed', duration_ms: 800, skills_invoked: ['revenue-translate'] },
      },
      ...overrides,
    };
  }

  it('evaluates a mesh run and produces a decision', async () => {
    const hfl = new HFLCoordinator(eventBus, { base_url: 'http://test:3100' });
    hfl.setConfig(makeHFLConfig());

    const decision = await hfl.evaluate(makeMeshRun());

    expect(decision).toBeDefined();
    expect(decision.id).toBeDefined();
    expect(decision.run_id).toBe('pipeline-run-1');
    expect(decision.pipeline_id).toBe('full-optimization');
    expect(decision.client_id).toBe('pipeline-test-client');
    expect(['auto_approved', 'escalated']).toContain(decision.status);
    expect(decision.risk_score).toBeDefined();
    expect(decision.created_at).toBeDefined();
  });

  it('escalates first run then auto-approves second', async () => {
    const hfl = new HFLCoordinator(eventBus, { base_url: 'http://test:3100' });
    hfl.setConfig(makeHFLConfig({ auto_approve_threshold: 999_999 }));

    // First run: always escalated (is_first_run = true)
    const first = await hfl.evaluate(makeMeshRun());
    expect(first.status).toBe('escalated');
    expect(first.needs_human).toBe(true);

    // Approve the first run so it's no longer pending
    await hfl.approveRun('pipeline-run-1');

    // Second run: should auto-approve
    const second = await hfl.evaluate(makeMeshRun({ id: 'pipeline-run-2' }));
    expect(second.status).toBe('auto_approved');
    expect(second.needs_human).toBe(false);
  });

  it('records human approval with feedback', async () => {
    const hfl = new HFLCoordinator(eventBus, { base_url: 'http://test:3100' });
    hfl.setConfig(makeHFLConfig());

    const decision = await hfl.evaluate(makeMeshRun());
    expect(decision.status).toBe('escalated');

    // Simulate human approval
    const approved = await hfl.approveRun('pipeline-run-1', 'Looks good, proceed');

    expect(approved).toBeDefined();
    expect(approved!.status).toBe('human_approved');
    expect(approved!.human_response).toBe('approved');
    expect(approved!.human_feedback).toBe('Looks good, proceed');
    expect(approved!.resolved_at).toBeDefined();
  });

  it('records human rejection with feedback', async () => {
    const hfl = new HFLCoordinator(eventBus, { base_url: 'http://test:3100' });
    hfl.setConfig(makeHFLConfig());

    await hfl.evaluate(makeMeshRun());

    const rejected = await hfl.rejectRun('pipeline-run-1', 'Budget too high');

    expect(rejected).toBeDefined();
    expect(rejected!.status).toBe('human_rejected');
    expect(rejected!.human_response).toBe('rejected');
    expect(rejected!.human_feedback).toBe('Budget too high');
  });

  it('lists pending decisions correctly', async () => {
    const hfl = new HFLCoordinator(eventBus, { base_url: 'http://test:3100' });
    hfl.setConfig(makeHFLConfig());

    await hfl.evaluate(makeMeshRun({ id: 'run-a', client_id: 'pipeline-test-client' }));

    const pending = hfl.listPending();
    expect(pending.length).toBeGreaterThanOrEqual(1);
    expect(pending.some((d) => d.run_id === 'run-a')).toBe(true);
  });

  it('emits events through the event bus during evaluation', async () => {
    const hfl = new HFLCoordinator(eventBus, { base_url: 'http://test:3100' });
    hfl.setConfig(makeHFLConfig());

    await hfl.evaluate(makeMeshRun());

    expect(eventBus.publish).toHaveBeenCalled();
  });
});

// ─── Test 7: Transform bridge correctness ─────────────────────────────

describe('API-to-Engine Transform Bridge', () => {
  const allRows = [...GOOGLE_ROWS, ...META_ROWS, ...TIKTOK_ROWS];

  it('apiToWasteInput aggregates total spend correctly', () => {
    const result = apiToWasteInput(allRows);
    const expectedSpend = allRows.reduce((s, r) => s + r.spend, 0);
    expect(result.gross_spend).toBe(Math.round(expectedSpend * 100) / 100);
    expect(result.industry).toBe('retail');
  });

  it('apiToChannelInput creates one channel per campaign', () => {
    const result = apiToChannelInput(allRows);
    expect(result.channels.length).toBe(5); // 5 unique campaign names
    expect(result.total_budget).toBeGreaterThan(0);

    // Verify total_budget equals sum of channel spends
    const sumSpends = result.channels.reduce((s, c) => s + c.spend, 0);
    expect(Math.abs(result.total_budget - sumSpends)).toBeLessThan(1);
  });

  it('apiToOptimizationInput maps all rows to campaigns', () => {
    const result = apiToOptimizationInput(allRows, { cpa_target: 120, roas_target: 3.5 });
    expect(result.campaigns.length).toBe(allRows.length);

    for (const campaign of result.campaigns) {
      expect(campaign['cpa_target']).toBe(120);
      expect(campaign['roas_target']).toBe(3.5);
      expect(campaign['spend']).toBeGreaterThan(0);
    }
  });

  it('apiToRevenueBridgeInput includes revenue only when positive', () => {
    const rowsWithZeroRevenue = [
      makeRow('google_ads', 'Zero Revenue Campaign', { spend: 10_000, revenue: 0 }),
      makeRow('meta_ads', 'Has Revenue', { spend: 20_000, revenue: 80_000 }),
    ];

    const result = apiToRevenueBridgeInput(rowsWithZeroRevenue);
    expect(result.channels.length).toBe(2);

    const zeroRevChannel = result.channels.find((c) => c.name === 'Zero Revenue Campaign');
    expect(zeroRevChannel).toBeDefined();
    expect(zeroRevChannel!.revenue).toBeUndefined();

    const hasRevChannel = result.channels.find((c) => c.name === 'Has Revenue');
    expect(hasRevChannel).toBeDefined();
    expect(hasRevChannel!.revenue).toBe(80_000);
  });
});

// ─── Test 8: Context validation ───────────────────────────────────────

describe('Context Validation', () => {
  it('returns correct warnings when no data sources exist', () => {
    const validation = validateSkillContext({});

    expect(validation.source_count).toBe(0);
    expect(validation.has_sync_data).toBe(false);
    expect(validation.has_batch_data).toBe(false);
    expect(validation.has_mcp_data).toBe(false);
    expect(validation.warnings.some((w) => w.includes('NO_DATA_SOURCES'))).toBe(true);
  });

  it('detects sync data and explicit context as separate sources', () => {
    const cache = new Map<string, SyncResult>();
    cache.set('v:google_ads', makeSyncResult('google_ads', GOOGLE_ROWS));

    const ctx = assembleContextFromSync(cache, { custom_field: 'test' }, 'v');
    const validation = validateSkillContext(ctx);

    expect(validation.has_sync_data).toBe(true);
    expect(validation.has_explicit_context).toBe(true);
    expect(validation.source_count).toBeGreaterThanOrEqual(2); // sync + explicit
  });

  it('reports gross_spend correctly', () => {
    const cache = new Map<string, SyncResult>();
    cache.set('sp:meta_ads', makeSyncResult('meta_ads', META_ROWS));

    const ctx = assembleContextFromSync(cache, undefined, 'sp');
    const validation = validateSkillContext(ctx);

    const expectedSpend = META_ROWS.reduce((s, r) => s + r.spend, 0);
    expect(validation.gross_spend).toBe(expectedSpend);
  });
});
