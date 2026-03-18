// ─── Mesh REST Routes ──────────────────────────────────────────────
// POST /v1/mesh/pipelines/:id/execute — trigger pipeline run
// GET  /v1/mesh/pipelines             — list pipelines
// GET  /v1/mesh/runs                  — list runs (paginated, filterable)
// GET  /v1/mesh/runs/:id              — get run detail with HFL decision
// GET  /v1/mesh/runs/:id/recovery     — recovery breakdown for scorecard
// POST /v1/mesh/schedules             — create schedule
// GET  /v1/mesh/schedules             — list schedules
// DELETE /v1/mesh/schedules/:id       — delete schedule

import { Hono } from 'hono';
import type { MeshCoordinator, MeshRun } from '@openagency/agent';
import { computePipelineScore, HFL_SCORE_THRESHOLD } from '@openagency/agent';
import type { PipelineScheduler } from '@openagency/agent';
import type { HFLCoordinator, MeshRunSummary } from '@openagency/hfl';
import { createScorecardFromMeshRun } from './scorecard.js';
import type { ConnectorInfra } from '../connectors/setup.js';
import { assembleContextFromSync, mergeClientBatchData, mergeMcpData, validateSkillContext } from '../connectors/context-assembler.js';
import { createLogger } from '@openagency/core';
import type { ClientDataRepo, ScorecardDbRepo } from '@openagency/memory';
import type { McpClientRegistry } from '@openagency/agent';

const meshLog = createLogger('mesh-routes');

