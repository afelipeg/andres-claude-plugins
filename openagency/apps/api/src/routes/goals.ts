// ─── Goal Routes ────────────────────────────────────────────────────

import { Hono } from 'hono';
import { ulid } from 'ulid';
import type { Goal } from '@openagency/types';
import type { GoalRepo } from '@openagency/memory';
import type { GoalDecomposer, GoalTracker } from '@openagency/agent';
import { GoalCreateInputSchema, GoalUpdateInputSchema } from '@openagency/schemas';
import { authMiddleware } from '@openagency/auth';

export interface GoalDeps {
  goalRepo: GoalRepo | null;
  decomposer: GoalDecomposer | null;
  tracker: GoalTracker | null;
}

export function goalRoutes(deps: GoalDeps) {
  const app = new Hono();

  app.use('/v1/goals/*', authMiddleware('engine:*'));

  // ─── Create goal ────────────────────────────────────────────────
  app.post('/v1/goals', async (c) => {
    if (!deps.goalRepo) {
      return c.json({ error: 'no_database', message: 'Database not configured', status: 503 }, 503);
    }

    const body = await c.req.json();
    const parsed = GoalCreateInputSchema.safeParse(body);
    if (!parsed.success) {
      return c.json({
        error: 'validation_error',
        message: 'Invalid goal input',
        details: parsed.error.issues,
        status: 400,
      }, 400);
    }

    const now = new Date().toISOString();
    const goal: Goal = {
      id: ulid(),
      agent_id: parsed.data.agent_id,
      name: parsed.data.name,
      description: parsed.data.description,
      type: parsed.data.type,
      target_metric: parsed.data.target_metric,
      target_value: parsed.data.target_value,
      deadline: parsed.data.deadline,
      priority: parsed.data.priority,
      status: 'active',
      constraints: parsed.data.constraints,
      sub_tasks: [],
      progress_pct: 0,
      created_at: now,
      updated_at: now,
    };

    await deps.goalRepo.create(goal);
    return c.json(goal, 201);
  });

  // ─── List goals ─────────────────────────────────────────────────
  app.get('/v1/goals', async (c) => {
    if (!deps.goalRepo) {
      return c.json({ goals: [] });
    }
    const agentId = c.req.query('agent_id');
    const goals = await deps.goalRepo.listActive(agentId);
    return c.json({ goals });
  });

  // ─── Goal detail ────────────────────────────────────────────────
  app.get('/v1/goals/:id', async (c) => {
    if (!deps.goalRepo) {
      return c.json({ error: 'no_database', message: 'Database not configured', status: 503 }, 503);
    }
    const goal = await deps.goalRepo.get(c.req.param('id'));
    if (!goal) {
      return c.json({ error: 'not_found', message: 'Goal not found', status: 404 }, 404);
    }
    return c.json(goal);
  });

  // ─── Update goal ────────────────────────────────────────────────
  app.patch('/v1/goals/:id', async (c) => {
    if (!deps.goalRepo) {
      return c.json({ error: 'no_database', message: 'Database not configured', status: 503 }, 503);
    }

    const body = await c.req.json();
    const parsed = GoalUpdateInputSchema.safeParse(body);
    if (!parsed.success) {
      return c.json({
        error: 'validation_error',
        message: 'Invalid update input',
        details: parsed.error.issues,
        status: 400,
      }, 400);
    }

    const goalId = c.req.param('id');
    const goal = await deps.goalRepo.get(goalId);
    if (!goal) {
      return c.json({ error: 'not_found', message: 'Goal not found', status: 404 }, 404);
    }

    if (parsed.data.status) {
      await deps.goalRepo.updateStatus(goalId, parsed.data.status);
    }
    if (parsed.data.target_value !== undefined) {
      await deps.goalRepo.updateProgress(goalId, goal.current_value ?? 0, goal.progress_pct);
    }

    const updated = await deps.goalRepo.get(goalId);
    return c.json(updated);
  });

  // ─── Delete (cancel) goal ───────────────────────────────────────
  app.delete('/v1/goals/:id', async (c) => {
    if (!deps.goalRepo) {
      return c.json({ error: 'no_database', message: 'Database not configured', status: 503 }, 503);
    }
    await deps.goalRepo.updateStatus(c.req.param('id'), 'cancelled');
    return c.json({ status: 'cancelled' });
  });

  // ─── Decompose goal ─────────────────────────────────────────────
  app.post('/v1/goals/:id/decompose', async (c) => {
    if (!deps.goalRepo || !deps.decomposer) {
      return c.json({ error: 'not_available', message: 'Goal decomposition not configured', status: 503 }, 503);
    }

    const goal = await deps.goalRepo.get(c.req.param('id'));
    if (!goal) {
      return c.json({ error: 'not_found', message: 'Goal not found', status: 404 }, 404);
    }

    const subTasks = await deps.decomposer.decompose(goal);
    goal.sub_tasks = subTasks;

    // Persist updated sub_tasks
    await deps.goalRepo.updateProgress(goal.id, goal.current_value ?? 0, goal.progress_pct);

    return c.json({ goal_id: goal.id, sub_tasks: subTasks });
  });

  // ─── Progress report ────────────────────────────────────────────
  app.get('/v1/goals/:id/progress', async (c) => {
    if (!deps.goalRepo || !deps.tracker) {
      return c.json({ error: 'not_available', message: 'Goal tracking not configured', status: 503 }, 503);
    }

    const goal = await deps.goalRepo.get(c.req.param('id'));
    if (!goal) {
      return c.json({ error: 'not_found', message: 'Goal not found', status: 404 }, 404);
    }

    const reports = await deps.tracker.checkProgress(goal.agent_id ?? '');
    const report = reports.find((r) => r.goal_id === goal.id);
    return c.json(report ?? { goal_id: goal.id, progress_pct: goal.progress_pct });
  });

  return app;
}
