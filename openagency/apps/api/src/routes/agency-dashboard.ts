// ─── Agency Dashboard Routes ───────────────────────────────────────
// Agency-scoped metrics for agency_admin + account_manager.
// Each endpoint resolves agency_id from auth.sub → users.agency_id.
// No cross-agency visibility.

import { Hono } from 'hono';
import type { Context, Next } from 'hono';
import { authMiddleware } from '@openagency/auth';
import type { AuthPayload } from '@openagency/types';
import type { AgencyRepo, QuotaRepo, DailyMetricsRepo } from '@openagency/memory';
import { currentMonth, computeMonthlyRunLimit, computeRunTypeLimit } from '@openagency/memory';

type Db = { unsafe: (q: string, params?: unknown[]) => Promise<unknown[]> };

const ALLOWED_ROLES = new Set(['super_admin', 'agency_admin', 'admin', 'account_manager']);

function requireAgencyRole() {
  return async (c: Context, next: Next) => {
    const auth = c.get('auth') as AuthPayload;
    if (!auth || !ALLOWED_ROLES.has(auth.role)) {
      return c.json({ error: 'forbidden', message: 'Agency access required', status: 403 }, 403);
    }
    await next();
  };
}

export interface AgencyDashboardDeps {
  db: unknown;
  agencyRepo: AgencyRepo | null;
  quotaRepo: QuotaRepo | null;
  dailyMetricsRepo: DailyMetricsRepo | null;
}

