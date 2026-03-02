// ─── Approval Gate ─────────────────────────────────────────────────
// Requires human approval when the budget change exceeds
// approval_threshold_usd from agent config.

import type { SafetyGate, SafetyCheckResult, SafetyContext, WriteOperation } from '@openagency/types';

export class ApprovalGate implements SafetyGate {
  readonly name = 'approval';

  check(
    action: { type: WriteOperation; parameters: Record<string, unknown> },
    context: SafetyContext,
  ): SafetyCheckResult {
    // Only applies to budget_update operations
    if (action.type !== 'budget_update') {
      return { gate: this.name, status: 'passed' };
    }

    const newBudget = action.parameters['new_budget'] as number | undefined;
    if (newBudget === undefined || newBudget === null) {
      return { gate: this.name, status: 'passed' };
    }

    const currentBudget = context.current_budget;
    const diff = Math.abs(newBudget - currentBudget);
    const threshold = context.agent_config.approval_threshold_usd;

    if (diff > threshold) {
      return {
        gate: this.name,
        status: 'failed',
        reason: `Requires human approval: budget change of $${diff.toFixed(2)} exceeds threshold of $${threshold.toFixed(2)}`,
        metadata: {
          requires_approval: true,
          budget_diff_usd: diff,
          approval_threshold_usd: threshold,
        },
      };
    }

    return { gate: this.name, status: 'passed' };
  }
}
