// ─── Mesh Coordinator ──────────────────────────────────────────────
// Orchestrates multi-agent pipelines. The core infrastructure that
// makes OpenAgency a platform, not a tool.

import { ulid } from 'ulid';
import type { EventBus, Observation, OodaCycleResult } from '@openagency/types';
import { createLogger } from '@openagency/core';
import type { OodaRuntime } from '../ooda-runtime.js';
import type {
  MeshPipeline,
  MeshStage,
  MeshStageResult,
  MeshContext,
  MeshRun,
  MeshRunStatus,
  UsageMeter,
} from './types.js';
import { createUsageMeter, recordStageUsage } from './usage-meter.js';
import {
  meshPipelineStarted,
  meshPipelineCompleted,
  meshPipelineFailed,
  meshStageStarted,
  meshStageCompleted,
  meshStageFailed,
  meshStageSkipped,
} from '@openagency/events';

export class MeshCoordinator {
  private pipelines = new Map<string, MeshPipeline>();
  private runs = new Map<string, MeshRun>();
  private eventSubscriptions: Array<() => void> = [];
  private log = createLogger('mesh');

  constructor(
    private agents: Map<string, OodaRuntime>,
    private eventBus: EventBus,
  ) {}

  registerPipeline(pipeline: MeshPipeline): void {
    this.pipelines.set(pipeline.id, pipeline);
  }

  getPipeline(id: string): MeshPipeline | undefined {
    return this.pipelines.get(id);
  }

  listPipelines(): MeshPipeline[] {
    return Array.from(this.pipelines.values());
  }

  /** Subscribe to pipeline trigger events. Call after registering pipelines. */
  start(): void {
    for (const pipeline of this.pipelines.values()) {
      if (pipeline.trigger !== 'manual') {
        const unsub = this.eventBus.subscribe(pipeline.trigger, () => {
          void this.executePipeline(pipeline.id);
        });
        this.eventSubscriptions.push(unsub);
      }
    }
  }

  stop(): void {
    for (const unsub of this.eventSubscriptions) {
      unsub();
    }
    this.eventSubscriptions = [];
  }

