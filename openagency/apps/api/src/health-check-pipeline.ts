// ─── Pipeline Health Check ──────────────────────────────────────────
// Validates the entire Plinth data pipeline end-to-end:
//   Stage 1: Infrastructure (DB, Redis, tables, env vars)
//   Stage 2: Connector & Sync (connections, freshness, decrypt)
//   Stage 3: Context Assembly (sync → skillContext)
//   Stage 4: Engine Health (5 engines, primary skills, synthetic data)
//   Stage 5: HFL (config, pending decisions, last eval)
//   Stage 6: Pipeline Integration (mini mesh, billing, events)
//
// Importable as a module or callable as GET /v1/health/pipeline.

import { createLogger } from '@openagency/core';
import type { OpenAgency } from '@openagency/core';
import type { HFLCoordinator } from '@openagency/hfl';
import type { EventBus, EngineEventType } from '@openagency/types';
import type { ConnectorInfra } from './connectors/setup.js';

const log = createLogger('health-check');

// ─── Types ──────────────────────────────────────────────────────────

export interface CheckResult {
  name: string;
  status: 'pass' | 'warn' | 'fail';
  message: string;
  details?: unknown;
}

export interface StageResult {
  name: string;
  status: 'pass' | 'warn' | 'fail';
  duration_ms: number;
  checks: CheckResult[];
}

export interface HealthCheckResult {
  status: 'healthy' | 'degraded' | 'critical';
  timestamp: string;
  stages: StageResult[];
  summary: {
    total_checks: number;
    passed: number;
    warnings: number;
    failures: number;
  };
}

// ─── Deps interface (injected from app.ts context) ──────────────────

export interface HealthCheckDeps {
  db: unknown | null;
  agency: OpenAgency;
  eventBus: EventBus;
  connectorInfra: ConnectorInfra;
  hfl: HFLCoordinator;
  agencyId?: string; // test agency for context assembly
}

// ─── Helpers ────────────────────────────────────────────────────────

type DbLike = { unsafe: (q: string, params?: unknown[]) => Promise<unknown[]> };

async function timed<T>(fn: () => Promise<T>): Promise<{ result: T; duration_ms: number }> {
  const start = Date.now();
  const result = await fn();
  return { result, duration_ms: Date.now() - start };
}

function stageStatus(checks: CheckResult[]): 'pass' | 'warn' | 'fail' {
  if (checks.some((c) => c.status === 'fail')) return 'fail';
  if (checks.some((c) => c.status === 'warn')) return 'warn';
  return 'pass';
}

// ─── Stage 1: Infrastructure ────────────────────────────────────────