export function agencyDashboardRoutes(deps: AgencyDashboardDeps) {
  const app = new Hono();
  const { db, agencyRepo, quotaRepo, dailyMetricsRepo } = deps;

  if (!db || !agencyRepo) return app;

  const sql = db as Db;

  app.use('/v1/agency/dashboard/*', authMiddleware(), requireAgencyRole());

  // Helper: resolve agency_id from auth
  async function getAgencyId(c: Context): Promise<string | null> {
    const auth = c.get('auth') as AuthPayload;
    return agencyRepo!.resolveForUser(auth.sub);
  }

  // ─── GET /v1/agency/dashboard/overview ─────────────────────────
  app.get('/v1/agency/dashboard/overview', async (c) => {
    const agencyId = await getAgencyId(c);
    if (!agencyId) return c.json({ error: 'no_agency' }, 404);

    const auth = c.get('auth') as AuthPayload;
    const agency = await agencyRepo!.findById(agencyId);
    if (!agency) return c.json({ error: 'agency_not_found' }, 404);

    const month = currentMonth();

    const [connRows, runRows, scorecardRows, quotaUsage, assistantUsage] = await Promise.all([
      sql.unsafe('SELECT COUNT(*)::int AS cnt FROM agency_connections WHERE agency_id = $1', [agencyId]),
      sql.unsafe(
        'SELECT COUNT(*)::int AS total, MAX(started_at) AS last_run FROM mesh_runs WHERE client_id = $1',
        [agencyId],
      ),
      sql.unsafe('SELECT COUNT(*)::int AS cnt FROM scorecards WHERE client_id = $1', [agencyId]),
      quotaRepo?.getOrCreateMonthlyUsage(agencyId, month) ?? null,
      quotaRepo?.getOrCreateAssistantUsage(auth.sub, month) ?? null,
    ]);

    const conns = (connRows as Array<Record<string, unknown>>)[0] ?? {};
    const runs = (runRows as Array<Record<string, unknown>>)[0] ?? {};
    const scorecards = (scorecardRows as Array<Record<string, unknown>>)[0] ?? {};

    const totalUsed = (quotaUsage?.initial_runs_used ?? 0) + (quotaUsage?.optimization_runs_used ?? 0);
    const totalLimit = computeMonthlyRunLimit(agency.brand_count, quotaUsage?.extra_runs_granted ?? 0);

    return c.json({
      agency_id: agencyId,
      agency_name: agency.name,
      brand_count: agency.brand_count,
      runs_used: totalUsed,
      runs_limit: totalLimit,
      assistant_sessions_used: assistantUsage?.sessions_used ?? 0,
      assistant_sessions_limit: 10,
      active_connectors: Number(conns['cnt'] ?? 0),
      total_runs: Number(runs['total'] ?? 0),
      last_run: runs['last_run'] ?? null,
      total_scorecards: Number(scorecards['cnt'] ?? 0),
      month,
    });
  });

  // ─── GET /v1/agency/dashboard/runs ─────────────────────────────
  app.get('/v1/agency/dashboard/runs', async (c) => {
    const agencyId = await getAgencyId(c);
    if (!agencyId) return c.json({ error: 'no_agency' }, 404);

    const limit = Math.min(Number(c.req.query('limit') ?? 50), 200);
    const offset = Number(c.req.query('offset') ?? 0);
    const status = c.req.query('status');

    const parts = ['SELECT id, pipeline_id, status, started_at, completed_at, total_duration_ms, usage FROM mesh_runs WHERE client_id = $1'];
    const params: unknown[] = [agencyId];

    if (status) {
      params.push(status);
      parts.push(`AND status = $${params.length}`);
    }

    parts.push('ORDER BY started_at DESC');
    params.push(limit);
    parts.push(`LIMIT $${params.length}`);
    params.push(offset);
    parts.push(`OFFSET $${params.length}`);

    const rows = await sql.unsafe(parts.join(' '), params);

    const countRows = await sql.unsafe(
      'SELECT COUNT(*)::int AS total FROM mesh_runs WHERE client_id = $1',
      [agencyId],
    );
    const total = Number((countRows as Array<Record<string, unknown>>)[0]?.['total'] ?? 0);

    return c.json({ runs: rows, total });
  });

  // ─── GET /v1/agency/dashboard/usage ────────────────────────────
  app.get('/v1/agency/dashboard/usage', async (c) => {
    const agencyId = await getAgencyId(c);
    if (!agencyId) return c.json({ error: 'no_agency' }, 404);

    const days = Math.min(Number(c.req.query('days') ?? 30), 90);

    if (!dailyMetricsRepo) {
      return c.json({ by_day: [] });
    }

    // Query daily_metrics filtered by agency
    const rows = await sql.unsafe(
      `SELECT date,
              SUM(tokens_prompt)::int AS tokens_prompt,
              SUM(tokens_completion)::int AS tokens_completion,
              SUM(llm_cost_usd)::numeric AS llm_cost_usd,
              SUM(runs_completed)::int AS runs_completed,
              SUM(skills_invoked)::int AS skills_invoked
       FROM daily_metrics
       WHERE agency_id = $1 AND date >= CURRENT_DATE - $2::int
       GROUP BY date ORDER BY date DESC`,
      [agencyId, days],
    );

    return c.json({ by_day: rows });
  });

  // ─── GET /v1/agency/dashboard/scorecards ───────────────────────
  app.get('/v1/agency/dashboard/scorecards', async (c) => {
    const agencyId = await getAgencyId(c);
    if (!agencyId) return c.json({ error: 'no_agency' }, 404);

    const limit = Math.min(Number(c.req.query('limit') ?? 20), 100);

    const rows = await sql.unsafe(
      `SELECT id, run_id, ad_spend, billing, status, feedback, created_at
       FROM scorecards WHERE client_id = $1
       ORDER BY created_at DESC LIMIT $2`,
      [agencyId, limit],
    );

    return c.json({ scorecards: rows });
  });

  // ─── GET /v1/agency/dashboard/connectors ───────────────────────
  app.get('/v1/agency/dashboard/connectors', async (c) => {
    const agencyId = await getAgencyId(c);
    if (!agencyId) return c.json({ error: 'no_agency' }, 404);

    const rows = await sql.unsafe(
      `SELECT ac.id, ac.platform, ac.connection_type, ac.status, ac.updated_at,
              COUNT(ads.id)::int AS advertiser_count
       FROM agency_connections ac
       LEFT JOIN advertiser_scopes ads ON ads.agency_connection_id = ac.id
       WHERE ac.agency_id = $1
       GROUP BY ac.id
       ORDER BY ac.updated_at DESC`,
      [agencyId],
    );

    return c.json({ connectors: rows });
  });

  return app;
}
