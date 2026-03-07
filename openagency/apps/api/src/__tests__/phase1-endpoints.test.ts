// ─── Phase 1: Backend Endpoints for Plinth Connection ────────────────
// Tests for all new endpoints required by the Plinth frontend.

import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import { Hono } from 'hono';
import { signToken } from '@openagency/auth';

// JWT token for auth-guarded routes
let authToken: string;

beforeAll(async () => {
  process.env['JWT_SECRET'] = 'test-secret-phase1-endpoints-32chars!!';
  authToken = await signToken({ sub: 'test-user', role: 'admin', scopes: ['*'] });
});

afterAll(() => {
  delete process.env['JWT_SECRET'];
});

function authHeaders(extra?: Record<string, string>): Record<string, string> {
  return { Authorization: `Bearer ${authToken}`, ...extra };
}

// ─── Dashboard Summary ────────────────────────────────────────────────

describe('Dashboard Summary', () => {
  it('returns aggregated KPIs', async () => {
    const { dashboardRoutes } = await import('../routes/dashboard.js');
    const mockMesh = {
      listRuns: () => [],
      serializeRun: (r: unknown) => r,
    } as any;
    const mockInfra = {
      credentialStore: { platforms: () => ['google_ads', 'meta_ads'] },
      syncScheduler: { activePlatforms: () => [] },
      syncResultCache: { get: () => null },
    } as any;
    const mockRegistry = {
      agents: new Map([
        ['leak-detector', { getState: () => ({ status: 'idle', cycles_completed: 5 }) }],
        ['media-architect', { getState: () => ({ status: 'observing', cycles_completed: 3 }) }],
      ]),
    } as any;
    const mockHfl = { listPending: () => [] } as any;

    const app = new Hono();
    app.route('/', dashboardRoutes({ mesh: mockMesh, connectorInfra: mockInfra, registry: mockRegistry, hfl: mockHfl }));

    const res = await app.request('/v1/dashboard/summary');
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.active_platforms).toBe(2);
    expect(data.agents.total).toBe(2);
    expect(data.agents.active).toBe(1); // media-architect is observing
    expect(data.runs.total).toBe(0);
    expect(data.hfl.pending_decisions).toBe(0);
    expect(data.period).toBe('30d');
  });

  it('calculates recovery from completed runs', async () => {
    const { dashboardRoutes } = await import('../routes/dashboard.js');
    const mockMesh = {
      listRuns: () => [
        { id: 'r1', status: 'completed', started_at: new Date().toISOString(), pipeline_id: 'p1' },
      ],
      serializeRun: () => ({
        stage_results: {
          'leak-detector': { output_summary: { waste_total_usd: 5000 } },
          'media-architect': { output_summary: { projected_lift_usd: 3000 } },
        },
      }),
    } as any;
    const mockInfra = {
      credentialStore: { platforms: () => [] },
      syncScheduler: { activePlatforms: () => [] },
      syncResultCache: { get: () => null },
    } as any;
    const mockRegistry = { agents: new Map() } as any;
    const mockHfl = { listPending: () => [] } as any;

    const app = new Hono();
    app.route('/', dashboardRoutes({ mesh: mockMesh, connectorInfra: mockInfra, registry: mockRegistry, hfl: mockHfl }));

    const res = await app.request('/v1/dashboard/summary');
    const data = await res.json();
    expect(data.total_recovery).toBe(8000);
  });
});

// ─── Recovery History ─────────────────────────────────────────────────

