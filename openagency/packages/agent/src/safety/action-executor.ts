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
            previous_value: result.rollback_metadata,
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

    // Extract rollback metadata from the rollback_tracker safety check
    const rollbackCheck = writeResult.safety.checks.find((c) => c.gate === 'rollback_tracker');
    const rollbackMetadata = rollbackCheck?.metadata as Record<string, unknown> | undefined;

    return {
      action_id: action.id,
      status: writeResult.result?.success ? 'executed' : 'failed',
      result: writeResult.result,
      error: writeResult.result?.error,
      executed_at: new Date().toISOString(),
      duration_ms: durationMs,
      rollback_available: writeResult.result?.success ?? false,
      rollback_metadata: rollbackMetadata,
    };
  }

  /**
   * Rollback a previously executed action by constructing and executing the inverse operation.
   * Reads the action_log entry, uses previous_value to build the reverse action.
   */
  async rollbackAction(
    actionLogId: string,
    credentials: Map<string, PlatformCredentials>,
    agentConfig: { max_budget_change_pct: number; approval_threshold_usd: number; dry_run: boolean },
  ): Promise<ActionResult> {
    if (!this.actionLogRepo) {
      return {
        action_id: actionLogId,
        status: 'failed',
        error: 'No action log repository configured',
        executed_at: new Date().toISOString(),
        duration_ms: 0,
        rollback_available: false,
      };
    }

    const entry = await this.actionLogRepo.getById(actionLogId);
    if (!entry) {
      return {
        action_id: actionLogId,
        status: 'failed',
        error: `Action log entry not found: ${actionLogId}`,
        executed_at: new Date().toISOString(),
        duration_ms: 0,
        rollback_available: false,
      };
    }

    if (entry['status'] !== 'executed') {
      return {
        action_id: actionLogId,
        status: 'failed',
        error: `Cannot rollback action with status: ${entry['status']}`,
        executed_at: new Date().toISOString(),
        duration_ms: 0,
        rollback_available: false,
      };
    }

    const previousValue = entry['previous_value'] as Record<string, unknown> | null;
    if (!previousValue) {
      return {
        action_id: actionLogId,
        status: 'failed',
        error: 'No previous value recorded — cannot rollback',
        executed_at: new Date().toISOString(),
        duration_ms: 0,
        rollback_available: false,
      };
    }

    const actionType = entry['action_type'] as string;
    const platform = entry['target_platform'] as ConnectorPlatform;
    const targetId = entry['target_id'] as string;
    const originalParams = entry['parameters'] as Record<string, unknown>;

    // Build inverse action based on the operation type
    const inverseAction = this.buildInverseAction(
      actionType, platform, targetId, previousValue, originalParams,
    );

    if (!inverseAction) {
      return {
        action_id: actionLogId,
        status: 'failed',
        error: `Cannot build inverse action for type: ${actionType}`,
        executed_at: new Date().toISOString(),
        duration_ms: 0,
        rollback_available: false,
      };
    }

    this.log.info({ actionLogId, inverse_type: inverseAction.type, platform }, 'Executing rollback');

    const result = await this.executeConnectorWrite(inverseAction, credentials, agentConfig, entry['agent_id'] as string);

    // Log the rollback action
    if (this.actionLogRepo) {
      try {
        await this.actionLogRepo.create({
          id: ulid(),
          decision_id: entry['decision_id'] as string,
          agent_id: entry['agent_id'] as string,
          action_type: `rollback:${actionType}`,
          target_platform: platform,
          target_id: targetId,
          parameters: inverseAction.parameters,
          previous_value: undefined,
          new_value: result.result,
          status: result.status,
          dry_run: false,
          duration_ms: result.duration_ms,
        });
      } catch {
        // Non-critical
      }
    }

    return result;
  }

  private buildInverseAction(
    actionType: string,
    platform: ConnectorPlatform,
    targetId: string,
    previousValue: Record<string, unknown>,
    originalParams: Record<string, unknown>,
  ): PlannedAction | null {
    const base = {
      id: ulid(),
      target: { platform, campaign_id: targetId },
      dry_run: false as const,
      safety_checks: ['rollback_tracker'] as string[],
      estimated_impact: 'Rollback to previous value',
    };

    switch (actionType) {
      case 'budget_update':
        return {
          ...base,
          type: 'budget_update',
          parameters: {
            campaign_id: targetId,
            new_budget: previousValue['previous_budget'],
            budget_type: originalParams['budget_type'],
            current_budget: originalParams['new_budget'],
          },
          rollback_plan: 'Restore original budget',
        };
      case 'campaign_pause':
        return {
          ...base,
          type: 'campaign_enable',
          parameters: { campaign_id: targetId },
          rollback_plan: 'Re-enable paused campaign',
        };
      case 'campaign_enable':
        return {
          ...base,
          type: 'campaign_pause',
          parameters: { campaign_id: targetId },
          rollback_plan: 'Re-pause enabled campaign',
        };
      case 'bid_adjustment':
        return {
          ...base,
          type: 'bid_adjustment',
          parameters: {
            ad_set_id: originalParams['ad_set_id'],
            new_bid: previousValue['new_bid'] ?? originalParams['current_bid'],
          },
          rollback_plan: 'Restore previous bid',
        };
      default:
        return null;
    }
  }
}
