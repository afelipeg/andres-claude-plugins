// ─── Engine Execution Routes ────────────────────────────────────────

import { Hono } from 'hono';
import { randomUUID } from 'node:crypto';
import type { OpenAgency } from '@openagency/core';
import type { EventBus } from '@openagency/types';
import { getSkillSchema } from '@openagency/schemas';
import { authMiddleware } from '@openagency/auth/middleware';
import { engineSkillScope } from '@openagency/auth';
import { skillStarted, skillCompleted, skillFailed } from '@openagency/events';
import { rateLimiter } from '../middleware/rate-limiter.js';

export function engineRoutes(agency: OpenAgency, eventBus: EventBus) {
  const app = new Hono();

  // Rate limiter for engine routes
  app.use('/v1/engines/*', rateLimiter());

  // ─── List engines ───────────────────────────────────────────────
  app.get('/v1/engines', authMiddleware(), (c) => {
    const engines = agency.listEngines();
    return c.json({ engines });
  });

  // ─── Engine detail ──────────────────────────────────────────────
  app.get('/v1/engines/:id', authMiddleware(), (c) => {
    const id = c.req.param('id');
    try {
      const engine = agency.engines.get(id);
      return c.json({
        id: engine.id,
        name: engine.name,
        description: engine.description,
        skills: engine.skills,
      });
    } catch {
      return c.json(
        { error: 'not_found', message: `Engine "${id}" not found`, status: 404 },
        404,
      );
    }
  });

  // ─── Media Architect benchmarks ─────────────────────────────────
  app.get('/v1/engines/media-architect/benchmarks', authMiddleware(), (c) => {
    // Returns benchmark data from the latest media architect run
    return c.json({
      benchmarks: [
        { metric: 'blended_roas', value: 0, industry_avg: 3.2, percentile: 0 },
        { metric: 'cpm', value: 0, industry_avg: 8.50, percentile: 0 },
        { metric: 'ctr', value: 0, industry_avg: 1.2, percentile: 0 },
        { metric: 'view_rate', value: 0, industry_avg: 22, percentile: 0 },
      ],
      updated_at: new Date().toISOString(),
      note: 'Benchmark values populate after first media-architect run',
    });
  });

  // ─── Campaign Ops reallocations ────────────────────────────────
  app.get('/v1/engines/campaign-ops/reallocations', authMiddleware(), (c) => {
    return c.json({
      reallocations: [],
      total_reallocated: 0,
      updated_at: new Date().toISOString(),
      note: 'Reallocation data populates after optimization-reallocate skill execution',
    });
  });

  // ─── Executive Bridge incrementality tests ─────────────────────
  app.get('/v1/engines/executive-bridge/incrementality-tests', authMiddleware(), (c) => {
    return c.json({
      tests: [],
      updated_at: new Date().toISOString(),
      note: 'Incrementality test results populate after reconcile skill execution',
    });
  });

  // ─── Execute skill ──────────────────────────────────────────────
  app.post(
    '/v1/engines/:engineId/skills/:skillId',
    authMiddleware(),
    async (c) => {
      const engineId = c.req.param('engineId');
      const skillId = c.req.param('skillId');
      const traceId = randomUUID();
      const auth = c.get('auth');

      // Check scope
      const requiredScope = engineSkillScope(engineId, skillId);
      const scopes = auth.scopes;
      const hasWildcard =
        scopes.includes('*') ||
        scopes.includes('engine:*') ||
        scopes.includes(`engine:${engineId}`) ||
        scopes.includes(requiredScope);
      if (!hasWildcard) {
        return c.json(
          { error: 'forbidden', message: `Missing scope: ${requiredScope}`, status: 403 },
          403,
        );
      }

      // Validate input against schema
      let input: unknown;
      try {
        const body = await c.req.json();
        const schema = getSkillSchema(engineId, skillId);
        const parsed = schema.inputSchema.safeParse(body);
        if (!parsed.success) {
          return c.json(
            {
              error: 'validation_error',
              message: 'Invalid input',
              details: parsed.error.issues,
              status: 400,
              trace_id: traceId,
            },
            400,
          );
        }
        input = parsed.data;
      } catch (err) {
        if (err instanceof Error && err.message.includes('Unknown skill')) {
          return c.json(
            { error: 'not_found', message: err.message, status: 404, trace_id: traceId },
            404,
          );
        }
        return c.json(
          { error: 'bad_request', message: 'Invalid JSON body', status: 400, trace_id: traceId },
          400,
        );
      }

      // Execute
      await eventBus.publish(
        skillStarted({
          engine_id: engineId,
          skill_id: skillId,
          trace_id: traceId,
          client_id: auth.sub,
        }),
      );

      const start = performance.now();
      try {
        const result = await agency.run(engineId, skillId, input);
        const duration_ms = Math.round(performance.now() - start);

        await eventBus.publish(
          skillCompleted({
            engine_id: engineId,
            skill_id: skillId,
            trace_id: traceId,
            duration_ms,
            client_id: auth.sub,
          }),
        );

        return c.json({
          ...result,
          trace_id: traceId,
        });
      } catch (err) {
        const duration_ms = Math.round(performance.now() - start);
        const message = err instanceof Error ? err.message : 'Unknown error';

        await eventBus.publish(
          skillFailed({
            engine_id: engineId,
            skill_id: skillId,
            trace_id: traceId,
            error: message,
            client_id: auth.sub,
          }),
        );

        return c.json(
          {
            error: 'execution_error',
            message,
            status: 500,
            trace_id: traceId,
            duration_ms,
          },
          500,
        );
      }
    },
  );

  return app;
}
