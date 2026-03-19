// ─── Quota Routes ──────────────────────────────────────────────────
// Quota status, extra run requests for agency users.

import { Hono } from 'hono';
import type { Context, Next } from 'hono';
import { authMiddleware } from '@openagency/auth';
import type { AuthPayload } from '@openagency/types';
import type { AgencyRepo, QuotaRepo } from '@openagency/memory';
import { currentMonth, computeMonthlyRunLimit, computeRunTypeLimit } from '@openagency/memory';

const AGENCY_ADMIN_ROLES = new Set(['super_admin', 'agency_admin', 'admin']);

function requireAgencyAdmin() {
  return async (c: Context, next: Next) => {
    const auth = c.get('auth') as AuthPayload;
    if (!auth || !AGENCY_ADMIN_ROLES.has(auth.role)) {
      return c.json({ error: 'forbidden', message: 'Agency admin access required', status: 403 }, 403);
    }
    await next();
  };
}

export interface QuotaRouteDeps {
  agencyRepo: AgencyRepo | null;
  quotaRepo: QuotaRepo | null;
}

export function quotaRoutes(deps: QuotaRouteDeps) {
  const app = new Hono();
  const { agencyRepo, quotaRepo } = deps;

  if (!agencyRepo || !quotaRepo) return app;

  // ─── GET /v1/quota/status ──────────────────────────────────────
  app.get('/v1/quota/status', authMiddleware(), async (c) => {
    const auth = c.get('auth') as AuthPayload;
    const agencyId = await agencyRepo.resolveForUser(auth.sub);
    if (!agencyId) {
      return c.json({ error: 'no_agency', message: 'User not associated with an agency' }, 404);
    }

    const agency = await agencyRepo.findById(agencyId);
    if (!agency) {
      return c.json({ error: 'agency_not_found' }, 404);
    }

    const month = currentMonth();
    const usage = await quotaRepo.getOrCreateMonthlyUsage(agencyId, month);
    const assistantUsage = await quotaRepo.getOrCreateAssistantUsage(auth.sub, month);

    const initialLimit = computeRunTypeLimit(agency.brand_count);
    const optimizationLimit = computeRunTypeLimit(agency.brand_count);
    const totalLimit = computeMonthlyRunLimit(agency.brand_count, usage.extra_runs_granted);

    // Reset date = 1st of next month. JS Date is 0-indexed, so month '03' → m=3 → new Date(2026,3,1) = April 1st ✓
    const [y, m] = month.split('-').map(Number);
    const resetDate = new Date(y!, m!, 1).toISOString();

    return c.json({
      agency_id: agencyId,
      agency_name: agency.name,
      brand_count: agency.brand_count,
      month,
      resets_at: resetDate,
      runs: {
        initial: { used: usage.initial_runs_used, limit: initialLimit },
        optimization: { used: usage.optimization_runs_used, limit: optimizationLimit },
        total: { used: usage.initial_runs_used + usage.optimization_runs_used, limit: totalLimit },
        extra_granted: usage.extra_runs_granted,
      },
      assistant: {
        used: assistantUsage.sessions_used,
        limit: 10,
      },
    });
  });

  // ─── POST /v1/quota/request-runs ───────────────────────────────
  app.post('/v1/quota/request-runs', authMiddleware(), requireAgencyAdmin(), async (c) => {
    const auth = c.get('auth') as AuthPayload;
    const body = await c.req.json<{ extra_runs_requested: number; reason?: string }>();

    if (!body.extra_runs_requested || body.extra_runs_requested < 1) {
      return c.json({ error: 'invalid', message: 'extra_runs_requested must be >= 1' }, 400);
    }

    const agencyId = await agencyRepo.resolveForUser(auth.sub);
    if (!agencyId) {
      return c.json({ error: 'no_agency' }, 404);
    }

    const requestId = await quotaRepo.createRequest({
      agencyId,
      requestedBy: auth.sub,
      extraRunsRequested: body.extra_runs_requested,
      reason: body.reason,
    });

    // Send email notification to super_admin (fire-and-forget)
    try {
      const { sendEmail, QuotaRequestReceived } = await import('@polanyi/email');
      const agency = await agencyRepo.findById(agencyId);
      const adminEmail = process.env['ADMIN_EMAIL'] ?? 'dedalo@polanyi.tech';
      void sendEmail({
        to: adminEmail,
        subject: `Run quota request — ${agency?.name ?? agencyId}`,
        template: QuotaRequestReceived({
          agencyName: agency?.name ?? agencyId,
          month: currentMonth(),
          extraRunsRequested: body.extra_runs_requested,
          reason: body.reason ?? 'No reason provided',
          appUrl: process.env['APP_URL'] ?? 'https://plinth.polanyi.tech',
        }),
      }).catch(() => {});
    } catch { /* email package optional */ }

    return c.json({ request_id: requestId, status: 'pending', month: currentMonth() }, 201);
  });

  // ─── GET /v1/quota/requests ────────────────────────────────────
  app.get('/v1/quota/requests', authMiddleware(), requireAgencyAdmin(), async (c) => {
    const auth = c.get('auth') as AuthPayload;
    const agencyId = await agencyRepo.resolveForUser(auth.sub);
    if (!agencyId) return c.json({ requests: [] });
    const requests = await quotaRepo.listRequestsByAgency(agencyId);
    return c.json({ requests });
  });

  // ─── PATCH /v1/quota/brand-count ───────────────────────────────
  app.patch('/v1/quota/brand-count', authMiddleware(), requireAgencyAdmin(), async (c) => {
    const auth = c.get('auth') as AuthPayload;
    const body = await c.req.json<{ brand_count: number }>();

    if (!body.brand_count || body.brand_count < 1 || body.brand_count > 100) {
      return c.json({ error: 'invalid', message: 'brand_count must be 1-100' }, 400);
    }

    const agencyId = await agencyRepo.resolveForUser(auth.sub);
    if (!agencyId) return c.json({ error: 'no_agency' }, 404);

    await agencyRepo.updateBrandCount(agencyId, body.brand_count);

    const newLimit = computeMonthlyRunLimit(body.brand_count, 0);
    return c.json({
      brand_count: body.brand_count,
      monthly_run_limit: newLimit,
      per_type_limit: computeRunTypeLimit(body.brand_count),
    });
  });

  return app;
}