  async executePipeline(
    pipelineId: string,
    goalId?: string,
    clientId?: string,
  ): Promise<MeshRun> {
    const pipeline = this.pipelines.get(pipelineId);
    if (!pipeline) {
      throw new Error(`Pipeline not found: ${pipelineId}`);
    }

    const runId = ulid();
    const startedAt = new Date();

    const context: MeshContext = {
      run_id: runId,
      stage_results: new Map(),
      goal_id: goalId,
      started_at: startedAt.toISOString(),
    };

    const usage = createUsageMeter(runId, clientId);

    const run: MeshRun = {
      id: runId,
      pipeline_id: pipelineId,
      status: 'running',
      context,
      started_at: startedAt.toISOString(),
      total_duration_ms: 0,
      usage,
    };

    this.runs.set(runId, run);

    this.log.info({ run_id: runId, pipeline_id: pipelineId, stage_count: pipeline.stages.length }, 'Pipeline started');

    await this.eventBus.publish(
      meshPipelineStarted({
        run_id: runId,
        pipeline_id: pipelineId,
        goal_id: goalId,
        stage_count: pipeline.stages.length,
      }),
    );

    // Execute stages sequentially
    const sortedStages = [...pipeline.stages].sort((a, b) => a.order - b.order);
    let anyFailed = false;

    for (const stage of sortedStages) {
      // Check skip condition
      if (stage.skip_if?.(context)) {
        const skipResult: MeshStageResult = {
          agent_id: stage.agent_id,
          status: 'skipped',
          duration_ms: 0,
          skills_invoked: [],
        };
        context.stage_results.set(stage.agent_id, skipResult);

        await this.eventBus.publish(
          meshStageSkipped({
            run_id: runId,
            pipeline_id: pipelineId,
            agent_id: stage.agent_id,
            stage_order: stage.order,
            reason: 'skip_if condition met',
          }),
        );
        continue;
      }

      const stageResult = await this.executeStage(run, stage, pipeline);
      context.stage_results.set(stage.agent_id, stageResult);

      // Track usage
      if (stageResult.status === 'completed' || stageResult.status === 'failed') {
        recordStageUsage(
          usage,
          stageResult.duration_ms,
          stageResult.cycle_result?.orient,
          stageResult.cycle_result?.act.results.length ?? 0,
        );
      }

      if (stageResult.status === 'failed' || stageResult.status === 'timed_out') {
        anyFailed = true;
        // Continue to next stage — failure doesn't halt the pipeline
      }
    }

    // Finalize run
    const completedAt = new Date();
    run.completed_at = completedAt.toISOString();
    run.total_duration_ms = completedAt.getTime() - startedAt.getTime();
    usage.total_duration_ms = run.total_duration_ms;

    const stagesCompleted = Array.from(context.stage_results.values()).filter(
      (r) => r.status === 'completed',
    ).length;
    const stagesFailed = Array.from(context.stage_results.values()).filter(
      (r) => r.status === 'failed' || r.status === 'timed_out',
    ).length;

    if (stagesCompleted === 0 && anyFailed) {
      run.status = 'failed';
      this.log.error({ run_id: runId, pipeline_id: pipelineId }, 'Pipeline failed — all stages failed');
      await this.eventBus.publish(
        meshPipelineFailed({
          run_id: runId,
          pipeline_id: pipelineId,
          error: 'All stages failed',
          stages_completed: 0,
        }),
      );
    } else if (anyFailed) {
      run.status = 'partial';
      await this.eventBus.publish(
        meshPipelineCompleted({
          run_id: runId,
          pipeline_id: pipelineId,
          total_duration_ms: run.total_duration_ms,
          stages_executed: stagesCompleted,
          stages_failed: stagesFailed,
        }),
      );
    } else {
      run.status = 'completed';
      this.log.info({ run_id: runId, pipeline_id: pipelineId, total_duration_ms: run.total_duration_ms, stages_completed: stagesCompleted }, 'Pipeline completed');
      await this.eventBus.publish(
        meshPipelineCompleted({
          run_id: runId,
          pipeline_id: pipelineId,
          total_duration_ms: run.total_duration_ms,
          stages_executed: stagesCompleted,
          stages_failed: 0,
        }),
      );
    }

    return run;
  }

  private async executeStage(
    run: MeshRun,
    stage: MeshStage,
    pipeline: MeshPipeline,
  ): Promise<MeshStageResult> {
    const agent = this.agents.get(stage.agent_id);
    if (!agent) {
      this.log.error({ run_id: run.id, agent_id: stage.agent_id }, 'Stage agent not found');
      return {
        agent_id: stage.agent_id,
        status: 'failed',
        duration_ms: 0,
        skills_invoked: [],
        error: `Agent not found: ${stage.agent_id}`,
      };
    }

    this.log.info({ run_id: run.id, agent_id: stage.agent_id, stage_order: stage.order }, 'Stage started');

    await this.eventBus.publish(
      meshStageStarted({
        run_id: run.id,
        pipeline_id: pipeline.id,
        agent_id: stage.agent_id,
        stage_order: stage.order,
      }),
    );

    const stageStart = Date.now();

    // Build observations from previous stage results
    const observations: Observation[] = [
      {
        id: ulid(),
        source: 'mesh',
        type: 'event_signal',
        data: {
          event_type: 'mesh.stage.started',
          pipeline_id: pipeline.id,
          run_id: run.id,
          stage_order: stage.order,
          available_skills: stage.skills,
          previous_results: this.summarizePreviousResults(run.context),
        },
        timestamp: new Date().toISOString(),
      },
    ];

    try {
      // Execute with timeout
      const cycleResult = await this.withTimeout(
        agent.cycle(observations),
        stage.timeout_ms,
      );

      const durationMs = Date.now() - stageStart;
      const skillsInvoked = this.extractSkillsInvoked(cycleResult);

      await this.eventBus.publish(
        meshStageCompleted({
          run_id: run.id,
          pipeline_id: pipeline.id,
          agent_id: stage.agent_id,
          stage_order: stage.order,
          duration_ms: durationMs,
          skills_invoked: skillsInvoked,
        }),
      );

      this.log.info({ run_id: run.id, agent_id: stage.agent_id, duration_ms: durationMs, skills_invoked: skillsInvoked }, 'Stage completed');

      const outputSummary = this.extractOutputSummary(cycleResult);

      return {
        agent_id: stage.agent_id,
        status: 'completed',
        cycle_result: cycleResult,
        duration_ms: durationMs,
        skills_invoked: skillsInvoked,
        output_summary: outputSummary,
      };
    } catch (err) {
      const durationMs = Date.now() - stageStart;
      const errorMessage = err instanceof Error ? err.message : String(err);
      const isTimeout = errorMessage === 'Stage timed out';

      if (isTimeout) {
        this.log.warn({ run_id: run.id, agent_id: stage.agent_id, timeout_ms: stage.timeout_ms }, 'Stage timed out');
      } else {
        this.log.error({ run_id: run.id, agent_id: stage.agent_id, err }, 'Stage failed');
      }

      await this.eventBus.publish(
        meshStageFailed({
          run_id: run.id,
          pipeline_id: pipeline.id,
          agent_id: stage.agent_id,
          stage_order: stage.order,
          error: errorMessage,
        }),
      );

      return {
        agent_id: stage.agent_id,
        status: isTimeout ? 'timed_out' : 'failed',
        duration_ms: durationMs,
        skills_invoked: [],
        error: errorMessage,
      };
    }
  }

