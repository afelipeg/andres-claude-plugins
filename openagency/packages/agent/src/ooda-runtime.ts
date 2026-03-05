// ─── OODA Loop Runtime ──────────────────────────────────────────────
// Core autonomous agent that implements the Observe-Orient-Decide-Act loop.

import { ulid } from 'ulid';
import type {
  AgentEngine,
  AgentState,
  AgentConfiguration,
  Observation,
  Orientation,
  OodaCycleResult,
  Decision,
  ActionResult,
  PlannedAction,
  PlatformCredentials,
  LLMConfig,
  EventBus,
} from '@openagency/types';
import type { OpenAgency } from '@openagency/core';
import { createLogger } from '@openagency/core';
import type { ConnectorWriteRegistry } from '@openagency/connectors';
import type {
  AgentStateRepo,
  DecisionRepo,
  ActionLogRepo,
  OutcomeRepo,
  MemoryRepo,
  GoalRepo,
} from '@openagency/memory';
import {
  agentCycleStarted,
  agentCycleCompleted,
  agentCycleFailed,
  agentDecisionMade,
  agentActionExecuted,
  agentActionFailed,
} from '@openagency/events';

import { ObserverPipeline } from './observers/pipeline.js';
import { SyncObserver } from './observers/sync-observer.js';
import { EventObserver } from './observers/event-observer.js';
import { ScheduleObserver } from './observers/schedule-observer.js';
import { orient } from './reasoning/orient-prompt.js';
import { decide } from './reasoning/decide-prompt.js';
import { ActionExecutor } from './safety/action-executor.js';
import { OutcomeTracker } from './outcome-tracker.js';
import { GoalTracker } from './goals/goal-tracker.js';
import { GoalDecomposer } from './goals/goal-decomposer.js';
import { getAgentConfig } from './agents/engine-configs.js';

export interface CredentialLookup {
  get(platform: string): PlatformCredentials | undefined;
}

export interface OodaRuntimeDeps {
  engineId: string;
  agency: OpenAgency;
  eventBus: EventBus;
  connectors: ConnectorWriteRegistry;
  llmConfig: LLMConfig;
  config?: Partial<AgentConfiguration>;
  credentialStore?: CredentialLookup;
  goalTracker?: GoalTracker;
  goalDecomposer?: GoalDecomposer;
  // Repos (null if no database)
  agentStateRepo: AgentStateRepo | null;
  decisionRepo: DecisionRepo | null;
  actionLogRepo: ActionLogRepo | null;
  outcomeRepo: OutcomeRepo | null;
  memoryRepo: MemoryRepo | null;
  goalRepo: GoalRepo | null;
}

export class OodaRuntime implements AgentEngine {
  private state: AgentState;
  private observers: ObserverPipeline;
  private actionExecutor: ActionExecutor;
  private outcomeTracker: OutcomeTracker;
  private cycleTimer: ReturnType<typeof setInterval> | null = null;
  private lastCycleAt = 0;
  private log;

  private readonly deps: OodaRuntimeDeps;

  constructor(deps: OodaRuntimeDeps) {
    this.deps = deps;
    this.log = createLogger(`ooda:${deps.engineId}`);

    const engineConfig = getAgentConfig(deps.engineId);
    const mergedConfig: AgentConfiguration = {
      ...engineConfig.default_config,
      ...deps.config,
    };

    this.state = {
      agent_id: deps.engineId,
      engine_id: deps.engineId,
      status: 'idle',
      current_phase: null,
      active_goals: [],
      last_cycle: null,
      cycles_completed: 0,
      configuration: mergedConfig,
      started_at: null,
    };

    this.observers = new ObserverPipeline();
    this.actionExecutor = new ActionExecutor(deps.connectors, deps.actionLogRepo);
    this.outcomeTracker = new OutcomeTracker(deps.outcomeRepo);
  }

