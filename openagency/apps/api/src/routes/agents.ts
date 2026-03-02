// ─── Agent Management Routes ────────────────────────────────────────

import { Hono } from 'hono';
import type { OodaRuntime } from '@openagency/agent';
import type { DecisionRepo, AgentStateRepo } from '@openagency/memory';
import { AgentConfigUpdateSchema } from '@openagency/schemas';
import { authMiddleware } from '@openagency/auth';

export interface AgentRegistry {
  agents: Map<string, OodaRuntime>;
  decisionRepo: DecisionRepo | null;
  agentStateRepo: AgentStateRepo | null;
}

export function agentRoutes(registry: AgentRegistry) {
  const app = new Hono();

  // All agent routes require auth
  app.use('/v1/agents/*', authMiddleware('engine:*'));

  // ─── List all agents ────────────────────────────────────────────
  app.get('/v1/agents', (c) => {
    const agents = [];
    for (const [id, runtime] of registry.agents) {
      agents.push(runtime.getState());
    }
    return c.json({ agents });
  });

  // ─── Agent detail ───────────────────────────────────────────────
  app.get('/v1/agents/:id', (c) => {
    const runtime = registry.agents.get(c.req.param('id'));
    if (!runtime) {
      return c.json({ error: 'not_found', message: 'Agent not found', status: 404 }, 404);
    }
    return c.json(runtime.getState());
  });

  // ─── Start agent ────────────────────────────────────────────────
  app.post('/v1/agents/:id/start', async (c) => {
    const runtime = registry.agents.get(c.req.param('id'));
    if (!runtime) {
      return c.json({ error: 'not_found', message: 'Agent not found', status: 404 }, 404);
    }
    try {
      await runtime.start();
      return c.json({ status: 'started', agent: runtime.getState() });
    } catch (err) {
      return c.json({
        error: 'agent_error',
        message: err instanceof Error ? err.message : String(err),
        status: 400,
      }, 400);
    }
  });

  // ─── Stop agent ─────────────────────────────────────────────────
  app.post('/v1/agents/:id/stop', async (c) => {
    const runtime = registry.agents.get(c.req.param('id'));
    if (!runtime) {
      return c.json({ error: 'not_found', message: 'Agent not found', status: 404 }, 404);
    }
    await runtime.stop();
    return c.json({ status: 'stopped', agent: runtime.getState() });
  });

  // ─── Pause agent ────────────────────────────────────────────────
  app.post('/v1/agents/:id/pause', async (c) => {
    const runtime = registry.agents.get(c.req.param('id'));
    if (!runtime) {
      return c.json({ error: 'not_found', message: 'Agent not found', status: 404 }, 404);
    }
    await runtime.pause();
    return c.json({ status: 'paused', agent: runtime.getState() });
  });

  // ─── Resume agent ───────────────────────────────────────────────
  app.post('/v1/agents/:id/resume', async (c) => {
    const runtime = registry.agents.get(c.req.param('id'));
    if (!runtime) {
      return c.json({ error: 'not_found', message: 'Agent not found', status: 404 }, 404);
    }
    try {
      await runtime.resume();
      return c.json({ status: 'resumed', agent: runtime.getState() });
    } catch (err) {
      return c.json({
        error: 'agent_error',
        message: err instanceof Error ? err.message : String(err),
        status: 400,
      }, 400);
    }
  });

  // ─── Manual OODA cycle ──────────────────────────────────────────
  app.post('/v1/agents/:id/cycle', async (c) => {
    const runtime = registry.agents.get(c.req.param('id'));
    if (!runtime) {
      return c.json({ error: 'not_found', message: 'Agent not found', status: 404 }, 404);
    }
    try {
      const result = await runtime.cycle();
      return c.json(result);
    } catch (err) {
      return c.json({
        error: 'cycle_error',
        message: err instanceof Error ? err.message : String(err),
        status: 500,
      }, 500);
    }
  });

  // ─── Update config ──────────────────────────────────────────────
  app.patch('/v1/agents/:id/config', async (c) => {
    const runtime = registry.agents.get(c.req.param('id'));
    if (!runtime) {
      return c.json({ error: 'not_found', message: 'Agent not found', status: 404 }, 404);
    }
    const body = await c.req.json();
    const parsed = AgentConfigUpdateSchema.safeParse(body);
    if (!parsed.success) {
      return c.json({
        error: 'validation_error',
        message: 'Invalid configuration',
        details: parsed.error.issues,
        status: 400,
      }, 400);
    }
    // Config updates take effect on next cycle
    const state = runtime.getState();
    Object.assign(state.configuration, parsed.data);
    return c.json({ status: 'updated', configuration: state.configuration });
  });

  // ─── List decisions ─────────────────────────────────────────────
  app.get('/v1/agents/:id/decisions', async (c) => {
    const agentId = c.req.param('id');
    if (!registry.agents.has(agentId)) {
      return c.json({ error: 'not_found', message: 'Agent not found', status: 404 }, 404);
    }
    if (!registry.decisionRepo) {
      return c.json({ decisions: [] });
    }
    const limit = parseInt(c.req.query('limit') ?? '20');
    const decisions = await registry.decisionRepo.listByAgent(agentId, limit);
    return c.json({ decisions });
  });

  // ─── Approve decision ───────────────────────────────────────────
  app.post('/v1/agents/:id/decisions/:did/approve', async (c) => {
    if (!registry.decisionRepo) {
      return c.json({ error: 'no_database', message: 'Database not configured', status: 503 }, 503);
    }
    const did = c.req.param('did');
    const auth = c.get('auth') as { sub: string } | undefined;
    await registry.decisionRepo.approve(did, auth?.sub ?? 'api_user');
    return c.json({ status: 'approved', decision_id: did });
  });

  // ─── Reject decision ───────────────────────────────────────────
  app.post('/v1/agents/:id/decisions/:did/reject', async (c) => {
    if (!registry.decisionRepo) {
      return c.json({ error: 'no_database', message: 'Database not configured', status: 503 }, 503);
    }
    const did = c.req.param('did');
    await registry.decisionRepo.reject(did);
    return c.json({ status: 'rejected', decision_id: did });
  });

  // ─── Rollback decision ─────────────────────────────────────────
  app.post('/v1/agents/:id/decisions/:did/rollback', async (c) => {
    if (!registry.decisionRepo) {
      return c.json({ error: 'no_database', message: 'Database not configured', status: 503 }, 503);
    }
    const did = c.req.param('did');
    await registry.decisionRepo.updateStatus(did, 'rolled_back');
    return c.json({ status: 'rolled_back', decision_id: did });
  });

  // ─── Outcomes ───────────────────────────────────────────────────
  app.get('/v1/agents/:id/outcomes', async (c) => {
    return c.json({ outcomes: [] }); // populated when outcome repo is available
  });

  // ─── Memory search ──────────────────────────────────────────────
  app.get('/v1/agents/:id/memory', async (c) => {
    return c.json({ memories: [] }); // populated when memory repo is available
  });

  return app;
}
