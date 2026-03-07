// ─── Mesh REST Routes ──────────────────────────────────────────────
// POST /v1/mesh/pipelines/:id/execute — trigger pipeline run
// GET  /v1/mesh/pipelines             — list pipelines
// GET  /v1/mesh/runs                  — list runs (paginated, filterable)
// GET  /v1/mesh/runs/:id              — get run detail with HFL decision
// GET  /v1/mesh/runs/:id/recovery     — recovery breakdown for scorecard

import { Hono } from 'hono';
import type { MeshCoordinator } from '@openagency/agent';
import type { HFLCoordinator } from '@openagency/hfl';

export function meshRoutes(mesh: MeshCoordinator, hfl?: HFLCoordinator) {
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

  // ─── List runs (paginated) ────────────────────────────────────────
  app.get('/v1/mesh/runs', (c) => {
    const page = Math.max(1, parseInt(c.req.query('page') ?? '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt(c.req.query('limit') ?? '20', 10)));
    const statusFilter = c.req.query('status'); // 'completed' | 'running' | 'failed'

    let allRuns = mesh.listRuns();

    // Sort newest first
    allRuns.sort((a, b) => {
      const aTime = a.started_at ?? '';
      const bTime = b.started_at ?? '';
      return bTime.localeCompare(aTime);
    });

    // Filter by status if provided
    if (statusFilter) {
      allRuns = allRuns.filter((r) => r.status === statusFilter);
    }

    const total = allRuns.length;
    const totalPages = Math.ceil(total / limit);
    const offset = (page - 1) * limit;
    const pageRuns = allRuns.slice(offset, offset + limit);

    const runs = pageRuns.map((run) => {
      const base: Record<string, unknown> = {
        id: run.id,
        pipeline_id: run.pipeline_id,
        status: run.status,
        started_at: run.started_at,
        completed_at: run.completed_at,
        total_duration_ms: run.total_duration_ms,
      };

      // Include HFL decision summary if available
      if (hfl) {
        const decision = hfl.getDecisionByRunId(run.id);
        if (decision) {
          base.hfl = {
            decision_id: decision.id,
            status: decision.status,
            urgency: decision.urgency,
            needs_human: decision.needs_human,
          };
        }
      }

      return base;
    });

    return c.json({
      runs,
      pagination: {
        page,
        limit,
        total,
        total_pages: totalPages,
        has_next: page < totalPages,
        has_prev: page > 1,
      },
    });
  });

  // ─── Get run detail (with full HFL decision) ─────────────────────
  app.get('/v1/mesh/runs/:id', (c) => {
    const runId = c.req.param('id');
    const run = mesh.getRun(runId);
    if (!run) {
      return c.json({ error: 'not_found', message: `Run not found: ${runId}` }, 404);
    }

    const serialized = mesh.serializeRun(run) as Record<string, unknown>;

    // Attach full HFL decision (includes Nivel 3 payload if available)
    if (hfl) {
      const decision = hfl.getDecisionByRunId(runId);
      if (decision) {
        serialized.hfl_decision = {
          id: decision.id,
          status: decision.status,
          urgency: decision.urgency,
          needs_human: decision.needs_human,
          reason: decision.reason,
          risk_score: decision.risk_score,
          render_output: decision.render_output,
          dispatch_result: decision.dispatch_result,
          dispatched_to: decision.dispatched_to,
          human_response: decision.human_response,
          human_feedback: decision.human_feedback,
          created_at: decision.created_at,
          resolved_at: decision.resolved_at,
        };
      }
    }

    return c.json(serialized);
  });

  // ─── Recovery breakdown for a run ─────────────────────────────────
  // Returns per-stage recovery/savings data for the scorecard dashboard.
  app.get('/v1/mesh/runs/:id/recovery', (c) => {
    const runId = c.req.param('id');
    const run = mesh.getRun(runId);
    if (!run) {
      return c.json({ error: 'not_found', message: `Run not found: ${runId}` }, 404);
    }

    const serialized = mesh.serializeRun(run) as Record<string, unknown>;
    const stageResults = serialized.stage_results as
      Record<string, Record<string, unknown>> | undefined;

    // Build recovery breakdown from stage outputs
    const breakdown: Array<{
      agent_id: string;
      status: string;
      skills_invoked: string[];
      duration_ms: number;
      output_summary: Record<string, unknown>;
      recovery_items: Array<{ type: string; description: string; value_usd: number }>;
    }> = [];

    let totalRecovery = 0;

    if (stageResults) {
      for (const [agentId, result] of Object.entries(stageResults)) {
        const outputSummary = (result.output_summary ?? {}) as Record<string, unknown>;
        const recoveryItems: Array<{ type: string; description: string; value_usd: number }> = [];

        // Extract recovery items from output_summary based on agent type
        if (agentId === 'leak-detector') {
          const wasteTotal = (outputSummary.waste_total_usd as number) ?? 0;
          if (wasteTotal > 0) {
            recoveryItems.push({
              type: 'waste_recovery',
              description: 'Identified wasted ad spend',
              value_usd: wasteTotal,
            });
            totalRecovery += wasteTotal;
          }
        }
        if (agentId === 'media-architect') {
          const liftValue = (outputSummary.projected_lift_usd as number) ?? 0;
          if (liftValue > 0) {
            recoveryItems.push({
              type: 'media_lift',
              description: 'Projected lift from media optimization',
              value_usd: liftValue,
            });
            totalRecovery += liftValue;
          }
        }
        if (agentId === 'campaign-ops') {
          const savings = (outputSummary.efficiency_savings_usd as number) ?? 0;
          if (savings > 0) {
            recoveryItems.push({
              type: 'efficiency',
              description: 'Campaign efficiency savings',
              value_usd: savings,
            });
            totalRecovery += savings;
          }
        }

        breakdown.push({
          agent_id: agentId,
          status: result.status as string,
          skills_invoked: (result.skills_invoked as string[]) ?? [],
          duration_ms: (result.duration_ms as number) ?? 0,
          output_summary: outputSummary,
          recovery_items: recoveryItems,
        });
      }
    }

    return c.json({
      run_id: runId,
      pipeline_id: run.pipeline_id,
      status: run.status,
      total_recovery_usd: totalRecovery,
      breakdown,
    });
  });

  // ─── Recovery history (12-month trend) ─────────────────────────
  app.get('/v1/recovery/history', (c) => {
    const monthsParam = Math.min(24, Math.max(1, parseInt(c.req.query('months') ?? '12', 10)));
    const completedRuns = mesh.listRuns().filter((r) => r.status === 'completed');

    // Group recovery by month
    const monthMap = new Map<string, number>();

    for (const run of completedRuns) {
      const serialized = mesh.serializeRun(run) as Record<string, unknown>;
      const stageResults = serialized.stage_results as Record<string, Record<string, unknown>> | undefined;
      if (!stageResults) continue;

      const month = run.started_at
        ? run.started_at.substring(0, 7)
        : new Date().toISOString().substring(0, 7);

      let runRecovery = 0;
      for (const [agentId, result] of Object.entries(stageResults)) {
        const output = (result.output_summary ?? {}) as Record<string, number>;
        if (agentId === 'leak-detector') runRecovery += output.waste_total_usd ?? 0;
        if (agentId === 'media-architect') runRecovery += output.projected_lift_usd ?? 0;
        if (agentId === 'campaign-ops') runRecovery += output.efficiency_savings_usd ?? 0;
      }

      monthMap.set(month, (monthMap.get(month) ?? 0) + runRecovery);
    }

    // Build month array sorted chronologically
    const months: Array<{ month: string; recovery: number; cumulative_recovery: number; delta_pct: number }> = [];
    let cumulative = 0;
    let prevRecovery = 0;

    const sortedMonths = Array.from(monthMap.entries()).sort((a, b) => a[0].localeCompare(b[0]));
    const recent = sortedMonths.slice(-monthsParam);

    for (const [month, recovery] of recent) {
      cumulative += recovery;
      const deltaPct = prevRecovery > 0
        ? Math.round(((recovery - prevRecovery) / prevRecovery) * 10000) / 100
        : 0;
      months.push({ month, recovery, cumulative_recovery: cumulative, delta_pct: deltaPct });
      prevRecovery = recovery;
    }

    return c.json({
      months,
      total_recovery: cumulative,
      period_months: monthsParam,
    });
  });

  return app;
}
