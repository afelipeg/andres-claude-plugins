// ─── HFL Coordinator ────────────────────────────────────────────────
// Orchestrates the full Human Feedback Loop:
//   1. Receives completed MeshRun
//   2. Risk Scorer evaluates → needs_human?
//   3. If no → auto-approve, emit event, execute actions
//   4. If yes → Render Engine → Channel Dispatcher → wait for response
//   5. Response arrives via REST → execute or abort → emit event

import { ulid } from 'ulid';
import { createLogger } from '@openagency/core';
import type { EventBus } from '@openagency/types';
import { RiskScorer, createDefaultConfig } from './risk-scorer.js';
import { RenderEngine } from './render-engine.js';
import type { StageResultSummary, BillingSummary } from './render-engine.js';
import { ChannelDispatcher } from './channel-dispatcher.js';
import type {
  HFLConfig,
  HFLDecision,
  HFLStatus,
  RiskInput,
  ChannelConfig,
} from './types.js';
import {
  hflEscalated,
  hflAutoApproved,
  hflHumanApproved,
  hflHumanRejected,
  hflDispatched,
  hflTimeout,
} from './hfl-events.js';

const log = createLogger('hfl');

export interface MeshRunSummary {
  id: string;
  pipeline_id: string;
  status: string;
  total_duration_ms: number;
  client_id?: string;
  stage_results: Record<string, StageResultSummary>;
  billing?: BillingSummary;
  usage?: {
    llm_tokens_used: { prompt: number; completion: number };
    actions_executed: number;
  };
}

export interface HFLCoordinatorOptions {
  base_url: string;
}

export class HFLCoordinator {
  private configs = new Map<string, HFLConfig>();
  private decisions = new Map<string, HFLDecision>();
  private pendingByRunId = new Map<string, string>(); // run_id → decision_id
  private riskScorers = new Map<string, RiskScorer>();
  private renderEngine = new RenderEngine();
  private dispatcher = new ChannelDispatcher();
  private runCounter = new Map<string, number>(); // client_id → run count
  private baseUrl: string;

  constructor(
    private eventBus: EventBus,
    options?: Partial<HFLCoordinatorOptions>,
  ) {
    this.baseUrl = options?.base_url ?? process.env['API_BASE_URL'] ?? 'http://localhost:3100';
  }

  // ─── Configuration ──────────────────────────────────────────────

  setConfig(config: HFLConfig): void {
    this.configs.set(config.client_id, config);
    this.riskScorers.set(config.client_id, new RiskScorer(config));
  }

  getConfig(clientId: string): HFLConfig | undefined {
    return this.configs.get(clientId);
  }

  // ─── Core evaluation flow ────────────────────────────────────────

  async evaluate(run: MeshRunSummary): Promise<HFLDecision> {
    const clientId = run.client_id ?? 'default';
    const config = this.configs.get(clientId) ?? createDefaultConfig(clientId);

    // Ensure scorer exists
    if (!this.riskScorers.has(clientId)) {
      this.riskScorers.set(clientId, new RiskScorer(config));
    }
    const scorer = this.riskScorers.get(clientId)!;

    // Track run count for is_first_run detection
    const runCount = this.runCounter.get(clientId) ?? 0;
    this.runCounter.set(clientId, runCount + 1);

    // Build risk input
    const stagesExecuted = Object.values(run.stage_results).filter(
      (s) => s.status === 'completed',
    ).length;
    const stagesFailed = Object.values(run.stage_results).filter(
      (s) => s.status === 'failed' || s.status === 'timed_out',
    ).length;

    const riskInput: RiskInput = {
      run_id: run.id,
      pipeline_id: run.pipeline_id,
      client_id: clientId,
      total_duration_ms: run.total_duration_ms,
      stages_executed: stagesExecuted,
      stages_failed: stagesFailed,
      usage: run.usage,
      is_first_run: runCount === 0,
    };

    const riskScore = scorer.evaluate(riskInput);

    const decisionId = ulid();
    const now = new Date().toISOString();

    if (!riskScore.needs_human) {
      // ─── Auto-approve ─────────────────────────────────────────
      const decision: HFLDecision = {
        id: decisionId,
        run_id: run.id,
        pipeline_id: run.pipeline_id,
        client_id: clientId,
        needs_human: false,
        urgency: riskScore.urgency,
        reason: riskScore.reason,
        status: 'auto_approved',
        risk_score: riskScore,
        created_at: now,
        resolved_at: now,
      };

      this.decisions.set(decisionId, decision);
      log.info({ run_id: run.id, decision_id: decisionId }, 'Auto-approved');

      await this.eventBus.publish(
        hflAutoApproved({
          decision_id: decisionId,
          run_id: run.id,
          pipeline_id: run.pipeline_id,
          reason: riskScore.reason,
        }),
      );

      return decision;
    }

    // ─── Needs human → render + dispatch ──────────────────────────

    // Resolve channel
    const channel = this.resolveChannel(config, riskScore.urgency);
    const complexity = this.renderEngine.determineComplexity(run.stage_results);

    // Render payload
    const renderOutput = this.renderEngine.render(
      {
        channel: channel ?? { id: 'none', type: 'webhook', url: '', render_level: 'rich', active: false },
        urgency: riskScore.urgency,
        complexity,
      },
      {
        run_id: run.id,
        pipeline_id: run.pipeline_id,
        risk_score: riskScore,
        stage_results: run.stage_results,
        billing: run.billing,
        base_url: this.baseUrl,
        scorecard_base_url: config.scorecard_base_url,
      },
    );

    const decision: HFLDecision = {
      id: decisionId,
      run_id: run.id,
      pipeline_id: run.pipeline_id,
      client_id: clientId,
      needs_human: true,
      urgency: riskScore.urgency,
      reason: riskScore.reason,
      status: 'escalated',
      risk_score: riskScore,
      render_output: renderOutput,
      created_at: now,
    };

    // Dispatch if channel available
    if (channel?.active) {
      const dispatchResult = await this.dispatcher.dispatch(
        channel,
        renderOutput,
        { decision_id: decisionId, run_id: run.id },
      );

      decision.dispatched_to = channel.id;
      decision.dispatch_result = dispatchResult;

      await this.eventBus.publish(
        hflDispatched({
          decision_id: decisionId,
          run_id: run.id,
          channel_id: channel.id,
          success: dispatchResult.success,
        }),
      );
    }

    this.decisions.set(decisionId, decision);
    this.pendingByRunId.set(run.id, decisionId);

    log.info(
      { run_id: run.id, decision_id: decisionId, urgency: riskScore.urgency, channel: channel?.id },
      'Escalated to human',
    );

    await this.eventBus.publish(
      hflEscalated({
        decision_id: decisionId,
        run_id: run.id,
        pipeline_id: run.pipeline_id,
        urgency: riskScore.urgency,
        reason: riskScore.reason,
        channel_id: channel?.id,
      }),
    );

    // Set timeout if configured
    if (config.timeout_ms > 0) {
      setTimeout(() => {
        void this.handleTimeout(decisionId);
      }, config.timeout_ms);
    }

    return decision;
  }

