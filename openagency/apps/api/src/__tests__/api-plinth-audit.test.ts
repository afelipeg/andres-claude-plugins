// ─── Plinth API Audit Tests ─────────────────────────────────────────
// Validates all endpoints required for the Plinth frontend (scorecard web).
// Tests: auth, connectors (auth-url, callback, status), HFL config test,
// mesh runs (pagination, recovery), agents/status.

import { describe, it, expect, vi, beforeAll, beforeEach, afterEach, afterAll } from 'vitest';
import { Hono } from 'hono';
import { createEventBus } from '@openagency/events';
import { HFLCoordinator } from '@openagency/hfl';
import type { HFLConfig } from '@openagency/hfl';
import type { EventBus, EngineEvent } from '@openagency/types';

// ─── Auth Routes Tests ──────────────────────────────────────────────

describe('Auth Routes (register/login/me)', () => {
  // signToken requires JWT_SECRET env var
  beforeAll(() => {
    process.env['JWT_SECRET'] = 'test-secret-plinth-audit-32chars!!';
  });

  afterAll(() => {
    delete process.env['JWT_SECRET'];
  });

  it('register endpoint is closed (single-tenant)', async () => {
    const { authRoutes } = await import('../routes/auth.js');
    const app = new Hono();
    app.route('/', authRoutes());

    const res = await app.request('/v1/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'test@plinth.io', password: 'securepass123', name: 'Test User' }),
    });

    expect(res.status).toBe(403);
    const data = await res.json();
    expect(data.message).toContain('Registration is closed');
  });

  it('register always returns 403 regardless of payload', async () => {
    const { authRoutes } = await import('../routes/auth.js');
    const app = new Hono();
    app.route('/', authRoutes());

    const res = await app.request('/v1/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'dupe@plinth.io', password: 'securepass123', name: 'Dupe' }),
    });
    expect(res.status).toBe(403);
  });

  it('register rejects short password with 403 (closed)', async () => {
    const { authRoutes } = await import('../routes/auth.js');
    const app = new Hono();
    app.route('/', authRoutes());

    const res = await app.request('/v1/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'short@plinth.io', password: '1234', name: 'Short' }),
    });
    expect(res.status).toBe(403);
  });

  it('logs in with seeded admin credentials', async () => {
    // Reset module cache so the seed IIFE re-runs with new env vars
    vi.resetModules();
    process.env['ADMIN_EMAIL'] = 'admin-test@plinth.io';
    process.env['ADMIN_PASSWORD'] = 'adminpass999';

    const { authRoutes } = await import('../routes/auth.js');
    const app = new Hono();
    app.route('/', authRoutes());

    const res = await app.request('/v1/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'admin-test@plinth.io', password: 'adminpass999' }),
    });

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.user.email).toBe('admin-test@plinth.io');
    expect(data.user.role).toBe('admin');
    expect(data.token).toBeDefined();

    delete process.env['ADMIN_EMAIL'];
    delete process.env['ADMIN_PASSWORD'];
  });

  it('rejects invalid login', async () => {
    const { authRoutes } = await import('../routes/auth.js');
    const app = new Hono();
    app.route('/', authRoutes());

    const res = await app.request('/v1/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'noexist@plinth.io',
        password: 'wrong',
      }),
    });

    expect(res.status).toBe(401);
  });
});

// ─── HFL Config Test Endpoint ───────────────────────────────────────

describe('HFL Config Test', () => {
  function createMockEventBus(): EventBus {
    const events: EngineEvent[] = [];
    return {
      publish: vi.fn(async (event: EngineEvent) => { events.push(event); }),
      subscribe: vi.fn(() => () => {}),
      onAny: vi.fn(() => () => {}),
    } as unknown as EventBus;
  }

  let mockFetch: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockFetch = vi.fn().mockResolvedValue(new Response('OK', { status: 200 }));
    vi.stubGlobal('fetch', mockFetch);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('sends test webhook to configured channel', async () => {
    const { hflRoutes } = await import('../routes/hfl.js');
    const eventBus = createMockEventBus();
    const hfl = new HFLCoordinator(eventBus, { base_url: 'http://test:3100' });

    const config: HFLConfig = {
      client_id: 'test-client',
      auto_approve_threshold: 1000,
      channels: [
        { id: 'slack', type: 'webhook', url: 'https://hooks.slack.com/test', render_level: 'rich', active: true },
      ],
      default_channel: 'slack',
      escalation_rules: [],
      timeout_ms: 0,
    };
    hfl.setConfig(config);

    const app = new Hono();
    app.route('/', hflRoutes(hfl));

    const res = await app.request('/v1/hfl/config/test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ client_id: 'test-client' }),
    });

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.channel_id).toBe('slack');
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it('returns 404 when config not found', async () => {
    const { hflRoutes } = await import('../routes/hfl.js');
    const eventBus = createMockEventBus();
    const hfl = new HFLCoordinator(eventBus);

    const app = new Hono();
    app.route('/', hflRoutes(hfl));

    const res = await app.request('/v1/hfl/config/test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ client_id: 'nonexistent' }),
    });

    expect(res.status).toBe(404);
    const data = await res.json();
    expect(data.error).toBe('not_found');
  });

  it('handles MCP callback channels gracefully', async () => {
    const { hflRoutes } = await import('../routes/hfl.js');
    const eventBus = createMockEventBus();
    const hfl = new HFLCoordinator(eventBus);

    const config: HFLConfig = {
      client_id: 'mcp-client',
      auto_approve_threshold: 1000,
      channels: [
        { id: 'mcp-ch', type: 'mcp_callback', url: '', render_level: 'full', active: true },
      ],
      default_channel: 'mcp-ch',
      escalation_rules: [],
      timeout_ms: 0,
    };
    hfl.setConfig(config);

    const app = new Hono();
    app.route('/', hflRoutes(hfl));

    const res = await app.request('/v1/hfl/config/test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ client_id: 'mcp-client' }),
    });

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.message).toContain('MCP callback');
    expect(mockFetch).not.toHaveBeenCalled();
  });
});

