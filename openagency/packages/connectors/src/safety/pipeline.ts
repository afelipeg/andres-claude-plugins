// ─── Safety Pipeline ───────────────────────────────────────────────
// Runs a chain of safety gates against a proposed write action.
// Stops on the first failure (fail-fast). All gates must pass for
// the write to be approved.

import type { SafetyGate, SafetyContext, SafetyPipelineResult, WriteOperation } from '@openagency/types';
import { createLogger } from '@openagency/core';
import { DryRunGate } from './dry-run-gate.js';
import { BudgetCapGate } from './budget-cap-gate.js';
import { DailyWriteLimitGate } from './daily-write-limit-gate.js';
import { ApprovalGate } from './approval-gate.js';
import { RollbackTracker } from './rollback-tracker.js';

export class SafetyPipeline {
  private gates: SafetyGate[];
  private log = createLogger('safety');

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
      this.log.info({ gate: result.gate, status: result.status, action_type: action.type }, 'Gate evaluated');

      if (result.status === 'failed') {
        approved = false;
        this.log.warn({ gate: result.gate, reason: result.reason, action_type: action.type }, 'Gate blocked write');
        break; // stop on first failure
      }
    }

    return { approved, checks };
  }
}
