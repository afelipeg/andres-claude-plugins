// ─── Safety Pipeline ───────────────────────────────────────────────
// Runs a chain of safety gates against a proposed write action.
// Stops on the first failure (fail-fast). All gates must pass for
// the write to be approved.

import type { SafetyGate, SafetyContext, SafetyPipelineResult, WriteOperation } from '@openagency/types';
import { DryRunGate } from './dry-run-gate.js';
import { BudgetCapGate } from './budget-cap-gate.js';
import { DailyWriteLimitGate } from './daily-write-limit-gate.js';
import { ApprovalGate } from './approval-gate.js';
import { RollbackTracker } from './rollback-tracker.js';

export class SafetyPipeline {
  private gates: SafetyGate[];

  constructor(gates?: SafetyGate[]) {
    this.gates = gates ?? [
      new DryRunGate(),
      new BudgetCapGate(),
      new DailyWriteLimitGate(),
      new ApprovalGate(),
      new RollbackTracker(),
    ];
  }

  evaluate(
    action: { type: WriteOperation; parameters: Record<string, unknown> },
    context: SafetyContext,
  ): SafetyPipelineResult {
    const checks = [];
    let approved = true;

    for (const gate of this.gates) {
      const result = gate.check(action, context);
      checks.push(result);

      if (result.status === 'failed') {
        approved = false;
        break; // stop on first failure
      }
    }

    return { approved, checks };
  }
}