  async start(): Promise<void> {
    if (this.state.status !== 'idle' && this.state.status !== 'error') {
      throw new Error(`Agent ${this.state.agent_id} is already ${this.state.status}`);
    }

    const engineConfig = getAgentConfig(this.deps.engineId);

    // Set up observers
    this.observers.addSource(new SyncObserver(this.deps.eventBus));
    this.observers.addSource(
      new EventObserver(this.deps.eventBus, engineConfig.subscriptions),
    );
    this.observers.addSource(
      new ScheduleObserver(this.state.configuration.cycle_interval_ms),
    );

    this.state.status = 'observing';
    this.state.started_at = new Date().toISOString();

    // Persist state
    await this.persistState();

    // Publish start event
    await this.deps.eventBus.publish(
      agentCycleStarted({ agent_id: this.state.agent_id, cycle_id: 'startup' }),
    );
  }

  async pause(): Promise<void> {
    this.state.status = 'paused';
    await this.persistState();
  }

  async resume(): Promise<void> {
    if (this.state.status !== 'paused') {
      throw new Error(`Agent ${this.state.agent_id} is not paused`);
    }
    this.state.status = 'observing';
    await this.persistState();
  }

  async stop(): Promise<void> {
    this.observers.destroy();
    this.outcomeTracker.destroy();

    if (this.cycleTimer) {
      clearInterval(this.cycleTimer);
      this.cycleTimer = null;
    }

    this.state.status = 'idle';
    this.state.current_phase = null;
    await this.persistState();
  }

  getState(): AgentState {
    return { ...this.state };
  }