async function checkInfrastructure(db: unknown | null): Promise<StageResult> {
  const { result: checks, duration_ms } = await timed(async () => {
    const results: CheckResult[] = [];

    // 1a. Required env vars
    const requiredEnvVars = ['DATABASE_URL', 'ENCRYPTION_KEY', 'CREDENTIAL_PASSPHRASE'];
    for (const envVar of requiredEnvVars) {
      const present = !!process.env[envVar];
      results.push({
        name: `env:${envVar}`,
        status: present ? 'pass' : 'fail',
        message: present ? `${envVar} is set` : `${envVar} is missing`,
      });
    }

    // 1b. PostgreSQL connection
    if (!db) {
      results.push({
        name: 'postgresql:connection',
        status: 'fail',
        message: 'No database connection available',
      });
      return results;
    }

    const sql = db as DbLike;
    try {
      const rows = await sql.unsafe('SELECT 1 AS ok');
      results.push({
        name: 'postgresql:connection',
        status: rows.length > 0 ? 'pass' : 'fail',
        message: rows.length > 0 ? 'PostgreSQL connected and responsive' : 'PostgreSQL query returned no results',
      });
    } catch (err) {
      results.push({
        name: 'postgresql:connection',
        status: 'fail',
        message: `PostgreSQL connection failed: ${err instanceof Error ? err.message : String(err)}`,
      });
    }

    // 1c. Redis connection
    try {
      const redisUrl = process.env['REDIS_URL'];
      if (!redisUrl) {
        results.push({
          name: 'redis:connection',
          status: 'warn',
          message: 'REDIS_URL not set — using in-memory event bus',
        });
      } else {
        // Dynamic import — ioredis may or may not be installed
        try {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const modName = 'ioredis'; const mod: any = await import(modName);
          const Redis = mod.default ?? mod;
          const client = new Redis(redisUrl, {
            connectTimeout: 5000,
            maxRetriesPerRequest: 1,
            lazyConnect: true,
          });
          await client.connect();
          const pong: string = await client.ping();
          await client.quit();
          results.push({
            name: 'redis:connection',
            status: pong === 'PONG' ? 'pass' : 'warn',
            message: pong === 'PONG' ? 'Redis connected and responsive' : `Redis returned: ${pong}`,
          });
        } catch (redisErr) {
          results.push({
            name: 'redis:connection',
            status: 'warn',
            message: `Redis connection failed: ${redisErr instanceof Error ? redisErr.message : String(redisErr)}`,
          });
        }
      }
    } catch {
      results.push({
        name: 'redis:connection',
        status: 'warn',
        message: 'Redis check skipped (ioredis not available)',
      });
    }

    // 1d. Required tables exist
    const requiredTables = [
      'agency_connections',
      'sync_results',
      'agent_state',
      'decisions',
      'action_log',
      'outcomes',
      'goals',
      'agent_memory',
      'delivery_files',
      'mcp_connections',
      'users',
    ];

    try {
      const tableRows = await sql.unsafe(
        `SELECT table_name FROM information_schema.tables
         WHERE table_schema = 'public' AND table_type = 'BASE TABLE'`,
      );
      const existingTables = new Set(
        (tableRows as Array<{ table_name: string }>).map((r) => r.table_name),
      );

      for (const table of requiredTables) {
        const exists = existingTables.has(table);
        results.push({
          name: `table:${table}`,
          status: exists ? 'pass' : 'fail',
          message: exists ? `Table '${table}' exists` : `Table '${table}' is MISSING`,
        });
      }
    } catch (err) {
      results.push({
        name: 'tables:check',
        status: 'fail',
        message: `Failed to query information_schema: ${err instanceof Error ? err.message : String(err)}`,
      });
    }

    return results;
  });

  return { name: 'Infrastructure', status: stageStatus(checks), duration_ms, checks };
}

// ─── Stage 2: Connector & Sync ──────────────────────────────────────

