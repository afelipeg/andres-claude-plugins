// ─── Super Admin Dashboard Routes ──────────────────────────────────
// Gated to super_admin role only. Provides full visibility into
// agencies, users, pipeline runs, LLM costs, connectors, and federation.

import { Hono } from 'hono';
import type { Context, Next } from 'hono';
import { authMiddleware, signToken } from '@openagency/auth';
import type { AuthPayload } from '@openagency/types';
import type { DailyMetricsRepo } from '@openagency/memory';
import type { FederationLogRepo } from '@openagency/memory';
import type { A2AClient } from '@openagency/agent';

type Db = { unsafe: (q: string, params?: unknown[]) => Promise<unknown[]> };

/** Middleware: require super_admin role only */
function requireSuperAdmin() {
  return async (c: Context, next: Next) => {
    const auth = c.get('auth') as AuthPayload;
    if (!auth || auth.role !== 'super_admin') {
      return c.json({ error: 'forbidden', message: 'Super Admin access required', status: 403 }, 403);
    }
    await next();
  };
}

export interface AdminRouteDeps {
  db: unknown;
  dailyMetricsRepo: DailyMetricsRepo | null;
  federationLogRepo: FederationLogRepo | null;
  a2aClient: A2AClient;
}

export function adminRoutes(deps: AdminRouteDeps) {
  const app = new Hono();
  const { db, dailyMetricsRepo, federationLogRepo, a2aClient } = deps;

  if (!db) return app;

  const sql = db as Db;

  // All admin routes require auth + super_admin role
  app.use('/v1/admin/*', authMiddleware(), requireSuperAdmin());

  // ─── GET /v1/admin/overview ────────────────────────────────────
  app.get('/v1/admin/overview', async (c) => {
    const [usersRows, agencyRows, connRows, runsToday, mtd] = await Promise.all([
      sql.unsafe('SELECT COUNT(*)::int AS total, COUNT(*) FILTER (WHERE status = \'active\')::int AS active FROM users', []),
      sql.unsafe('SELECT COUNT(DISTINCT agency_id)::int AS total FROM agency_connections WHERE agency_id IS NOT NULL', []),
      sql.unsafe(`SELECT COUNT(*)::int AS total,
                         COUNT(*) FILTER (WHERE status != 'active' OR updated_at < now() - interval '7 days')::int AS stale
                  FROM agency_connections`, []),
      dailyMetricsRepo?.todayRuns() ?? { started: 0, completed: 0, failed: 0 },
      dailyMetricsRepo?.mtdTotals() ?? { llm_cost_usd: 0, outcome_fees_usd: 0, runs_completed: 0, a2a_calls: 0, tokens_prompt: 0, tokens_completion: 0 },
    ]);

    const users = (usersRows as Array<Record<string, unknown>>)[0] ?? {};
    const agencies = (agencyRows as Array<Record<string, unknown>>)[0] ?? {};
    const conns = (connRows as Array<Record<string, unknown>>)[0] ?? {};

    return c.json({
      total_agencies: Number(agencies['total'] ?? 0),
      total_users: Number(users['total'] ?? 0),
      active_users: Number(users['active'] ?? 0),
      runs_today: runsToday.started,
      runs_mtd: mtd.runs_completed,
      llm_cost_mtd: mtd.llm_cost_usd,
      outcome_fees_mtd: mtd.outcome_fees_usd,
      a2a_calls_mtd: mtd.a2a_calls,
      stale_connectors: Number(conns['stale'] ?? 0),
      total_connectors: Number(conns['total'] ?? 0),
    });
  });

  // ─── GET /v1/admin/agencies ────────────────────────────────────
  app.get('/v1/admin/agencies', async (c) => {
    const rows = await sql.unsafe(
      `SELECT ac.agency_id,
              MAX(ac.platform) AS platform,
              COUNT(DISTINCT ac.id)::int AS connection_count,
              COUNT(DISTINCT ads.id)::int AS advertiser_count,
              MAX(ac.updated_at) AS last_activity
       FROM agency_connections ac
       LEFT JOIN advertiser_scopes ads ON ads.agency_connection_id = ac.id
       WHERE ac.agency_id IS NOT NULL
       GROUP BY ac.agency_id
       ORDER BY last_activity DESC`,
      [],
    );

    // Enrich with user counts
    const agencies = await Promise.all(
      (rows as Array<Record<string, unknown>>).map(async (row) => {
        const agencyId = row['agency_id'] as string;
        const userRows = await sql.unsafe(
          'SELECT COUNT(*)::int AS cnt FROM users WHERE id = $1 OR email LIKE $2',
          [agencyId, `%@${agencyId}%`],
        );
        // Get run counts from mesh_runs
        const runRows = await sql.unsafe(
          'SELECT COUNT(*)::int AS cnt FROM mesh_runs WHERE client_id = $1',
          [agencyId],
        );
        return {
          agency_id: agencyId,
          connection_count: Number(row['connection_count'] ?? 0),
          advertiser_count: Number(row['advertiser_count'] ?? 0),
          user_count: Number((userRows as Array<Record<string, unknown>>)[0]?.['cnt'] ?? 0),
          run_count: Number((runRows as Array<Record<string, unknown>>)[0]?.['cnt'] ?? 0),
          last_activity: row['last_activity'],
        };
      }),
    );

    return c.json({ agencies });
  });

  // ─── GET /v1/admin/agencies/:id ────────────────────────────────
  app.get('/v1/admin/agencies/:id', async (c) => {
    const agencyId = c.req.param('id');

    const [connections, advertisers, runs, scorecards] = await Promise.all([
      sql.unsafe(
        `SELECT id, platform, connection_type, status, created_at, updated_at
         FROM agency_connections WHERE agency_id = $1 ORDER BY created_at DESC`,
        [agencyId],
      ),
      sql.unsafe(
        `SELECT ads.id, ads.platform, ads.advertiser_id, ads.advertiser_name, ads.created_at
         FROM advertiser_scopes ads
         JOIN agency_connections ac ON ac.id = ads.agency_connection_id
         WHERE ac.agency_id = $1 ORDER BY ads.created_at DESC`,
        [agencyId],
      ),
      sql.unsafe(
        `SELECT id, pipeline_id, status, started_at, completed_at, total_duration_ms
         FROM mesh_runs WHERE client_id = $1 ORDER BY started_at DESC LIMIT 50`,
        [agencyId],
      ),
      sql.unsafe(
        `SELECT id, run_id, ad_spend, billing, status, created_at
         FROM scorecards WHERE client_id = $1 ORDER BY created_at DESC LIMIT 20`,
        [agencyId],
      ),
    ]);

    return c.json({
      agency_id: agencyId,
      connections,
      advertisers,
      runs,
      scorecards,
    });
  });

  // ─── GET /v1/admin/users ───────────────────────────────────────
  app.get('/v1/admin/users', async (c) => {
    const role = c.req.query('role');
    const status = c.req.query('status');
    const limit = Math.min(Number(c.req.query('limit') ?? 200), 500);
    const offset = Number(c.req.query('offset') ?? 0);

    const parts = ['SELECT id, email, name, role, status, last_login_at, created_at FROM users'];
    const where: string[] = [];
    const params: unknown[] = [];

    if (role) {
      params.push(role);
      where.push(`role = $${params.length}`);
    }
    if (status) {
      params.push(status);
      where.push(`status = $${params.length}`);
    }

    if (where.length) parts.push('WHERE ' + where.join(' AND '));
    parts.push('ORDER BY created_at DESC');
    params.push(limit);
    parts.push(`LIMIT $${params.length}`);
    params.push(offset);
    parts.push(`OFFSET $${params.length}`);

    const rows = await sql.unsafe(parts.join(' '), params);

    // Total count
    const countParts = ['SELECT COUNT(*)::int AS total FROM users'];
    const countParams: unknown[] = [];
    const countWhere: string[] = [];
    if (role) { countParams.push(role); countWhere.push(`role = $${countParams.length}`); }
    if (status) { countParams.push(status); countWhere.push(`status = $${countParams.length}`); }
    if (countWhere.length) countParts.push('WHERE ' + countWhere.join(' AND '));
    const countRows = await sql.unsafe(countParts.join(' '), countParams);
    const total = Number((countRows as Array<Record<string, unknown>>)[0]?.['total'] ?? 0);

    return c.json({ users: rows, total, limit, offset });
  });

  // ─── GET /v1/admin/runs ────────────────────────────────────────
  app.get('/v1/admin/runs', async (c) => {
    const status = c.req.query('status');
    const clientId = c.req.query('client_id');
    const from = c.req.query('from');
    const to = c.req.query('to');
    const limit = Math.min(Number(c.req.query('limit') ?? 50), 200);
    const offset = Number(c.req.query('offset') ?? 0);

    const parts = ['SELECT id, pipeline_id, status, started_at, completed_at, total_duration_ms, client_id, goal_id, usage FROM mesh_runs'];
    const where: string[] = [];
    const params: unknown[] = [];

    if (status) { params.push(status); where.push(`status = $${params.length}`); }
    if (clientId) { params.push(clientId); where.push(`client_id = $${params.length}`); }
    if (from) { params.push(from); where.push(`started_at >= $${params.length}::timestamptz`); }
    if (to) { params.push(to); where.push(`started_at <= $${params.length}::timestamptz`); }

    if (where.length) parts.push('WHERE ' + where.join(' AND '));
    parts.push('ORDER BY started_at DESC');
    params.push(limit); parts.push(`LIMIT $${params.length}`);
    params.push(offset); parts.push(`OFFSET $${params.length}`);

    const rows = await sql.unsafe(parts.join(' '), params);

    // Count
    const cParts = ['SELECT COUNT(*)::int AS total FROM mesh_runs'];
    const cParams: unknown[] = [];
    const cWhere: string[] = [];
    if (status) { cParams.push(status); cWhere.push(`status = $${cParams.length}`); }
    if (clientId) { cParams.push(clientId); cWhere.push(`client_id = $${cParams.length}`); }
    if (from) { cParams.push(from); cWhere.push(`started_at >= $${cParams.length}::timestamptz`); }
    if (to) { cParams.push(to); cWhere.push(`started_at <= $${cParams.length}::timestamptz`); }
    if (cWhere.length) cParts.push('WHERE ' + cWhere.join(' AND '));
    const countRows = await sql.unsafe(cParts.join(' '), cParams);
    const total = Number((countRows as Array<Record<string, unknown>>)[0]?.['total'] ?? 0);

    return c.json({ runs: rows, total, limit, offset });
  });

  // ─── GET /v1/admin/tokens ──────────────────────────────────────
  app.get('/v1/admin/tokens', async (c) => {
    const days = Math.min(Number(c.req.query('days') ?? 30), 90);

    if (!dailyMetricsRepo) {
      return c.json({ by_day: [], by_agency: [], by_model: [], by_engine: [], mtd: {} });
    }

    const [byDay, byAgency, byModel, byEngine, mtd] = await Promise.all([
      dailyMetricsRepo.byDay(days),
      dailyMetricsRepo.byAgency(days),
      dailyMetricsRepo.byModel(days),
      dailyMetricsRepo.byEngine(days),
      dailyMetricsRepo.mtdTotals(),
    ]);

    return c.json({ by_day: byDay, by_agency: byAgency, by_model: byModel, by_engine: byEngine, mtd });
  });

  // ─── GET /v1/admin/connectors ──────────────────────────────────
  app.get('/v1/admin/connectors', async (c) => {
    const rows = await sql.unsafe(
      `SELECT ac.id, ac.agency_id, ac.platform, ac.connection_type, ac.status,
              ac.created_at, ac.updated_at,
              COUNT(ads.id)::int AS advertiser_count
       FROM agency_connections ac
       LEFT JOIN advertiser_scopes ads ON ads.agency_connection_id = ac.id
       GROUP BY ac.id
       ORDER BY ac.updated_at DESC`,
      [],
    );

    return c.json({ connectors: rows });
  });

  // ─── GET /v1/admin/federation ──────────────────────────────────
  app.get('/v1/admin/federation', async (c) => {
    const limit = Math.min(Number(c.req.query('limit') ?? 50), 200);

    const [log, peers, countByDay] = await Promise.all([
      federationLogRepo?.list({ limit }) ?? [],
      federationLogRepo?.peerSummary() ?? [],
      federationLogRepo?.countByDay(30) ?? [],
    ]);

    // Add live discovered agents from A2A client
    const discovered = a2aClient.listDiscovered?.() ?? [];

    return c.json({ log, peers, count_by_day: countByDay, discovered });
  });

  // ─── GET /v1/admin/federation/peers ────────────────────────────
  app.get('/v1/admin/federation/peers', async (c) => {
    const discovered = a2aClient.listDiscovered?.() ?? [];
    return c.json({ peers: discovered });
  });

  // ─── POST /v1/admin/users/:id/deactivate ───────────────────────
  app.post('/v1/admin/users/:id/deactivate', async (c) => {
    const userId = c.req.param('id');
    await sql.unsafe("UPDATE users SET status = 'deactivated', updated_at = now() WHERE id = $1", [userId]);
    return c.json({ status: 'deactivated', user_id: userId });
  });

  // ─── POST /v1/admin/users/:id/reactivate ───────────────────────
  app.post('/v1/admin/users/:id/reactivate', async (c) => {
    const userId = c.req.param('id');
    await sql.unsafe("UPDATE users SET status = 'active', updated_at = now() WHERE id = $1", [userId]);
    return c.json({ status: 'active', user_id: userId });
  });

  // ─── DELETE /v1/admin/agencies/:id ─────────────────────────────
  app.delete('/v1/admin/agencies/:id', async (c) => {
    const agencyId = c.req.param('id');
    // Cascade: advertiser_scopes → agency_connections
    await sql.unsafe(
      `DELETE FROM advertiser_scopes WHERE agency_connection_id IN
         (SELECT id FROM agency_connections WHERE agency_id = $1)`,
      [agencyId],
    );
    await sql.unsafe('DELETE FROM agency_connections WHERE agency_id = $1', [agencyId]);
    return c.json({ deleted: true, agency_id: agencyId });
  });

  // ─── POST /v1/admin/agencies/:id/impersonate ──────────────────
  app.post('/v1/admin/agencies/:id/impersonate', async (c) => {
    const agencyId = c.req.param('id');
    const auth = c.get('auth') as AuthPayload;

    // Sign a short-lived token scoped to agency_admin for this agency
    const token = await signToken(
      {
        sub: auth.sub,
        role: 'agency_admin' as import('@openagency/types').Role,
        scopes: ['admin:*', 'engine:*', 'connectors:*'],
      },
      { expiresIn: '15m' },
    );

    return c.json({
      token,
      expires_at: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
      agency_id: agencyId,
      impersonated_by: auth.sub,
    });
  });

  return app;
}