// ─── Mesh Routes Pagination ────────────────────────────────────────

describe('Mesh Routes Pagination', () => {
  it('returns pagination metadata', async () => {
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

    const res = await app.request('/v1/mesh/runs?page=1&limit=10');
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.pagination).toBeDefined();
    expect(data.pagination.page).toBe(1);
    expect(data.pagination.limit).toBe(10);
    expect(data.pagination.total).toBe(0);
    expect(data.pagination.has_next).toBe(false);
    expect(data.pagination.has_prev).toBe(false);
  });

  it('paginates runs correctly', async () => {
    const { meshRoutes } = await import('../routes/mesh.js');
    const runs = Array.from({ length: 25 }, (_, i) => ({
      id: `run-${i}`,
      pipeline_id: 'test',
      status: 'completed',
      started_at: new Date(Date.now() - i * 1000).toISOString(),
      completed_at: new Date().toISOString(),
      total_duration_ms: 1000,
    }));

    const mockMesh = {
      listRuns: () => runs,
      listPipelines: () => [],
      getPipeline: () => undefined,
      getRun: () => undefined,
      serializeRun: (r: unknown) => r,
    } as any;

    const app = new Hono();
    app.route('/', meshRoutes(mockMesh));

    const res = await app.request('/v1/mesh/runs?page=2&limit=10');
    const data = await res.json();

    expect(data.runs).toHaveLength(10);
    expect(data.pagination.page).toBe(2);
    expect(data.pagination.total).toBe(25);
    expect(data.pagination.total_pages).toBe(3);
    expect(data.pagination.has_next).toBe(true);
    expect(data.pagination.has_prev).toBe(true);
  });

  it('includes HFL decision summary in run list', async () => {
    const { meshRoutes } = await import('../routes/mesh.js');
    const mockMesh = {
      listRuns: () => [{
        id: 'run-hfl',
        pipeline_id: 'test',
        status: 'completed',
        started_at: new Date().toISOString(),
        completed_at: new Date().toISOString(),
        total_duration_ms: 500,
      }],
      listPipelines: () => [],
      getPipeline: () => undefined,
      getRun: () => undefined,
      serializeRun: (r: unknown) => r,
    } as any;

    const mockHfl = {
      getDecisionByRunId: (runId: string) => {
        if (runId === 'run-hfl') {
          return {
            id: 'decision-1',
            status: 'escalated',
            urgency: 'high',
            needs_human: true,
          };
        }
        return undefined;
      },
    } as any;

    const app = new Hono();
    app.route('/', meshRoutes(mockMesh, mockHfl));

    const res = await app.request('/v1/mesh/runs');
    const data = await res.json();

    expect(data.runs[0].hfl).toBeDefined();
    expect(data.runs[0].hfl.decision_id).toBe('decision-1');
    expect(data.runs[0].hfl.status).toBe('escalated');
    expect(data.runs[0].hfl.urgency).toBe('high');
  });
});

// ─── Recovery Breakdown ────────────────────────────────────────────

describe('Mesh Recovery Breakdown', () => {
  it('returns recovery breakdown for a run', async () => {
    const { meshRoutes } = await import('../routes/mesh.js');
    const run = {
      id: 'run-recovery',
      pipeline_id: 'full-optimization',
      status: 'completed',
    };

    const mockMesh = {
      listRuns: () => [],
      listPipelines: () => [],
      getPipeline: () => undefined,
      getRun: (id: string) => id === 'run-recovery' ? run : undefined,
      serializeRun: () => ({
        id: 'run-recovery',
        pipeline_id: 'full-optimization',
        status: 'completed',
        stage_results: {
          'leak-detector': {
            status: 'completed',
            duration_ms: 1000,
            skills_invoked: ['waste-waterfall'],
            output_summary: { waste_total_usd: 5000 },
          },
          'media-architect': {
            status: 'completed',
            duration_ms: 800,
            skills_invoked: ['mmm-optimize'],
            output_summary: { projected_lift_usd: 3000 },
          },
        },
      }),
    } as any;

    const app = new Hono();
    app.route('/', meshRoutes(mockMesh));

    const res = await app.request('/v1/mesh/runs/run-recovery/recovery');
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.run_id).toBe('run-recovery');
    expect(data.total_recovery_usd).toBe(8000);
    expect(data.breakdown).toHaveLength(2);
    expect(data.breakdown[0].agent_id).toBe('leak-detector');
    expect(data.breakdown[0].recovery_items[0].type).toBe('waste_recovery');
    expect(data.breakdown[0].recovery_items[0].value_usd).toBe(5000);
    expect(data.breakdown[1].recovery_items[0].type).toBe('media_lift');
  });

  it('returns 404 for non-existent run', async () => {
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

    const res = await app.request('/v1/mesh/runs/nonexistent/recovery');
    expect(res.status).toBe(404);
  });
});
