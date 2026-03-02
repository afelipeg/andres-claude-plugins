// ─── Mesh REST Routes ──────────────────────────────────────────────
// POST /v1/mesh/pipelines/:id/execute — trigger pipeline run
// GET  /v1/mesh/pipelines             — list pipelines
// GET  /v1/mesh/runs                  — list runs
// GET  /v1/mesh/runs/:id              — get run detail

import { Hono } from 'hono';
import type { MeshCoordinator } from '@openagency/agent';

export function meshRoutes(mesh: MeshCoordinator) {
  const app = new Hono();

  // ─── List pipelines ──────────────────────────────────────────────
  app.get('/v1/mesh/pipelines', (c) => {
    const pipelines = mesh.listPipelines().map((p) => ({
      id: p.id,
      name: p.name,
      description: p.description,
      trigger: p.trigger,
      stage_count: p.stages.length,
      stages: p.stages.map((s) => ({
        agent_id: s.agent_id,
        order: s.order,
        skills: s.skills,
        timeout_ms: s.timeout_ms,
        trigger_events: s.trigger_events,
        emit_events: s.emit_events,
      })),
    }));

    return c.json({ pipelines });
  });

  // ─── Execute pipeline ────────────────────────────────────────────
  app.post('/v1/mesh/pipelines/:id/execute', async (c) => {
    const pipelineId = c.req.param('id');
    const pipeline = mesh.getPipeline(pipelineId);
    if (!pipeline) {
      return c.json({ error: 'not_found', message: `Pipeline not found: ${pipelineId}` }, 404);
    }

    let goalId: string | undefined;
    let clientId: string | undefined;

    try {
      const body = await c.req.json<{ goal_id?: string; client_id?: string }>();
      goalId = body.goal_id;
      clientId = body.client_id;
    } catch {
      // Empty body is fine
    }

    try {
      const run = await mesh.executePipeline(pipelineId, goalId, clientId);
      return c.json(mesh.serializeRun(run), 201);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return c.json({ error: 'execution_failed', message }, 500);
    }
  });

  // ─── List runs ───────────────────────────────────────────────────
  app.get('/v1/mesh/runs', (c) => {
    const runs = mesh.listRuns().map((run) => ({
      id: run.id,
      pipeline_id: run.pipeline_id,
      status: run.status,
      started_at: run.started_at,
      completed_at: run.completed_at,
      total_duration_ms: run.total_duration_ms,
    }));

    return c.json({ runs });
  });

  // ─── Get run detail ──────────────────────────────────────────────
  app.get('/v1/mesh/runs/:id', (c) => {
    const runId = c.req.param('id');
    const run = mesh.getRun(runId);
    if (!run) {
      return c.json({ error: 'not_found', message: `Run not found: ${runId}` }, 404);
    }

    return c.json(mesh.serializeRun(run));
  });

  return app;
}