export function meshRoutes(mesh: MeshCoordinator, hfl?: HFLCoordinator, scheduler?: PipelineScheduler, connectorInfra?: ConnectorInfra, clientDataRepo?: ClientDataRepo, mcpClientRegistry?: McpClientRegistry, scorecardDbRepo?: ScorecardDbRepo) {
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
    let explicitContext: Record<string, unknown> | undefined;
    let runType: string = 'standard';

    try {
      const body = await c.req.json<{ goal_id?: string; client_id?: string; context?: Record<string, unknown>; run_type?: string }>();
      goalId = body.goal_id;
      clientId = body.client_id;
      explicitContext = body.context;
      if (body.run_type === 'plan' || body.run_type === 'actual') runType = body.run_type;
    } catch {
      // Empty body is fine
    }

    // Auto-assemble skillContext from live platform sync data + explicit overrides
    let skillContext = connectorInfra
      ? assembleContextFromSync(connectorInfra.syncResultCache, explicitContext)
      : (explicitContext ?? {});

    // Merge human batch uploads (sell-in, sell-out, digital sales) if available
    if (clientId && clientDataRepo) {
      try {
        const batchData = await clientDataRepo.getLatestBatchContext(clientId);
        if (Object.keys(batchData).length > 0) {
          skillContext = mergeClientBatchData(skillContext, batchData);
        }
      } catch {
        // Batch data fetch failure doesn't block pipeline
      }
    }

    // Merge MCP data from connected external servers
    if (mcpClientRegistry) {
      try {
        skillContext = await mergeMcpData(skillContext, mcpClientRegistry, clientId ?? 'default');
      } catch {
        // MCP data fetch failure doesn't block pipeline
      }
    }

    // ─── Validate context has data sources ───────────────────────────
    const validation = validateSkillContext(skillContext);
    meshLog.info({
      pipeline: pipelineId,
      client_id: clientId,
      sources: validation.source_count,
      sync: validation.sync_platforms,
      batch: validation.has_batch_data,
      mcp: validation.mcp_servers,
      gross_spend: validation.gross_spend,
      warnings: validation.warnings,
    }, 'Pipeline context validation');

    // Hard stop: do NOT execute pipeline with zero data sources
    if (validation.source_count === 0) {
      return c.json({
        error: 'NO_DATA_SOURCES',
        message: 'Pipeline cannot execute with empty context. Connect a platform (API/MCP) or upload batch data first.',
        context_validation: validation,
      }, 422);
    }

    skillContext._context_validation = validation;

    // Auto-detect run_type: first run = 'plan', subsequent = 'actual'
    if (clientId && scorecardDbRepo && runType === 'standard') {
      try {
        const previousPlan = await scorecardDbRepo.getLatestByClient(clientId, 'plan');
        if (!previousPlan) {
          runType = 'plan'; // First run for this client — save as plan snapshot
        } else {
          runType = 'actual'; // Plan exists — this is an actual run
        }
      } catch {
        // Detection failure defaults to 'standard'
      }
    }

    // Inject previous run baseline for plan vs actual comparison
    if (clientId && scorecardDbRepo) {
      try {
        const previousScorecard = await scorecardDbRepo.getLatestByClient(clientId, 'plan');
        if (previousScorecard) {
          const prevBilling = previousScorecard.billing as Record<string, unknown>;
          skillContext._previous_run = {
            run_id: previousScorecard.run_id,
            run_type: previousScorecard.run_type,
            billing: prevBilling,
            engine_outputs: previousScorecard.engine_outputs,
            created_at: previousScorecard.created_at,
          };
          skillContext._baseline = {
            roas: (prevBilling as Record<string, unknown>)?.roi_on_fee ?? 2.0,
            waste_pct: ((prevBilling as Record<string, unknown>)?.recovery as Record<string, unknown>)?.waste_pct ?? 20,
          };
        }
      } catch {
        // Previous run fetch failure doesn't block pipeline
      }
    }

    try {
      const run = await mesh.executePipeline(pipelineId, goalId, clientId, skillContext);
      const serialized = mesh.serializeRun(run) as Record<string, unknown>;

      // ─── HFL evaluation after pipeline completes ─────────────────
      if (hfl && run.status === 'completed') {
        const hflResult = await evaluateHFL(hfl, run, mesh, clientId);
        serialized.hfl_decision = hflResult;
      }

      // ─── Auto-create scorecard from completed pipeline ───────────
      if (run.status === 'completed') {
        const stageResults = serialized.stage_results as Record<string, Record<string, unknown>> | undefined;
        if (stageResults) {
          try {
            const scorecard = createScorecardFromMeshRun(stageResults, {
              run_id: run.id,
              client_id: clientId,
              run_type: runType,
            });
            serialized.scorecard = {
              id: scorecard.id,
              total_fee: scorecard.billing.total_fee,
              value_delivered: scorecard.billing.value_delivered,
              roi_on_fee: scorecard.billing.roi_on_fee,
              tier: scorecard.billing.tier.label,
              status: scorecard.status,
            };
          } catch {
            // Scorecard creation failure doesn't block pipeline response
          }
        }
      }

      serialized.context_validation = validation;
      return c.json(serialized, 201);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return c.json({ error: 'execution_failed', message, context_validation: validation }, 500);
    }
  });

  // ─── List runs (paginated) ────────────────────────────────────────
  app.get('/v1/mesh/runs', async (c) => {
    const page = Math.max(1, parseInt(c.req.query('page') ?? '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt(c.req.query('limit') ?? '20', 10)));
    const statusFilter = c.req.query('status');
    const offset = (page - 1) * limit;

    const [pageRuns, total] = await Promise.all([
      mesh.listRunsAsync({ limit, offset, status: statusFilter }),
      mesh.countRunsAsync(statusFilter ? { status: statusFilter } : undefined),
    ]);

    const totalPages = Math.ceil(total / limit);

    const runs = pageRuns.map((run) => {
      const base: Record<string, unknown> = {
        id: run.id,
        pipeline_id: run.pipeline_id,
        status: run.status,
        started_at: run.started_at,
        completed_at: run.completed_at,
        total_duration_ms: run.total_duration_ms,
      };

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
  app.get('/v1/mesh/runs/:id', async (c) => {
    const runId = c.req.param('id');
    const run = await mesh.getRunAsync(runId);
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
  app.get('/v1/mesh/runs/:id/recovery', async (c) => {
    const runId = c.req.param('id');
    const run = await mesh.getRunAsync(runId);
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
  app.get('/v1/recovery/history', async (c) => {
    const monthsParam = Math.min(24, Math.max(1, parseInt(c.req.query('months') ?? '12', 10)));
    const completedRuns = await mesh.listRunsAsync({ limit: 500, status: 'completed' });

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

  // ─── Schedule routes ─────────────────────────────────────────────

  app.post('/v1/mesh/schedules', async (c) => {
    if (!scheduler) {
      return c.json({ error: 'not_available', message: 'Scheduler not initialized' }, 503);
    }

    let body: Record<string, unknown>;
    try {
      body = await c.req.json<Record<string, unknown>>();
    } catch {
      return c.json({ error: 'invalid_body', message: 'JSON body required' }, 400);
    }

    const { client_id, pipeline_id, cron, auto_approve, notify_on_complete, enabled } = body;

    if (!client_id || !pipeline_id || !cron) {
      return c.json({ error: 'missing_fields', message: 'client_id, pipeline_id, and cron are required' }, 400);
    }

    // Validate pipeline exists
    const pipeline = mesh.getPipeline(pipeline_id as string);
    if (!pipeline) {
      return c.json({ error: 'not_found', message: `Pipeline not found: ${pipeline_id}` }, 404);
    }

    try {
      const schedule = await scheduler.createSchedule({
        client_id: client_id as string,
        pipeline_id: pipeline_id as string,
        cron: cron as string,
        auto_approve: auto_approve as boolean | undefined,
        notify_on_complete: notify_on_complete as boolean | undefined,
        enabled: enabled as boolean | undefined,
      });
      return c.json(schedule, 201);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return c.json({ error: 'create_failed', message }, 500);
    }
  });

  app.get('/v1/mesh/schedules', (c) => {
    if (!scheduler) {
      return c.json({ error: 'not_available', message: 'Scheduler not initialized' }, 503);
    }
    const clientId = c.req.query('client_id');
    const schedules = scheduler.listSchedules(clientId);
    return c.json({ schedules, total: schedules.length });
  });

  app.delete('/v1/mesh/schedules/:id', async (c) => {
    if (!scheduler) {
      return c.json({ error: 'not_available', message: 'Scheduler not initialized' }, 503);
    }
    const id = c.req.param('id');
    const deleted = await scheduler.deleteSchedule(id);
    if (!deleted) {
      return c.json({ error: 'not_found', message: `Schedule not found: ${id}` }, 404);
    }
    return c.json({ deleted: true, id });
  });

  return app;
}

// ─── HFL Evaluation Helper ──────────────────────────────────────────

async function evaluateHFL(
  hfl: HFLCoordinator,
  run: MeshRun,
  mesh: MeshCoordinator,
  clientId?: string,
): Promise<Record<string, unknown>> {
  // Build MeshRunSummary from the completed run
  const stageResults: Record<string, { agent_id: string; status: string; duration_ms: number; skills_invoked: string[]; output_summary?: Record<string, unknown>; error?: string }> = {};
  for (const [agentId, result] of run.context.stage_results) {
    stageResults[agentId] = {
      agent_id: result.agent_id,
      status: result.status,
      duration_ms: result.duration_ms,
      skills_invoked: result.skills_invoked,
      output_summary: result.output_summary,
      error: result.error,
    };
  }

  // Compute pipeline quality score for force-escalation check
  const pipelineScore = computePipelineScore(run.context.stage_results);
  const forceEscalate = pipelineScore.composite < HFL_SCORE_THRESHOLD;

  const summary: MeshRunSummary = {
    id: run.id,
    pipeline_id: run.pipeline_id,
    status: run.status,
    total_duration_ms: run.total_duration_ms ?? 0,
    client_id: clientId,
    stage_results: stageResults,
  };

  const decision = await hfl.evaluate(summary, forceEscalate);

  return {
    id: decision.id,
    status: decision.status,
    urgency: decision.urgency,
    needs_human: decision.needs_human,
    reason: decision.reason,
    risk_score: decision.risk_score,
    pipeline_score: pipelineScore,
  };
}