async function checkConnectorSync(
  db: unknown | null,
  connectorInfra: ConnectorInfra,
): Promise<StageResult> {
  const { result: checks, duration_ms } = await timed(async () => {
    const results: CheckResult[] = [];

    if (!db) {
      results.push({
        name: 'connectors:db',
        status: 'warn',
        message: 'No database — skipping connector checks',
      });
      return results;
    }

    const sql = db as DbLike;

    // 2a. List connected agency_connections
    try {
      const connRows = await sql.unsafe(
        `SELECT id, agency_id, platform, status, created_at
         FROM agency_connections WHERE status = 'connected' ORDER BY connected_at DESC LIMIT 50`,
      );
      const connections = connRows as Array<Record<string, unknown>>;
      results.push({
        name: 'connectors:connected',
        status: connections.length > 0 ? 'pass' : 'warn',
        message: `${connections.length} connected agency connection(s)`,
        details: connections.map((c) => ({
          id: c['id'],
          agency_id: c['agency_id'],
          platform: c['platform'],
        })),
      });

      // 2b. Check sync freshness for each connection
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
      for (const conn of connections.slice(0, 10)) {
        const platform = conn['platform'] as string;
        const agencyId = conn['agency_id'] as string;
        try {
          const syncRows = await sql.unsafe(
            `SELECT synced_at, status, row_count FROM sync_results
             WHERE agency_id = $1 AND platform = $2
             ORDER BY synced_at DESC LIMIT 1`,
            [agencyId, platform],
          );
          if (syncRows.length === 0) {
            results.push({
              name: `sync:${platform}:${agencyId?.slice(0, 8)}`,
              status: 'warn',
              message: `No sync data for ${platform} (agency ${agencyId?.slice(0, 8)}...)`,
            });
          } else {
            const row = syncRows[0] as Record<string, unknown>;
            const syncedAt = String(row['synced_at']);
            const isStale = syncedAt < sevenDaysAgo;
            results.push({
              name: `sync:${platform}:${agencyId?.slice(0, 8)}`,
              status: isStale ? 'warn' : 'pass',
              message: isStale
                ? `Sync stale for ${platform}: last sync ${syncedAt}`
                : `Sync fresh for ${platform}: ${row['row_count']} rows at ${syncedAt}`,
              details: { synced_at: syncedAt, row_count: row['row_count'], status: row['status'] },
            });
          }
        } catch {
          results.push({
            name: `sync:${platform}:${agencyId?.slice(0, 8)}`,
            status: 'warn',
            message: `Failed to query sync_results for ${platform}`,
          });
        }
      }
    } catch (err) {
      results.push({
        name: 'connectors:query',
        status: 'warn',
        message: `Failed to query agency_connections: ${err instanceof Error ? err.message : String(err)}`,
      });
    }

    // 2c. Check credential decryption
    try {
      const encKey = process.env['ENCRYPTION_KEY'];
      if (!encKey) {
        results.push({
          name: 'credentials:decrypt',
          status: 'warn',
          message: 'ENCRYPTION_KEY not set — cannot verify credential decryption',
        });
      } else {
        const credRows = await sql.unsafe(
          `SELECT id, platform, credentials FROM agency_connections WHERE status = 'connected' LIMIT 3`,
        );
        if ((credRows as unknown[]).length === 0) {
          results.push({
            name: 'credentials:decrypt',
            status: 'pass',
            message: 'No stored credentials to verify (this is fine for fresh installs)',
          });
        } else {
          let decryptOk = 0;
          let decryptFail = 0;
          const { decrypt } = await import('@openagency/memory');
          for (const row of credRows as Array<Record<string, unknown>>) {
            try {
              const encrypted = row['credentials'] as string;
              if (encrypted) {
                decrypt(encrypted, encKey);
                decryptOk++;
              }
            } catch {
              decryptFail++;
            }
          }
          results.push({
            name: 'credentials:decrypt',
            status: decryptFail > 0 ? 'warn' : 'pass',
            message:
              decryptFail > 0
                ? `${decryptFail}/${decryptOk + decryptFail} credentials failed decryption`
                : `${decryptOk} credential(s) decrypted successfully`,
          });
        }
      }
    } catch (err) {
      results.push({
        name: 'credentials:decrypt',
        status: 'warn',
        message: `Credential check error: ${err instanceof Error ? err.message : String(err)}`,
      });
    }

    // 2d. Sync result cache size
    const cacheSize = connectorInfra.syncResultCache.size;
    results.push({
      name: 'sync:cache',
      status: cacheSize > 0 ? 'pass' : 'warn',
      message: `Sync result cache has ${cacheSize} entries`,
    });

    return results;
  });

  return { name: 'Connector & Sync', status: stageStatus(checks), duration_ms, checks };
}

// ─── Stage 3: Context Assembly ──────────────────────────────────────

async function checkContextAssembly(
  connectorInfra: ConnectorInfra,
  db: unknown | null,
  agencyId?: string,
): Promise<StageResult> {
  const { result: checks, duration_ms } = await timed(async () => {
    const results: CheckResult[] = [];

    try {
      const { assembleContextFromSyncWithDbFallback, validateSkillContext } = await import(
        './connectors/context-assembler.js'
      );
      const testAgencyId = agencyId ?? 'health-check-test';
      const ctx = await assembleContextFromSyncWithDbFallback(
        connectorInfra.syncResultCache,
        db,
        undefined,
        testAgencyId,
      );

      const hasChannels = Array.isArray(ctx.channels) && (ctx.channels as unknown[]).length > 0;
      const hasCampaigns = Array.isArray(ctx.campaigns) && (ctx.campaigns as unknown[]).length > 0;
      const hasGrossSpend = typeof ctx.gross_spend === 'number' && (ctx.gross_spend as number) > 0;

      // For a test agency, empty is expected. Check if cache has ANY real data.
      const cacheHasData = connectorInfra.syncResultCache.size > 0;

      if (!hasChannels && !hasCampaigns && !hasGrossSpend) {
        results.push({
          name: 'context:assembly',
          status: cacheHasData ? 'warn' : 'pass',
          message: cacheHasData
            ? `Context assembly returned empty for agency '${testAgencyId}' despite cache having data`
            : 'Context assembly returned empty (no sync data in cache — expected for test agency)',
        });
      } else {
        results.push({
          name: 'context:assembly',
          status: 'pass',
          message: `Context assembled: ${(ctx.channels as unknown[])?.length ?? 0} channels, ${(ctx.campaigns as unknown[])?.length ?? 0} campaigns, gross_spend=$${ctx.gross_spend ?? 0}`,
          details: {
            channels: (ctx.channels as unknown[])?.length ?? 0,
            campaigns: (ctx.campaigns as unknown[])?.length ?? 0,
            gross_spend: ctx.gross_spend ?? 0,
          },
        });
      }

      // Validation check
      const validation = validateSkillContext(ctx);
      results.push({
        name: 'context:validation',
        status: validation.source_count > 0 ? 'pass' : 'warn',
        message: `source_count=${validation.source_count}, warnings: ${validation.warnings?.length ?? 0}`,
        details: validation,
      });
    } catch (err) {
      results.push({
        name: 'context:assembly',
        status: 'fail',
        message: `Context assembly failed: ${err instanceof Error ? err.message : String(err)}`,
      });
    }

    return results;
  });

  return { name: 'Context Assembly', status: stageStatus(checks), duration_ms, checks };
}

