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
      // FIX: accept both 'connected' and 'active' as valid statuses
      // Previously only checked for 'active' but credentials are stored with status='connected'
      sql.unsafe(`SELECT COUNT(*)::int AS total,
                         COUNT(*) FILTER (WHERE status NOT IN ('connected','active') OR updated_at < now() - interval '7 days')::int AS stale
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
        `SELECT id, platform, connection_type, status, connected_at, updated_at
         FROM agency_connections WHERE agency_id = $1 ORDER BY connected_at DESC`,
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
    try {
      const rows = await sql.unsafe(
        `SELECT ac.id, ac.agency_id, ac.platform, ac.connection_type, ac.status,
                ac.connected_at, ac.updated_at,
                (SELECT COUNT(*)::int FROM advertiser_scopes ads WHERE ads.agency_connection_id = ac.id) AS advertiser_count,
                sr.synced_at AS last_sync, sr.status AS sync_status, sr.row_count AS sync_row_count
         FROM agency_connections ac
         LEFT JOIN sync_results sr ON sr.agency_id = ac.agency_id AND sr.platform = ac.platform
         ORDER BY ac.updated_at DESC`,
        [],
      );
      return c.json({ connectors: rows });
    } catch (err) {
      return c.json({ error: 'query_failed', message: err instanceof Error ? err.message : String(err) }, 500);
    }
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
        agency_id: agencyId,
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

  // ─── GET /v1/admin/quota/requests ────────────────────────────
  app.get('/v1/admin/quota/requests', async (c) => {
    const rows = await sql.unsafe(
      `SELECT qr.*, a.name AS agency_name, u.email AS requester_email, u.name AS requester_name
       FROM quota_requests qr
       LEFT JOIN agencies a ON a.id = qr.agency_id
       LEFT JOIN users u ON u.id = qr.requested_by
       WHERE qr.status = 'pending'
       ORDER BY qr.created_at DESC`,
      [],
    );
    const countRows = await sql.unsafe("SELECT COUNT(*)::int AS cnt FROM quota_requests WHERE status = 'pending'", []);
    const pending_count = Number((countRows as Array<Record<string, unknown>>)[0]?.['cnt'] ?? 0);
    return c.json({ requests: rows, pending_count });
  });

  // ─── POST /v1/admin/quota/requests/:id/approve ─────────────────
  app.post('/v1/admin/quota/requests/:id/approve', async (c) => {
    const requestId = c.req.param('id');
    const auth = c.get('auth') as AuthPayload;
    const body = await c.req.json<{ extra_runs_granted: number }>();

    if (!body.extra_runs_granted || body.extra_runs_granted < 1) {
      return c.json({ error: 'invalid', message: 'extra_runs_granted must be >= 1' }, 400);
    }

    // Get request details
    const reqRows = await sql.unsafe('SELECT * FROM quota_requests WHERE id = $1', [requestId]);
    const req = (reqRows as Array<Record<string, unknown>>)[0];
    if (!req) return c.json({ error: 'not_found' }, 404);

    // Update request status
    await sql.unsafe(
      `UPDATE quota_requests SET status = 'approved', reviewed_by = $1, reviewed_at = now() WHERE id = $2`,
      [auth.sub, requestId],
    );

    // Grant extra runs via UPSERT
    const { ulid } = await import('ulid');
    await sql.unsafe(
      `INSERT INTO agency_quota_usage (id, agency_id, month, extra_runs_granted)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (agency_id, month) DO UPDATE SET
         extra_runs_granted = agency_quota_usage.extra_runs_granted + $4,
         updated_at = now()`,
      [ulid(), req['agency_id'], req['month'], body.extra_runs_granted],
    );

    // Email agency admin about approval
    try {
      const { sendEmail, QuotaRequestApproved } = await import('@polanyi/email');
      const userRows = await sql.unsafe('SELECT email FROM users WHERE id = $1', [req['requested_by']]);
      const requesterEmail = (userRows as Array<Record<string, unknown>>)[0]?.['email'] as string | undefined;
      const agencyRows2 = await sql.unsafe('SELECT name FROM agencies WHERE id = $1', [req['agency_id']]);
      const agencyName = (agencyRows2 as Array<Record<string, unknown>>)[0]?.['name'] as string ?? String(req['agency_id']);
      if (requesterEmail) {
        void sendEmail({
          to: requesterEmail,
          subject: `Extra runs approved — ${body.extra_runs_granted} runs added`,
          template: QuotaRequestApproved({ agencyName, month: String(req['month']), extraRunsGranted: body.extra_runs_granted }),
        }).catch(() => {});
      }
    } catch { /* email optional */ }

    return c.json({ approved: true, request_id: requestId, extra_runs_granted: body.extra_runs_granted });
  });

  // ─── POST /v1/admin/quota/requests/:id/deny ────────────────────
  app.post('/v1/admin/quota/requests/:id/deny', async (c) => {
    const requestId = c.req.param('id');
    const auth = c.get('auth') as AuthPayload;
    const body = await c.req.json<{ reason?: string }>().catch(() => ({}));

    // Verify request exists
    const reqRows = await sql.unsafe('SELECT * FROM quota_requests WHERE id = $1', [requestId]);
    const req = (reqRows as Array<Record<string, unknown>>)[0];
    if (!req) return c.json({ error: 'not_found' }, 404);

    await sql.unsafe(
      `UPDATE quota_requests SET status = 'denied', reviewed_by = $1, reviewed_at = now() WHERE id = $2`,
      [auth.sub, requestId],
    );

    // Email agency admin about denial
    try {
      const { sendEmail, QuotaRequestDenied } = await import('@polanyi/email');
      const userRows = await sql.unsafe('SELECT email FROM users WHERE id = $1', [req['requested_by']]);
      const requesterEmail = (userRows as Array<Record<string, unknown>>)[0]?.['email'] as string | undefined;
      const agencyRows2 = await sql.unsafe('SELECT name FROM agencies WHERE id = $1', [req['agency_id']]);
      const agencyName = (agencyRows2 as Array<Record<string, unknown>>)[0]?.['name'] as string ?? String(req['agency_id']);
      if (requesterEmail) {
        void sendEmail({
          to: requesterEmail,
          subject: `Quota request denied — ${agencyName}`,
          template: QuotaRequestDenied({ agencyName, month: String(req['month']), reason: (body as Record<string, unknown>).reason as string | undefined }),
        }).catch(() => {});
      }
    } catch { /* email optional */ }

    return c.json({ denied: true, request_id: requestId });
  });

  // ─── GET /v1/admin/agencies/:id/quota ──────────────────────────
  app.get('/v1/admin/agencies/:id/quota', async (c) => {
    const agencyId = c.req.param('id');

    const [agencyRows, usageRows] = await Promise.all([
      sql.unsafe('SELECT * FROM agencies WHERE id = $1', [agencyId]),
      sql.unsafe(
        'SELECT * FROM agency_quota_usage WHERE agency_id = $1 ORDER BY month DESC LIMIT 6',
        [agencyId],
      ),
    ]);

    const agency = (agencyRows as Array<Record<string, unknown>>)[0];
    if (!agency) return c.json({ error: 'not_found' }, 404);

    return c.json({ agency, usage_history: usageRows });
  });

  // ─── PATCH /v1/admin/agencies/:id ──────────────────────────────
  app.patch('/v1/admin/agencies/:id', async (c) => {
    const agencyId = c.req.param('id');
    const body = await c.req.json<{ brand_count?: number; name?: string }>();

    const updates: string[] = [];
    const params: unknown[] = [];

    if (body.brand_count !== undefined) {
      params.push(body.brand_count);
      updates.push(`brand_count = $${params.length}`);
    }
    if (body.name !== undefined) {
      params.push(body.name);
      updates.push(`name = $${params.length}`);
    }

    if (updates.length === 0) return c.json({ error: 'no_updates' }, 400);

    updates.push('updated_at = now()');
    params.push(agencyId);
    await sql.unsafe(`UPDATE agencies SET ${updates.join(', ')} WHERE id = $${params.length}`, params);

    return c.json({ updated: true, agency_id: agencyId });
  });

  return app;
}