describe('Recovery History', () => {
  it('returns empty months when no runs exist', async () => {
    const { meshRoutes } = await import('../routes/mesh.js');
    const mockMesh = {
      listRuns: () => [],
      listPipelines: () => [],
      getPipeline: () => undefined,
      getRun: () => undefined,
      serializeRun: (r: unknown) => r,
    } as any;

    const app = new Hono();
    app.route('/', meshRoutes(mockMesh));

    const res = await app.request('/v1/recovery/history');
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.months).toEqual([]);
    expect(data.total_recovery).toBe(0);
    expect(data.period_months).toBe(12);
  });

  it('groups recovery by month with cumulative totals', async () => {
    const { meshRoutes } = await import('../routes/mesh.js');
    const mockMesh = {
      listRuns: () => [
        { id: 'r1', status: 'completed', started_at: '2025-01-15T00:00:00Z', pipeline_id: 'p1' },
        { id: 'r2', status: 'completed', started_at: '2025-02-10T00:00:00Z', pipeline_id: 'p1' },
      ],
      listPipelines: () => [],
      getPipeline: () => undefined,
      getRun: () => undefined,
      serializeRun: (run: any) => ({
        stage_results: {
          'leak-detector': {
            output_summary: { waste_total_usd: run.id === 'r1' ? 5000 : 3000 },
          },
        },
      }),
    } as any;

    const app = new Hono();
    app.route('/', meshRoutes(mockMesh));

    const res = await app.request('/v1/recovery/history');
    const data = await res.json();

    expect(data.months).toHaveLength(2);
    expect(data.months[0].month).toBe('2025-01');
    expect(data.months[0].recovery).toBe(5000);
    expect(data.months[0].cumulative_recovery).toBe(5000);
    expect(data.months[1].month).toBe('2025-02');
    expect(data.months[1].cumulative_recovery).toBe(8000);
    expect(data.total_recovery).toBe(8000);
  });
});

// ─── Campaigns ────────────────────────────────────────────────────────

describe('Campaign Routes', () => {
  it('returns empty campaign list with summary', async () => {
    const { campaignRoutes } = await import('../routes/campaigns.js');
    const mockInfra = {
      credentialStore: { platforms: () => [] },
      syncResultCache: { get: () => null },
    } as any;

    const app = new Hono();
    app.route('/', campaignRoutes(mockInfra));

    const res = await app.request('/v1/campaigns');
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.campaigns).toEqual([]);
    expect(data.summary.total_campaigns).toBe(0);
    expect(data.pagination).toBeDefined();
    expect(data.pagination.page).toBe(1);
  });

  it('returns 404 for non-existent campaign pacing', async () => {
    const { campaignRoutes } = await import('../routes/campaigns.js');
    const mockInfra = {
      credentialStore: { platforms: () => [] },
      syncResultCache: { get: () => null },
    } as any;

    const app = new Hono();
    app.route('/', campaignRoutes(mockInfra));

    const res = await app.request('/v1/campaigns/nonexistent/pacing');
    expect(res.status).toBe(404);
  });
});

// ─── Connector Configure ──────────────────────────────────────────────

describe('Connector Configure', () => {
  it('sets connection type for a platform', async () => {
    const { connectorRoutes } = await import('../routes/connectors.js');
    const mockInfra = {
      credentialStore: { platforms: () => [], get: () => null, set: vi.fn(), remove: vi.fn() },
      syncScheduler: { activePlatforms: () => [], stop: vi.fn(), syncNow: vi.fn() },
      syncResultCache: { get: () => null, delete: vi.fn() },
    } as any;
    const mockEventBus = { publish: vi.fn(), subscribe: vi.fn(), onAny: vi.fn() } as any;

    const app = new Hono();
    app.route('/', connectorRoutes(mockInfra, mockEventBus));

    const res = await app.request('/v1/connectors/google_ads/configure', {
      method: 'POST',
      headers: authHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ connection_type: 'rest' }),
    });

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.platform).toBe('google_ads');
    expect(data.connection_type).toBe('rest');
  });

  it('rejects invalid connection type', async () => {
    const { connectorRoutes } = await import('../routes/connectors.js');
    const mockInfra = {
      credentialStore: { platforms: () => [], get: () => null, set: vi.fn(), remove: vi.fn() },
      syncScheduler: { activePlatforms: () => [], stop: vi.fn(), syncNow: vi.fn() },
      syncResultCache: { get: () => null, delete: vi.fn() },
    } as any;
    const mockEventBus = { publish: vi.fn(), subscribe: vi.fn(), onAny: vi.fn() } as any;

    const app = new Hono();
    app.route('/', connectorRoutes(mockInfra, mockEventBus));

    const res = await app.request('/v1/connectors/google_ads/configure', {
      method: 'POST',
      headers: authHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ connection_type: 'invalid' }),
    });

    expect(res.status).toBe(400);
  });

  it('rejects invalid platform', async () => {
    const { connectorRoutes } = await import('../routes/connectors.js');
    const mockInfra = {
      credentialStore: { platforms: () => [], get: () => null, set: vi.fn(), remove: vi.fn() },
      syncScheduler: { activePlatforms: () => [], stop: vi.fn(), syncNow: vi.fn() },
      syncResultCache: { get: () => null, delete: vi.fn() },
    } as any;
    const mockEventBus = { publish: vi.fn(), subscribe: vi.fn(), onAny: vi.fn() } as any;

    const app = new Hono();
    app.route('/', connectorRoutes(mockInfra, mockEventBus));

    const res = await app.request('/v1/connectors/snapchat/configure', {
      method: 'POST',
      headers: authHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ connection_type: 'rest' }),
    });

    expect(res.status).toBe(400);
  });
});

