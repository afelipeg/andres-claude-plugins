// ─── Budget Cap Gate ───────────────────────────────────────────────
// Rejects budget changes that exceed max_budget_change_pct from agent config.
// Calculates: abs(new - current) / current * 100 > threshold → fail.

import type { SafetyGate, SafetyCheckResult, SafetyContext, WriteOperation } from '@openagency/types';

export class BudgetCapGate implements SafetyGate {
  readonly name = 'budget_cap';

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
    if (currentBudget <= 0) {
      // Cannot calculate percentage change from zero or negative budget
      return { gate: this.name, status: 'passed' };
    }

    const changePct = Math.abs(newBudget - currentBudget) / currentBudget * 100;
    const maxPct = context.agent_config.max_budget_change_pct;

    if (changePct > maxPct) {
      return {
        gate: this.name,
        status: 'failed',
        reason: `Budget change of ${changePct.toFixed(1)}% exceeds maximum allowed ${maxPct}%`,
        metadata: {
          current_budget: currentBudget,
          new_budget: newBudget,
          change_pct: changePct,
          max_change_pct: maxPct,
        },
      };
    }

    return {
      gate: this.name,
      status: 'passed',
      metadata: { change_pct: changePct },
    };
  }
}
