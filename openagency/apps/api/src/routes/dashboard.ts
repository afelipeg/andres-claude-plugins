// ─── Dashboard Routes ────────────────────────────────────────────────
// GET /v1/dashboard/summary — aggregate KPIs for the Command Center

import { Hono } from 'hono';
import type { MeshCoordinator } from '@openagency/agent';
import type { HFLCoordinator } from '@openagency/hfl';
import type { ConnectorInfra } from '../connectors/setup.js';
import type { AgentRegistry } from './agents.js';

export interface DashboardDeps {
  mesh: MeshCoordinator;
  connectorInfra: ConnectorInfra;
  registry: AgentRegistry;
  hfl: HFLCoordinator;
}

export function dashboardRoutes(deps: DashboardDeps) {
  const app = new Hono();

  app.get('/v1/dashboard/summary', (c) => {
    const periodParam = c.req.query('period') ?? '30d';

    // ─── Agent summary ──────────────────────────────────────────
    let activeAgents = 0;
    let totalAgents = 0;
    for (const [, runtime] of deps.registry.agents) {
      totalAgents++;
      const state = runtime.getState();
      if (state.status !== 'idle' && state.status !== 'paused' && state.status !== 'error') {
        activeAgents++;
      }
    }

    // ─── Pipeline runs ──────────────────────────────────────────
    const allRuns = deps.mesh.listRuns();
    const now = Date.now();
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const runsToday = allRuns.filter(
      (r) => r.started_at && new Date(r.started_at).getTime() >= todayStart.getTime(),
    );
    const completedRuns = allRuns.filter((r) => r.status === 'completed');
    const failedRuns = allRuns.filter((r) => r.status === 'failed');

    // ─── Recovery (from stage outputs) ──────────────────────────
    let totalRecovery = 0;
    for (const run of completedRuns) {
      const serialized = deps.mesh.serializeRun(run) as Record<string, unknown>;
      const stageResults = serialized.stage_results as Record<string, Record<string, unknown>> | undefined;
      if (stageResults) {
        for (const [agentId, result] of Object.entries(stageResults)) {
          const output = (result.output_summary ?? {}) as Record<string, number>;
          if (agentId === 'leak-detector') totalRecovery += output.waste_total_usd ?? 0;
          if (agentId === 'media-architect') totalRecovery += output.projected_lift_usd ?? 0;
          if (agentId === 'campaign-ops') totalRecovery += output.efficiency_savings_usd ?? 0;
        }
      }
    }

    // ─── Waste rate ─────────────────────────────────────────────
    let totalSpend = 0;
    let totalWaste = 0;
    for (const run of completedRuns) {
      const serialized = deps.mesh.serializeRun(run) as Record<string, unknown>;
      const stageResults = serialized.stage_results as Record<string, Record<string, unknown>> | undefined;
      if (stageResults?.['leak-detector']) {
        const output = (stageResults['leak-detector'].output_summary ?? {}) as Record<string, number>;
        totalWaste += output.waste_total_usd ?? 0;
        totalSpend += output.gross_spend_usd ?? 0;
      }
    }
    const wasteRate = totalSpend > 0 ? totalWaste / totalSpend : 0;

    // ─── Connected platforms ────────────────────────────────────
    const connectedPlatforms = deps.connectorInfra.credentialStore.platforms().length;

    // ─── HFL pending decisions ──────────────────────────────────
    const pendingDecisions = deps.hfl.listPending().length;

    return c.json({
      total_recovery: totalRecovery,
      waste_rate: Math.round(wasteRate * 10000) / 100, // percentage with 2 decimals
      active_platforms: connectedPlatforms,
      pipeline_runs_today: runsToday.length,
      period: periodParam,
      agents: {
        total: totalAgents,
        active: activeAgents,
      },
      runs: {
        total: allRuns.length,
        completed: completedRuns.length,
        failed: failedRuns.length,
        today: runsToday.length,
      },
      hfl: {
        pending_decisions: pendingDecisions,
      },
    });
  });

  return app;
}