// ─── Onboarding Status ────────────────────────────────────────────────

describe('Onboarding Status', () => {
  it('returns onboarding progress', async () => {
    const { onboardingRoutes } = await import('../routes/onboarding.js');
    const mockInfra = {
      credentialStore: { platforms: () => ['google_ads'] },
      syncScheduler: { activePlatforms: () => [] },
      syncResultCache: { get: () => null },
    } as any;
    const mockMcp = {
      listServers: () => [],
    } as any;

    const app = new Hono();
    app.route('/', onboardingRoutes(mockInfra, mockMcp));

    const res = await app.request('/v1/onboarding/status');
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.platforms_connected).toBe(1);
    expect(data.platforms_pending).toBe(5);
    expect(data.platforms_total).toBe(6);
    expect(data.onboarding_complete).toBe(false); // connected but no sync data
    expect(data.platforms).toHaveLength(6);

    const googlePlatform = data.platforms.find((p: any) => p.platform === 'google_ads');
    expect(googlePlatform.rest_connected).toBe(true);
    expect(googlePlatform.connected).toBe(true);
  });
});

// ─── Consumption Endpoints ────────────────────────────────────────────

describe('Consumption Routes', () => {
  it('returns daily token usage', async () => {
    const { consumptionRoutes } = await import('../routes/consumption.js');
    const mockInfra = {
      credentialStore: { platforms: () => [] },
      syncResultCache: { get: () => null },
    } as any;
    const mockRegistry = { agents: new Map() } as any;

    const app = new Hono();
    app.route('/', consumptionRoutes(mockInfra, mockRegistry));

    const res = await app.request('/v1/consumption/tokens');
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.daily).toBeDefined();
    expect(data.summary).toBeDefined();
    expect(data.summary.total_tokens).toBe(0);
  });

  it('returns per-engine consumption', async () => {
    const { consumptionRoutes } = await import('../routes/consumption.js');
    const mockInfra = {
      credentialStore: { platforms: () => [] },
      syncResultCache: { get: () => null },
    } as any;
    const mockRegistry = {
      agents: new Map([
        ['leak-detector', { getState: () => ({ cycles_completed: 10 }) }],
      ]),
    } as any;

    const app = new Hono();
    app.route('/', consumptionRoutes(mockInfra, mockRegistry));

    const res = await app.request('/v1/consumption/engines');
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.engines).toHaveLength(1);
    expect(data.engines[0].id).toBe('leak-detector');
    expect(data.engines[0].cycles_completed).toBe(10);
  });

  it('returns protocol distribution', async () => {
    const { consumptionRoutes } = await import('../routes/consumption.js');
    const mockInfra = {
      credentialStore: { platforms: () => [] },
      syncResultCache: { get: () => null },
    } as any;
    const mockRegistry = { agents: new Map() } as any;

    const app = new Hono();
    app.route('/', consumptionRoutes(mockInfra, mockRegistry));

    const res = await app.request('/v1/consumption/protocols');
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.protocols).toHaveLength(4);
    expect(data.protocols.map((p: any) => p.name)).toEqual(['MCP Client', 'MCP Server', 'A2A', 'REST']);
  });

  it('returns tool invocation metrics', async () => {
    const { consumptionRoutes } = await import('../routes/consumption.js');
    const mockInfra = {
      credentialStore: { platforms: () => [] },
      syncResultCache: { get: () => null },
    } as any;
    const mockRegistry = { agents: new Map() } as any;

    const app = new Hono();
    app.route('/', consumptionRoutes(mockInfra, mockRegistry));

    const res = await app.request('/v1/consumption/tools');
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.tools).toBeDefined();
  });

  it('returns per-platform dataset stats', async () => {
    const { consumptionRoutes } = await import('../routes/consumption.js');
    const mockInfra = {
      credentialStore: { platforms: () => ['google_ads'] },
      syncResultCache: { get: (p: string) => p === 'google_ads' ? { row_count: 150, synced_at: '2025-01-01', status: 'completed' } : null },
    } as any;
    const mockRegistry = { agents: new Map() } as any;

    const app = new Hono();
    app.route('/', consumptionRoutes(mockInfra, mockRegistry));

    const res = await app.request('/v1/consumption/datasets');
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.platforms).toHaveLength(1);
    expect(data.platforms[0].records).toBe(150);
    expect(data.total_records).toBe(150);
  });
});