  // ─── Human responses ──────────────────────────────────────────────

  async approveRun(runId: string, feedback?: string): Promise<HFLDecision | undefined> {
    const decisionId = this.pendingByRunId.get(runId);
    if (!decisionId) return undefined;

    const decision = this.decisions.get(decisionId);
    if (!decision || decision.status !== 'escalated') return undefined;

    decision.status = 'human_approved';
    decision.human_response = 'approved';
    decision.human_feedback = feedback;
    decision.resolved_at = new Date().toISOString();

    this.pendingByRunId.delete(runId);

    log.info({ run_id: runId, decision_id: decisionId }, 'Human approved');

    await this.eventBus.publish(
      hflHumanApproved({
        decision_id: decisionId,
        run_id: runId,
        pipeline_id: decision.pipeline_id,
        feedback,
      }),
    );

    return decision;
  }

  async rejectRun(runId: string, feedback?: string): Promise<HFLDecision | undefined> {
    const decisionId = this.pendingByRunId.get(runId);
    if (!decisionId) return undefined;

    const decision = this.decisions.get(decisionId);
    if (!decision || decision.status !== 'escalated') return undefined;

    decision.status = 'human_rejected';
    decision.human_response = 'rejected';
    decision.human_feedback = feedback;
    decision.resolved_at = new Date().toISOString();

    this.pendingByRunId.delete(runId);

    log.info({ run_id: runId, decision_id: decisionId, feedback }, 'Human rejected');

    await this.eventBus.publish(
      hflHumanRejected({
        decision_id: decisionId,
        run_id: runId,
        pipeline_id: decision.pipeline_id,
        feedback,
      }),
    );

    return decision;
  }

  // ─── Timeout handling ─────────────────────────────────────────────

  private async handleTimeout(decisionId: string): Promise<void> {
    const decision = this.decisions.get(decisionId);
    if (!decision || decision.status !== 'escalated') return;

    decision.status = 'timed_out';
    decision.resolved_at = new Date().toISOString();
    this.pendingByRunId.delete(decision.run_id);

    log.warn({ decision_id: decisionId, run_id: decision.run_id }, 'Decision timed out');

    await this.eventBus.publish(
      hflTimeout({
        decision_id: decisionId,
        run_id: decision.run_id,
        pipeline_id: decision.pipeline_id,
      }),
    );
  }

  // ─── Query ────────────────────────────────────────────────────────

  getDecision(id: string): HFLDecision | undefined {
    return this.decisions.get(id);
  }

  getDecisionByRunId(runId: string): HFLDecision | undefined {
    const decisionId = this.pendingByRunId.get(runId);
    if (decisionId) return this.decisions.get(decisionId);
    // Search resolved decisions
    for (const d of this.decisions.values()) {
      if (d.run_id === runId) return d;
    }
    return undefined;
  }

  listDecisions(limit = 50): HFLDecision[] {
    return Array.from(this.decisions.values())
      .sort((a, b) => b.created_at.localeCompare(a.created_at))
      .slice(0, limit);
  }

  listPending(): HFLDecision[] {
    return Array.from(this.decisions.values()).filter(
      (d) => d.status === 'escalated',
    );
  }

  // ─── Helpers ──────────────────────────────────────────────────────

  private resolveChannel(config: HFLConfig, urgency: string): ChannelConfig | undefined {
    // Check escalation rules for channel override
    for (const rule of config.escalation_rules) {
      if (rule.urgency === urgency && rule.channel_id) {
        const ch = config.channels.find((c) => c.id === rule.channel_id);
        if (ch) return ch;
      }
    }

    // Fall back to default channel
    if (config.default_channel) {
      return config.channels.find((c) => c.id === config.default_channel);
    }

    // Fall back to first active channel
    return config.channels.find((c) => c.active);
  }
}