// ─── Stage 4: Engine Health ─────────────────────────────────────────

const SYNTHETIC_TEST_DATA: Record<string, unknown> = {
  gross_spend: 100_000,
  ad_spend: 100_000,
  channels: [
    { name: 'google_ads', spend: 40_000, impressions: 2_000_000, clicks: 80_000, conversions: 1_200, revenue: 120_000 },
    { name: 'meta_ads', spend: 35_000, impressions: 3_500_000, clicks: 105_000, conversions: 900, revenue: 85_000 },
    { name: 'dv360', spend: 25_000, impressions: 5_000_000, clicks: 50_000, conversions: 300, revenue: 30_000, ivt_rate_pct: 12, viewability_pct: 55 },
  ],
  campaigns: [
    { name: 'Brand Awareness Q1', channel: 'google_ads', spend: 20_000, budget: 25_000, days_elapsed: 30, cpa_target: 25, roas_target: 3.0, roas: 2.8, historical_ctr: 0.04 },
    { name: 'Performance Max', channel: 'meta_ads', spend: 35_000, budget: 40_000, days_elapsed: 30, cpa_target: 30, roas_target: 2.5, roas: 2.2, historical_ctr: 0.03 },
  ],
};

const ENGINE_SKILLS: Array<{ engineId: string; skillId: string }> = [
  { engineId: 'leak-detector', skillId: 'waste-waterfall' },
  { engineId: 'media-architect', skillId: 'mmm-optimize' },
  { engineId: 'campaign-ops', skillId: 'optimization-analyze' },
  { engineId: 'executive-bridge', skillId: 'revenue-translate' },
  { engineId: 'delivery', skillId: 'monthly-report' },
];

async function checkEngines(agency: OpenAgency): Promise<StageResult> {
  const { result: checks, duration_ms } = await timed(async () => {
    const results: CheckResult[] = [];

    // 4a. Check engine registration
    const engines = agency.listEngines();
    const engineIds = new Set(engines.map((e) => e.id));
    const expectedEngines = ['leak-detector', 'media-architect', 'campaign-ops', 'executive-bridge', 'delivery'];

    for (const expected of expectedEngines) {
      results.push({
        name: `engine:registered:${expected}`,
        status: engineIds.has(expected) ? 'pass' : 'fail',
        message: engineIds.has(expected) ? `Engine '${expected}' is registered` : `Engine '${expected}' is NOT registered`,
      });
    }

    results.push({
      name: 'engines:total',
      status: engines.length >= 5 ? 'pass' : 'warn',
      message: `${engines.length} engine(s) registered, ${engines.reduce((n, e) => n + e.skills.length, 0)} total skills`,
    });

    // 4b. Run primary skill for each analysis engine with synthetic data
    for (const { engineId, skillId } of ENGINE_SKILLS) {
      if (!engineIds.has(engineId)) {
        results.push({
          name: `engine:run:${engineId}:${skillId}`,
          status: 'fail',
          message: `Cannot run ${skillId} — engine '${engineId}' not registered`,
        });
        continue;
      }

      // Use a per-engine timeout to avoid hanging the entire check
      try {
        const runPromise = agency.run(engineId, skillId, { ...SYNTHETIC_TEST_DATA });
        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Skill execution timed out after 15s')), 15_000),
        );
        const result = (await Promise.race([runPromise, timeoutPromise])) as Record<string, unknown>;

        // Check result shape — agency.run returns { engine, skill, data, timestamp, duration_ms }
        const hasData = result && (result.data !== undefined || result.engine !== undefined);
        results.push({
          name: `engine:run:${engineId}:${skillId}`,
          status: hasData ? 'pass' : 'warn',
          message: hasData
            ? `${engineId}/${skillId} executed in ${result.duration_ms ?? '?'}ms`
            : `${engineId}/${skillId} returned unexpected shape`,
          details: {
            duration_ms: result?.duration_ms,
            has_data: !!result?.data,
          },
        });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        // Engines gracefully degrade without LLM — a known non-critical error
        const isLlmMissing = msg.includes('API key') || msg.includes('LLM') || msg.includes('ANTHROPIC');
        results.push({
          name: `engine:run:${engineId}:${skillId}`,
          status: isLlmMissing ? 'warn' : 'fail',
          message: isLlmMissing
            ? `${engineId}/${skillId} skipped: no LLM API key configured`
            : `${engineId}/${skillId} failed: ${msg}`,
        });
      }
    }

    return results;
  });

  return { name: 'Engine Health', status: stageStatus(checks), duration_ms, checks };
}