// ─── System Stats ─────────────────────────────────────────────────────

describe('System Stats', () => {
  it('returns system overview', async () => {
    const { healthRoutes } = await import('../routes/health.js');
    const mockAgency = {
      listEngines: () => [
        { id: 'e1', skills: ['s1', 's2'] },
        { id: 'e2', skills: ['s3'] },
      ],
    } as any;

    const app = new Hono();
    app.route('/', healthRoutes(Date.now(), mockAgency));

    const res = await app.request('/v1/system/stats');
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.engines).toBe(2);
    expect(data.skills).toBe(3);
    expect(data.protocols).toBe(4);
    expect(data.platforms).toBe(6);
    expect(data.version).toBe('1.0.0');
  });
});

// ─── Engine-specific Endpoints ────────────────────────────────────────

describe('Engine-specific Endpoints', () => {
  it('returns media architect benchmarks', async () => {
    const { engineRoutes } = await import('../routes/engines.js');
    const mockAgency = { listEngines: () => [], engines: { get: () => ({}) } } as any;
    const mockEventBus = { publish: vi.fn(), subscribe: vi.fn(), onAny: vi.fn() } as any;

    const app = new Hono();
    app.route('/', engineRoutes(mockAgency, mockEventBus));

    const res = await app.request('/v1/engines/media-architect/benchmarks', {
      headers: authHeaders(),
    });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.benchmarks).toHaveLength(4);
    expect(data.benchmarks[0].metric).toBe('blended_roas');
  });

  it('returns campaign ops reallocations', async () => {
    const { engineRoutes } = await import('../routes/engines.js');
    const mockAgency = { listEngines: () => [], engines: { get: () => ({}) } } as any;
    const mockEventBus = { publish: vi.fn(), subscribe: vi.fn(), onAny: vi.fn() } as any;

    const app = new Hono();
    app.route('/', engineRoutes(mockAgency, mockEventBus));

    const res = await app.request('/v1/engines/campaign-ops/reallocations', {
      headers: authHeaders(),
    });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.reallocations).toEqual([]);
  });

  it('returns executive bridge incrementality tests', async () => {
    const { engineRoutes } = await import('../routes/engines.js');
    const mockAgency = { listEngines: () => [], engines: { get: () => ({}) } } as any;
    const mockEventBus = { publish: vi.fn(), subscribe: vi.fn(), onAny: vi.fn() } as any;

    const app = new Hono();
    app.route('/', engineRoutes(mockAgency, mockEventBus));

    const res = await app.request('/v1/engines/executive-bridge/incrementality-tests', {
      headers: authHeaders(),
    });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.tests).toEqual([]);
  });
});
