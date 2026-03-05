// ─── Action Executor ────────────────────────────────────────────────
// Bridges decisions to connector writes through the safety pipeline.

import { ulid } from 'ulid';
import type {
  Decision,
  PlannedAction,
  ActionResult,
  PlatformCredentials,
  ConnectorPlatform,
  WriteOperation,
  SafetyContext,
} from '@openagency/types';
import type { ConnectorWriteRegistry } from '@openagency/connectors';
import type { ActionLogRepo } from '@openagency/memory';
import { createLogger } from '@openagency/core';

export class ActionExecutor {
  private log = createLogger('action');

  constructor(
    private writeRegistry: ConnectorWriteRegistry,
    private actionLogRepo: ActionLogRepo | null,
  ) {}

  async execute(
    decision: Decision,
    credentials: Map<string, PlatformCredentials>,
    agentConfig: { max_budget_change_pct: number; approval_threshold_usd: number; dry_run: boolean },
  ): Promise<ActionResult[]> {
    const results: ActionResult[] = [];

    for (const action of decision.actions) {
      const startedAt = new Date();
      let result: ActionResult;

      this.log.info({ action_id: action.id, type: action.type, platform: action.target.platform }, 'Executing action');

      try {
        if (action.type === 'skill_execution' || action.type === 'notification') {
          // These don't go through connector writes
          result = {
            action_id: action.id,
            status: 'executed',
            result: { type: action.type, parameters: action.parameters },
            executed_at: startedAt.toISOString(),
            duration_ms: 0,
            rollback_available: false,
          };
        } else {
          result = await this.executeConnectorWrite(action, credentials, agentConfig, decision.agent_id);
        }
      } catch (err) {
        this.log.error({ action_id: action.id, err }, 'Action failed');
        result = {
          action_id: action.id,
          status: 'failed',
          error: err instanceof Error ? err.message : String(err),
          executed_at: startedAt.toISOString(),
          duration_ms: Date.now() - startedAt.getTime(),
          rollback_available: false,
        };
      }

      results.push(result);

      // Log to action_log repo
      if (this.actionLogRepo) {
        try {
          await this.actionLogRepo.create({
            id: ulid(),
            decision_id: decision.id,
            agent_id: decision.agent_id,
            action_type: action.type,
            target_platform: action.target.platform,
            target_id: action.target.campaign_id ?? action.target.ad_set_id,
            parameters: action.parameters,
            previous_value: undefined,
            new_value: result.result,
            status: result.status,
            dry_run: action.dry_run,
            duration_ms: result.duration_ms,
          });
        } catch {
          // Don't fail the action if logging fails
        }
      }
    }

    return results;
  }

  private async executeConnectorWrite(
    action: PlannedAction,
    credentials: Map<string, PlatformCredentials>,
    agentConfig: { max_budget_change_pct: number; approval_threshold_usd: number; dry_run: boolean },
    agentId?: string,
  ): Promise<ActionResult> {
    const platform = action.target.platform as ConnectorPlatform | undefined;
    if (!platform) {
      return {
        action_id: action.id,
        status: 'skipped',
        error: 'No target platform specified',
        executed_at: new Date().toISOString(),
        duration_ms: 0,
        rollback_available: false,
      };
    }

    const creds = credentials.get(platform);
    if (!creds) {
      return {
        action_id: action.id,
        status: 'skipped',
        error: `No credentials for platform: ${platform}`,
        executed_at: new Date().toISOString(),
        duration_ms: 0,
        rollback_available: false,
      };
    }

    // Populate recent writes from action log for safety gate evaluation
    let recentWrites: SafetyContext['recent_writes'] = [];
    if (this.actionLogRepo && agentId) {
      try {
        const logs = await this.actionLogRepo.listByAgent(agentId, 50);
        const today = new Date().toISOString().slice(0, 10);
        recentWrites = (logs as Array<Record<string, unknown>>)
          .filter((l) =>
            l['target_platform'] === platform &&
            l['status'] === 'executed' &&
            typeof l['executed_at'] === 'string' &&
            (l['executed_at'] as string).startsWith(today),
          )
          .map((l) => ({
            operation: l['action_type'] as WriteOperation,
            timestamp: l['executed_at'] as string,
            target_id: (l['target_id'] as string) ?? '',
          }));
      } catch {
        // Non-critical — fall back to empty
      }
    }

    const safetyContext: SafetyContext = {
      current_budget: (action.parameters['current_budget'] as number) ?? 0,
      daily_spend_rate: (action.parameters['daily_spend_rate'] as number) ?? 0,
      campaign_status: (action.parameters['campaign_status'] as string) ?? 'unknown',
      agent_config: agentConfig,
      recent_writes: recentWrites,
    };

    const startMs = Date.now();
    const writeResult = await this.writeRegistry.executeWrite(
      {
        type: action.type as WriteOperation,
        platform,
        parameters: action.parameters,
      },
      creds,
      safetyContext,
    );

    const durationMs = Date.now() - startMs;

    // Persist safety evaluation audit trail
    if (this.actionLogRepo && agentId) {
      try {
        await this.actionLogRepo.create({
          id: ulid(),
          decision_id: action.id,
          agent_id: agentId,
          action_type: `safety:${action.type}`,
          target_platform: platform,
          target_id: undefined,
          parameters: { checks: writeResult.safety.checks },
          previous_value: undefined,
          new_value: undefined,
          status: writeResult.safety.approved ? 'executed' : 'skipped',
          dry_run: false,
          duration_ms: durationMs,
        });
      } catch {
        // Non-critical — don't fail the action
      }
    }

    this.log.info({ action_id: action.id, platform, safety_approved: writeResult.safety.approved, checks: writeResult.safety.checks.length }, 'Safety evaluation complete');

    if (!writeResult.safety.approved) {
      const failedCheck = writeResult.safety.checks.find((c) => c.status === 'failed');
      return {
        action_id: action.id,
        status: action.dry_run ? 'dry_run' : 'skipped',
        error: failedCheck?.reason ?? 'Safety check failed',
        executed_at: new Date().toISOString(),
        duration_ms: durationMs,
        rollback_available: false,
      };
    }

    return {
      action_id: action.id,
      status: writeResult.result?.success ? 'executed' : 'failed',
      result: writeResult.result,
      error: writeResult.result?.error,
      executed_at: new Date().toISOString(),
      duration_ms: durationMs,
      rollback_available: writeResult.result?.success ?? false,
    };
  }
}