  private async withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
    return Promise.race([
      promise,
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Stage timed out')), timeoutMs),
      ),
    ]);
  }

  private summarizePreviousResults(context: MeshContext): Record<string, unknown> {
    const summary: Record<string, unknown> = {};
    for (const [agentId, result] of context.stage_results) {
      summary[agentId] = {
        status: result.status,
        skills_invoked: result.skills_invoked,
        duration_ms: result.duration_ms,
        output_summary: result.output_summary,
      };
    }
    return summary;
  }

  private extractOutputSummary(cycleResult: OodaCycleResult): Record<string, unknown> {
    const summary: Record<string, unknown> = {
      observation_count: cycleResult.observe.observation_count,
      action_count: cycleResult.decide.action_count,
      action_results: cycleResult.act.results.map((r) => ({
        type: r.type,
        status: r.status,
      })),
    };

    if (cycleResult.orient) {
      summary['anomaly_count'] = cycleResult.orient.anomalies.length;
      summary['opportunity_count'] = cycleResult.orient.opportunities.length;
      summary['risk_count'] = cycleResult.orient.risks.length;
      summary['reasoning_snippet'] = cycleResult.orient.reasoning.slice(0, 300);
    }

    return summary;
  }

  private extractSkillsInvoked(result: OodaCycleResult): string[] {
    return result.act.results
      .filter((r) => r.type === 'skill_execution')
      .map((r) => r.action_id);
  }

  getRun(id: string): MeshRun | undefined {
    return this.runs.get(id);
  }

  listRuns(): MeshRun[] {
    return Array.from(this.runs.values());
  }

  getUsage(runId: string): UsageMeter | undefined {
    return this.runs.get(runId)?.usage;
  }

  /** Serialize a run for JSON response (Maps → plain objects) */
  serializeRun(run: MeshRun): Record<string, unknown> {
    const stageResults: Record<string, unknown> = {};
    for (const [agentId, result] of run.context.stage_results) {
      stageResults[agentId] = {
        agent_id: result.agent_id,
        status: result.status,
        duration_ms: result.duration_ms,
        skills_invoked: result.skills_invoked,
        output_summary: result.output_summary,
        error: result.error,
        cycle_result: result.cycle_result
          ? {
              cycle_id: result.cycle_result.cycle_id,
              duration_ms: result.cycle_result.duration_ms,
              observations: result.cycle_result.observe.observation_count,
              actions: result.cycle_result.decide.action_count,
              results: result.cycle_result.act.results,
            }
          : undefined,
      };
    }

    return {
      id: run.id,
      pipeline_id: run.pipeline_id,
      status: run.status,
      started_at: run.started_at,
      completed_at: run.completed_at,
      total_duration_ms: run.total_duration_ms,
      goal_id: run.context.goal_id,
      stage_results: stageResults,
      usage: run.usage,
    };
  }
}