// ─── Stage 5: HFL Health ────────────────────────────────────────────

async function checkHFL(hfl: HFLCoordinator, db: unknown | null): Promise<StageResult> {
  const { result: checks, duration_ms } = await timed(async () => {
    const results: CheckResult[] = [];

    // 5a. HFL config
    try {
      const config = hfl.getConfig('default');
      results.push({
        name: 'hfl:config',
        status: config ? 'pass' : 'warn',
        message: config ? 'HFL default config exists' : 'No HFL config for default client',
        details: config
          ? {
              auto_approve_threshold: config.auto_approve_threshold,
              timeout_ms: config.timeout_ms,
            }
          : undefined,
      });
    } catch (err) {
      results.push({
        name: 'hfl:config',
        status: 'warn',
        message: `HFL config check failed: ${err instanceof Error ? err.message : String(err)}`,
      });
    }

    // 5b. Pending decisions
    try {
      const pending = hfl.listPending();
      results.push({
        name: 'hfl:pending',
        status: 'pass',
        message: `${pending.length} pending HFL decision(s) in memory`,
        details: { count: pending.length },
      });
    } catch (err) {
      results.push({
        name: 'hfl:pending',
        status: 'warn',
        message: `Failed to list pending decisions: ${err instanceof Error ? err.message : String(err)}`,
      });
    }

    // 5c. Last evaluation timestamp from DB
    if (db) {
      try {
        const sql = db as DbLike;
        const rows = await sql.unsafe(
          `SELECT id, run_id, status, created_at FROM hfl_decisions ORDER BY created_at DESC LIMIT 1`,
        );
        if (rows.length > 0) {
          const row = rows[0] as Record<string, unknown>;
          results.push({
            name: 'hfl:last_eval',
            status: 'pass',
            message: `Last HFL evaluation: ${row['status']} at ${row['created_at']}`,
            details: { id: row['id'], run_id: row['run_id'], status: row['status'], created_at: row['created_at'] },
          });
        } else {
          results.push({
            name: 'hfl:last_eval',
            status: 'warn',
            message: 'No HFL decisions recorded in database yet',
          });
        }
      } catch (err) {
        results.push({
          name: 'hfl:last_eval',
          status: 'warn',
          message: `Failed to query hfl_decisions: ${err instanceof Error ? err.message : String(err)}`,
        });
      }
    } else {
      results.push({
        name: 'hfl:last_eval',
        status: 'warn',
        message: 'No database — cannot check HFL history',
      });
    }

    // 5d. Recent HFL decisions (all)
    try {
      const allDecisions = hfl.listDecisions(5);
      results.push({
        name: 'hfl:decisions_memory',
        status: 'pass',
        message: `${allDecisions.length} HFL decision(s) in memory`,
      });
    } catch {
      results.push({
        name: 'hfl:decisions_memory',
        status: 'warn',
        message: 'Failed to list HFL decisions from memory',
      });
    }

    return results;
  });

  return { name: 'HFL', status: stageStatus(checks), duration_ms, checks };
}

// ─── Stage 6: Pipeline Integration ─────────────────────────────────

