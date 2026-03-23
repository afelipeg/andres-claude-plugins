// ─── Pipeline Health Check Route ────────────────────────────────────
// GET /v1/health/pipeline — admin-only, cached 5 min, 60s timeout.

import { Hono } from 'hono';
import type { OpenAgency } from '@openagency/core';
import type { EventBus } from '@openagency/types';
import type { AuthPayload } from '@openagency/types';
import type { HFLCoordinator } from '@openagency/hfl';
import type { ConnectorInfra } from '../connectors/setup.js';
import { runPipelineHealthCheck, type HealthCheckResult } from '../health-check-pipeline.js';

// ─── 5-minute result cache ──────────────────────────────────────────

let cachedResult: HealthCheckResult | null = null;
let cacheTimestamp = 0;
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

export function healthPipelineRoutes(opts: {
  db: unknown | null;
  agency: OpenAgency;
  eventBus: EventBus;
  connectorInfra: ConnectorInfra;
  hfl: HFLCoordinator;
}) {
  const app = new Hono();

  app.get('/v1/health/pipeline', async (c) => {
    // ─── Auth gate: admin or super_admin only ────────────────────────
    const auth = c.get('auth') as AuthPayload | undefined;
    if (!auth || (auth.role !== 'admin' && auth.role !== 'super_admin')) {
      return c.json(
        { error: 'forbidden', message: 'Admin access required for pipeline health check', status: 403 },
        403,
      );
    }

    // ─── Return cached result if fresh ───────────────────────────────
    const now = Date.now();
    if (cachedResult && now - cacheTimestamp < CACHE_TTL_MS) {
      return c.json({
        ...cachedResult,
        _cached: true,
        _cache_age_s: Math.floor((now - cacheTimestamp) / 1000),
      });
    }

    // ─── Run health check with 60s timeout ───────────────────────────
    const agencyId = c.req.query('agency_id');
    try {
      const checkPromise = runPipelineHealthCheck({
        db: opts.db,
        agency: opts.agency,
        eventBus: opts.eventBus,
        connectorInfra: opts.connectorInfra,
        hfl: opts.hfl,
        agencyId: agencyId || undefined,
      });

      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Health check timed out after 60 seconds')), 60_000),
      );

      const result = await Promise.race([checkPromise, timeoutPromise]);

      // Cache the result
      cachedResult = result;
      cacheTimestamp = Date.now();

      const httpStatus = result.status === 'critical' ? 503 : result.status === 'degraded' ? 200 : 200;
      return c.json(result, httpStatus);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return c.json(
        {
          status: 'critical',
          timestamp: new Date().toISOString(),
          error: message,
          stages: [],
          summary: { total_checks: 0, passed: 0, warnings: 0, failures: 1 },
        },
        503,
      );
    }
  });

  // ─── Force-refresh endpoint (bust cache) ───────────────────────────
  app.post('/v1/health/pipeline/refresh', async (c) => {
    const auth = c.get('auth') as AuthPayload | undefined;
    if (!auth || (auth.role !== 'admin' && auth.role !== 'super_admin')) {
      return c.json({ error: 'forbidden', message: 'Admin access required', status: 403 }, 403);
    }

    cachedResult = null;
    cacheTimestamp = 0;
    return c.json({ message: 'Health check cache cleared — next GET will run fresh' });
  });

  return app;
}
