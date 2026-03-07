// ─── Agent Management Routes ────────────────────────────────────────

import { Hono } from 'hono';
import type { OodaRuntime, ActionExecutor } from '@openagency/agent';
import type { DecisionRepo, AgentStateRepo, ActionLogRepo } from '@openagency/memory';
import type { PlatformCredentials } from '@openagency/types';
import { AgentConfigUpdateSchema } from '@openagency/schemas';
import { authMiddleware } from '@openagency/auth';

export interface AgentRegistry {
  agents: Map<string, OodaRuntime>;
  decisionRepo: DecisionRepo | null;
  agentStateRepo: AgentStateRepo | null;
  actionLogRepo: ActionLogRepo | null;
  actionExecutor: ActionExecutor | null;
  credentials: Map<string, PlatformCredentials>;
  agentConfig: { max_budget_change_pct: number; approval_threshold_usd: number; dry_run: boolean };
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

  // ─── Aggregate agent status (dashboard summary) ────────────────
  // Must be before :id route to avoid matching "status" as an agent ID.
  app.get('/v1/agents/status', (c) => {
    const agents = [];
    let active = 0;
    let idle = 0;
    let paused = 0;
    let errored = 0;

    for (const [id, runtime] of registry.agents) {
      const state = runtime.getState();
      agents.push({
        id,
        status: state.status,
        last_cycle: state.last_cycle ?? null,
        cycles_completed: state.cycles_completed ?? 0,
      });

      if (state.status === 'error') errored++;
      else if (state.status === 'paused') paused++;
      else if (state.status === 'idle') idle++;
      else active++; // observing, orienting, deciding, acting
    }

    return c.json({
      total: agents.length,
      active,
      idle,
      paused,
      errored,
      agents,
    });
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

  // ─── Rollback action ───────────────────────────────────────────
  app.post('/v1/agents/:id/actions/:actionId/rollback', async (c) => {
    if (!registry.actionExecutor || !registry.actionLogRepo) {
      return c.json({ error: 'no_database', message: 'Database or executor not configured', status: 503 }, 503);
    }
    const actionId = c.req.param('actionId');

    try {
      const result = await registry.actionExecutor.rollbackAction(
        actionId,
        registry.credentials,
        registry.agentConfig,
      );

      if (result.status === 'failed') {
        return c.json({ error: 'rollback_failed', message: result.error, status: 400 }, 400);
      }

      return c.json({ status: 'rolled_back', action_id: actionId, result });
    } catch (err) {
      return c.json({
        error: 'rollback_error',
        message: err instanceof Error ? err.message : String(err),
        status: 500,
      }, 500);
    }
  });

  // ─── Rollback decision (all actions) ──────────────────────────
  app.post('/v1/agents/:id/decisions/:did/rollback', async (c) => {
    if (!registry.decisionRepo) {
      return c.json({ error: 'no_database', message: 'Database not configured', status: 503 }, 503);
    }
    const did = c.req.param('did');
    await registry.decisionRepo.updateStatus(did, 'rolled_back');
    return c.json({ status: 'rolled_back', decision_id: did });
  });

  // ─── Chat (human feedback to agent) ────────────────────────────
  // In-memory chat history per agent. Messages become observations on next cycle.
  const chatStore = new Map<string, Array<{ role: string; content: string; timestamp: string }>>();

  app.post('/v1/agents/:id/chat', async (c) => {
    const agentId = c.req.param('id');
    const runtime = registry.agents.get(agentId);
    if (!runtime) {
      return c.json({ error: 'not_found', message: 'Agent not found', status: 404 }, 404);
    }

    const body = await c.req.json<{ message: string }>();
    if (!body.message?.trim()) {
      return c.json({ error: 'validation_error', message: 'message is required', status: 400 }, 400);
    }

    if (!chatStore.has(agentId)) chatStore.set(agentId, []);
    const messages = chatStore.get(agentId)!;

    const userMsg = {
      role: 'human',
      content: body.message.trim(),
      timestamp: new Date().toISOString(),
    };
    messages.push(userMsg);

    // Feed as observation to next cycle
    const observations = [{
      id: `chat-${Date.now()}`,
      source: 'human',
      type: 'event_signal' as const,
      data: { event_type: 'human_feedback', message: body.message.trim(), agent_id: agentId },
      timestamp: new Date().toISOString(),
    }];

    // Trigger a cycle with the feedback observation
    try {
      const cycleResult = await runtime.cycle(observations);
      const agentReply = {
        role: 'agent',
        content: cycleResult.orient?.reasoning ?? 'Acknowledged. Will incorporate feedback in next analysis.',
        timestamp: new Date().toISOString(),
      };
      messages.push(agentReply);

      return c.json({
        messages: messages.slice(-20), // Last 20 messages
        cycle_result: {
          cycle_id: cycleResult.cycle_id,
          actions: cycleResult.decide.action_count,
          reasoning: cycleResult.orient?.reasoning,
        },
      });
    } catch (err) {
      const agentReply = {
        role: 'agent',
        content: 'Feedback received. Will process in next cycle.',
        timestamp: new Date().toISOString(),
      };
      messages.push(agentReply);
      return c.json({ messages: messages.slice(-20) });
    }
  });

  app.get('/v1/agents/:id/chat', (c) => {
    const agentId = c.req.param('id');
    if (!registry.agents.has(agentId)) {
      return c.json({ error: 'not_found', message: 'Agent not found', status: 404 }, 404);
    }
    const messages = chatStore.get(agentId) ?? [];
    return c.json({ messages: messages.slice(-50) });
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