async function checkPipelineIntegration(
  agency: OpenAgency,
  eventBus: EventBus,
): Promise<StageResult> {
  const { result: checks, duration_ms } = await timed(async () => {
    const results: CheckResult[] = [];

    // 6a. Run a mini analyze pipeline (same as /v1/analyze)
    try {
      const { calculateBillingFromEngines } = await import('@openagency/core');
      type EngineOutputs = import('@openagency/core').EngineOutputs;

      const engineOutputs: EngineOutputs = { ad_spend: 100_000 };
      const engineIds = ['leak-detector', 'media-architect', 'campaign-ops', 'executive-bridge'];
      const primarySkills: Record<string, string> = {
        'leak-detector': 'waste-waterfall',
        'media-architect': 'mmm-optimize',
        'campaign-ops': 'optimization-analyze',
        'executive-bridge': 'revenue-translate',
      };

      let successCount = 0;

      const tasks = engineIds.map(async (engineId) => {
        const skillId = primarySkills[engineId]!;
        try {
          const raw = await Promise.race([
            agency.run(engineId, skillId, { ...SYNTHETIC_TEST_DATA }),
            new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 15_000)),
          ]);
          const result = raw as Record<string, unknown>;
          const innerData = (result?.data ?? {}) as Record<string, unknown>;

          // Map results for billing (simplified version of analyze.ts mapToEngineOutputs)
          if (engineId === 'leak-detector' && innerData) {
            if (!engineOutputs.leak_detector) engineOutputs.leak_detector = {};
            engineOutputs.leak_detector.waste_waterfall = innerData;
          } else if (engineId === 'media-architect' && innerData) {
            if (!engineOutputs.media_architect) engineOutputs.media_architect = {};
            engineOutputs.media_architect.mmm_optimize = innerData;
          } else if (engineId === 'campaign-ops' && innerData) {
            if (!engineOutputs.campaign_ops) engineOutputs.campaign_ops = {};
            engineOutputs.campaign_ops.optimization_analyze = innerData;
          } else if (engineId === 'executive-bridge' && innerData) {
            if (!engineOutputs.executive_bridge) engineOutputs.executive_bridge = {};
            engineOutputs.executive_bridge.revenue_translate = innerData;
          }

          successCount++;
          return { engineId, ok: true };
        } catch (err) {
          return { engineId, ok: false, error: err instanceof Error ? err.message : String(err) };
        }
      });

      const settled = await Promise.all(tasks);

      results.push({
        name: 'pipeline:engines',
        status: successCount >= 3 ? 'pass' : successCount > 0 ? 'warn' : 'fail',
        message: `${successCount}/${engineIds.length} engines produced results`,
        details: settled,
      });

      // 6b. Billing calculation
      try {
        const billing = calculateBillingFromEngines(engineOutputs);
        const billingObj = billing as unknown as Record<string, unknown>;
        const hasBilling = billing && typeof billing === 'object';
        results.push({
          name: 'pipeline:billing',
          status: hasBilling ? 'pass' : 'warn',
          message: hasBilling
            ? `Billing calculated: total_fee=$${billingObj?.total_fee ?? 0}`
            : 'Billing returned empty or null',
          details: billing
            ? {
                total_fee: billingObj?.total_fee,
                total_recovery: billingObj?.total_recovery,
                roi_on_fee: billingObj?.roi_on_fee,
              }
            : undefined,
        });
      } catch (err) {
        results.push({
          name: 'pipeline:billing',
          status: 'fail',
          message: `Billing calculation failed: ${err instanceof Error ? err.message : String(err)}`,
        });
      }
    } catch (err) {
      results.push({
        name: 'pipeline:integration',
        status: 'fail',
        message: `Pipeline integration check failed: ${err instanceof Error ? err.message : String(err)}`,
      });
    }

    // 6c. Event bus health — use an existing event type to avoid TS union issues
    try {
      const { ulid } = await import('ulid');
      let eventReceived = false;
      const testEventId = ulid();

      // Use a real event type for type safety
      const testType: EngineEventType = 'engine.registered';

      // Subscribe, publish, verify
      const unsubscribe = eventBus.subscribe(testType, () => {
        eventReceived = true;
      });

      await eventBus.publish({
        id: testEventId,
        type: testType,
        timestamp: new Date().toISOString(),
        payload: { _health_check: true },
        metadata: { _health_check: true },
      });

      // Give async handlers a tick
      await new Promise((r) => setTimeout(r, 50));

      if (typeof unsubscribe === 'function') {
        unsubscribe();
      }

      results.push({
        name: 'pipeline:eventbus',
        status: eventReceived ? 'pass' : 'warn',
        message: eventReceived
          ? 'Event bus publish/subscribe working'
          : 'Event published but not received (may be async-only)',
      });
    } catch (err) {
      results.push({
        name: 'pipeline:eventbus',
        status: 'warn',
        message: `Event bus check failed: ${err instanceof Error ? err.message : String(err)}`,
      });
    }

    return results;
  });

  return { name: 'Pipeline Integration', status: stageStatus(checks), duration_ms, checks };
}