  async cycle(observations?: Observation[]): Promise<OodaCycleResult> {
    const cycleId = ulid();
    const startedAt = new Date();

    // Rate floor — prevent runaway cycles
    const minInterval = this.state.configuration.min_cycle_interval_ms ?? 0;
    if (minInterval > 0 && Date.now() - this.lastCycleAt < minInterval) {
      this.log.info({ cycleId, agent_id: this.state.agent_id, min_interval_ms: minInterval }, 'Cycle skipped — rate floor');
      return this.emptyResult(cycleId, startedAt);
    }

    this.log.info({ cycleId, agent_id: this.state.agent_id }, 'Cycle started');

    await this.deps.eventBus.publish(
      agentCycleStarted({ agent_id: this.state.agent_id, cycle_id: cycleId }),
    );

    try {
      // ─── OBSERVE ──────────────────────────────────────────────
      this.state.current_phase = 'observe';
      this.state.status = 'observing';
      const obs = observations ?? this.observers.flush();

      this.log.info({ cycleId, observation_count: obs.length }, 'Observe complete');

      if (obs.length === 0) {
        this.log.info({ cycleId }, 'No observations — skipping cycle');
        const result = this.emptyResult(cycleId, startedAt);
        await this.completeCycle(cycleId, result);
        return result;
      }

      // ─── ORIENT ───────────────────────────────────────────────
      this.state.current_phase = 'orient';
      this.state.status = 'orienting';

      // Load goals for context
      let activeGoals: string[] = [];
      if (this.deps.goalRepo) {
        const goals = await this.deps.goalRepo.listActive(this.state.agent_id);
        activeGoals = goals.map((g) => `${g.name}: ${g.target_metric} → ${g.target_value} (${g.progress_pct}%)`);
      }

      // Load recent memory
      let memorySnippets: string[] = [];
      if (this.deps.memoryRepo) {
        const memories = await this.deps.memoryRepo.getRecent(this.state.agent_id, 5);
        memorySnippets = memories.map((m) => {
          const row = m as Record<string, unknown>;
          return String(row['content'] ?? '');
        });
      }

      // Load recent decisions
      let recentDecisions: Array<{ reasoning: string; outcome?: string }> = [];
      if (this.deps.decisionRepo) {
        const decisions = await this.deps.decisionRepo.listByAgent(this.state.agent_id, 3);
        recentDecisions = decisions.map((d) => ({ reasoning: d.reasoning }));
      }

      const orientation = await orient(this.deps.llmConfig, obs, {
        engine_id: this.deps.engineId,
        active_goals: activeGoals,
        recent_decisions: recentDecisions,
        memory_snippets: memorySnippets,
      });

      this.log.info({ cycleId, anomalies: orientation.anomalies.length, opportunities: orientation.opportunities.length }, 'Orient complete');

      // ─── DECIDE ───────────────────────────────────────────────
      this.state.current_phase = 'decide';
      this.state.status = 'deciding';

      const decisionPlan = await decide(this.deps.llmConfig, orientation, {
        engine_id: this.deps.engineId,
        agent_config: {
          max_budget_change_pct: this.state.configuration.max_budget_change_pct,
          approval_threshold_usd: this.state.configuration.approval_threshold_usd,
          dry_run: this.state.configuration.dry_run,
        },
        available_platforms: this.state.configuration.writable_platforms,
        active_goals: activeGoals,
      });

      // Build Decision record
      const decision: Decision = {
        id: ulid(),
        agent_id: this.state.agent_id,
        actions: decisionPlan.actions.map((a) => ({
          id: ulid(),
          type: a.type,
          target: a.target,
          parameters: a.parameters,
          dry_run: this.state.configuration.dry_run,
          safety_checks: [],
          estimated_impact: a.estimated_impact,
          rollback_plan: a.rollback_plan,
        })),
        reasoning: decisionPlan.reasoning,
        confidence: decisionPlan.confidence,
        risk_level: decisionPlan.risk_level,
        requires_approval: decisionPlan.confidence < 0.5 || decisionPlan.risk_level === 'high' || decisionPlan.risk_level === 'critical',
        status: 'pending_approval',
        created_at: new Date().toISOString(),
      };

      // Persist decision
      if (this.deps.decisionRepo) {
        await this.deps.decisionRepo.create(decision);
      }

      await this.deps.eventBus.publish(
        agentDecisionMade({
          agent_id: this.state.agent_id,
          decision_id: decision.id,
          action_count: decision.actions.length,
          confidence: decision.confidence,
          risk_level: decision.risk_level,
          requires_approval: decision.requires_approval,
        }),
      );

      this.log.info({ cycleId, decision_id: decision.id, action_count: decision.actions.length, confidence: decision.confidence }, 'Decide complete');

      // ─── ACT ──────────────────────────────────────────────────
      this.state.current_phase = 'act';
      this.state.status = 'acting';

      let actionResults: ActionResult[] = [];

      if (!decision.requires_approval && decision.actions.length > 0) {
        // Auto-approve and execute
        decision.status = 'approved';
        if (this.deps.decisionRepo) {
          await this.deps.decisionRepo.approve(decision.id, 'auto');
        }

        // Build credentials map from credential store
        const credentials = new Map<string, PlatformCredentials>();
        if (this.deps.credentialStore) {
          for (const platform of this.state.configuration.writable_platforms) {
            const creds = this.deps.credentialStore.get(platform);
            if (creds) credentials.set(platform, creds);
          }
        }

        actionResults = await this.actionExecutor.execute(
          decision,
          credentials,
          {
            max_budget_change_pct: this.state.configuration.max_budget_change_pct,
            approval_threshold_usd: this.state.configuration.approval_threshold_usd,
            dry_run: this.state.configuration.dry_run,
          },
        );

        // Publish action events
        for (const ar of actionResults) {
          if (ar.status === 'executed' || ar.status === 'dry_run') {
            const action = decision.actions.find((a) => a.id === ar.action_id);
            await this.deps.eventBus.publish(
              agentActionExecuted({
                agent_id: this.state.agent_id,
                action_id: ar.action_id,
                action_type: action?.type ?? 'unknown',
                target_platform: action?.target.platform,
                target_id: action?.target.campaign_id,
                duration_ms: ar.duration_ms,
                dry_run: action?.dry_run ?? true,
              }),
            );
          } else if (ar.status === 'failed') {
            const action = decision.actions.find((a) => a.id === ar.action_id);
            await this.deps.eventBus.publish(
              agentActionFailed({
                agent_id: this.state.agent_id,
                action_id: ar.action_id,
                action_type: action?.type ?? 'unknown',
                error: ar.error ?? 'Unknown error',
              }),
            );
          }
        }

        // Record outcome before metrics
        if (this.deps.outcomeRepo) {
          await this.outcomeTracker.recordBefore(decision.id, this.state.agent_id, {});
        }

        decision.status = 'executed';
        if (this.deps.decisionRepo) {
          await this.deps.decisionRepo.updateStatus(decision.id, 'executed');
        }
      }

      // ─── Goal progress check ─────────────────────────────────────
      if (this.deps.goalTracker && this.deps.goalRepo) {
        try {
          const reports = await this.deps.goalTracker.checkProgress(this.state.agent_id);
          for (const report of reports) {
            if (!report.on_track && this.deps.goalDecomposer) {
              this.log.info({ cycleId, goal_id: report.goal_id, progress: report.progress_pct }, 'Goal off track — adjusting plan');
              await this.deps.goalTracker.adjustPlan(report.goal_id, this.deps.goalDecomposer);
            }
          }
        } catch (err) {
          this.log.warn({ err, cycleId }, 'Goal progress check failed');
        }
      }

      // Store in memory
      if (this.deps.memoryRepo) {
        try {
          await this.deps.memoryRepo.store({
            id: ulid(),
            agent_id: this.state.agent_id,
            content: `Cycle ${cycleId}: ${orientation.reasoning.slice(0, 500)}`,
            content_type: 'cycle_summary',
            metadata: { cycle_id: cycleId, decision_id: decision.id },
          });
        } catch {
          // Non-critical
        }
      }

      const result: OodaCycleResult = {
        cycle_id: cycleId,
        agent_id: this.state.agent_id,
        started_at: startedAt.toISOString(),
        completed_at: new Date().toISOString(),
        duration_ms: Date.now() - startedAt.getTime(),
        observe: { observation_count: obs.length },
        orient: orientation,
        decide: { decision_id: decision.id, action_count: decision.actions.length },
        act: {
          results: actionResults.map((ar) => ({
            action_id: ar.action_id,
            type: decision.actions.find((a) => a.id === ar.action_id)?.type ?? 'unknown',
            status: ar.status,
            error: ar.error,
          })),
        },
      };

      this.log.info({ cycleId, duration_ms: result.duration_ms, action_count: result.decide.action_count }, 'Cycle completed');

      this.lastCycleAt = Date.now();
      await this.completeCycle(cycleId, result);
      return result;
    } catch (err) {
      this.log.error({ err, cycleId, phase: this.state.current_phase }, 'Cycle failed');

      this.state.status = 'error';
      await this.persistState();

      await this.deps.eventBus.publish(
        agentCycleFailed({
          agent_id: this.state.agent_id,
          cycle_id: cycleId,
          error: err instanceof Error ? err.message : String(err),
          phase: this.state.current_phase ?? 'unknown',
        }),
      );

      throw err;
    }
  }

  private emptyResult(cycleId: string, startedAt: Date): OodaCycleResult {
    return {
      cycle_id: cycleId,
      agent_id: this.state.agent_id,
      started_at: startedAt.toISOString(),
      completed_at: new Date().toISOString(),
      duration_ms: Date.now() - startedAt.getTime(),
      observe: { observation_count: 0 },
      orient: null,
      decide: { decision_id: null, action_count: 0 },
      act: { results: [] },
    };
  }

  private async completeCycle(cycleId: string, result: OodaCycleResult): Promise<void> {
    this.state.current_phase = null;
    this.state.status = 'observing';
    this.state.last_cycle = result.completed_at;
    this.state.cycles_completed += 1;

    await this.persistState();

    await this.deps.eventBus.publish(
      agentCycleCompleted({
        agent_id: this.state.agent_id,
        cycle_id: cycleId,
        duration_ms: result.duration_ms,
        observation_count: result.observe.observation_count,
        action_count: result.decide.action_count,
      }),
    );
  }

  private async persistState(): Promise<void> {
    if (this.deps.agentStateRepo) {
      try {
        await this.deps.agentStateRepo.upsert(this.state);
      } catch {
        // Non-critical — state is also held in memory
      }
    }
  }
}