// ─── Main Runner ────────────────────────────────────────────────────

export async function runPipelineHealthCheck(deps: HealthCheckDeps): Promise<HealthCheckResult> {
  const timestamp = new Date().toISOString();
  log.info('Starting pipeline health check');

  const stages: StageResult[] = [];

  // Run stages sequentially — some depend on DB being available
  try {
    stages.push(await checkInfrastructure(deps.db));
  } catch (err) {
    stages.push({
      name: 'Infrastructure',
      status: 'fail',
      duration_ms: 0,
      checks: [{ name: 'stage:crash', status: 'fail', message: `Stage crashed: ${err instanceof Error ? err.message : String(err)}` }],
    });
  }

  try {
    stages.push(await checkConnectorSync(deps.db, deps.connectorInfra));
  } catch (err) {
    stages.push({
      name: 'Connector & Sync',
      status: 'fail',
      duration_ms: 0,
      checks: [{ name: 'stage:crash', status: 'fail', message: `Stage crashed: ${err instanceof Error ? err.message : String(err)}` }],
    });
  }

  try {
    stages.push(await checkContextAssembly(deps.connectorInfra, deps.db, deps.agencyId));
  } catch (err) {
    stages.push({
      name: 'Context Assembly',
      status: 'fail',
      duration_ms: 0,
      checks: [{ name: 'stage:crash', status: 'fail', message: `Stage crashed: ${err instanceof Error ? err.message : String(err)}` }],
    });
  }

  try {
    stages.push(await checkEngines(deps.agency));
  } catch (err) {
    stages.push({
      name: 'Engine Health',
      status: 'fail',
      duration_ms: 0,
      checks: [{ name: 'stage:crash', status: 'fail', message: `Stage crashed: ${err instanceof Error ? err.message : String(err)}` }],
    });
  }

  try {
    stages.push(await checkHFL(deps.hfl, deps.db));
  } catch (err) {
    stages.push({
      name: 'HFL',
      status: 'fail',
      duration_ms: 0,
      checks: [{ name: 'stage:crash', status: 'fail', message: `Stage crashed: ${err instanceof Error ? err.message : String(err)}` }],
    });
  }

  try {
    stages.push(await checkPipelineIntegration(deps.agency, deps.eventBus));
  } catch (err) {
    stages.push({
      name: 'Pipeline Integration',
      status: 'fail',
      duration_ms: 0,
      checks: [{ name: 'stage:crash', status: 'fail', message: `Stage crashed: ${err instanceof Error ? err.message : String(err)}` }],
    });
  }

  // Compute summary
  const allChecks = stages.flatMap((s) => s.checks);
  const summary = {
    total_checks: allChecks.length,
    passed: allChecks.filter((c) => c.status === 'pass').length,
    warnings: allChecks.filter((c) => c.status === 'warn').length,
    failures: allChecks.filter((c) => c.status === 'fail').length,
  };

  // Overall status
  let status: 'healthy' | 'degraded' | 'critical';
  if (summary.failures === 0 && summary.warnings === 0) {
    status = 'healthy';
  } else if (summary.failures === 0) {
    status = 'degraded';
  } else {
    // Infra failures are critical, others are degraded
    const infraFails = stages.find((s) => s.name === 'Infrastructure')?.checks.filter((c) => c.status === 'fail').length ?? 0;
    status = infraFails > 0 ? 'critical' : 'degraded';
  }

  log.info(
    { status, total: summary.total_checks, passed: summary.passed, warnings: summary.warnings, failures: summary.failures },
    'Pipeline health check complete',
  );

  return { status, timestamp, stages, summary };
}
