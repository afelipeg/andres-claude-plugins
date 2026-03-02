// ─── Dry Run Gate ──────────────────────────────────────────────────
// Blocks execution when dry_run is enabled in agent config.
// The action is logged but never sent to the platform API.

import type { SafetyGate, SafetyCheckResult, SafetyContext, WriteOperation } from '@openagency/types';

export class DryRunGate implements SafetyGate {
  readonly name = 'dry_run';

  check(
    _action: { type: WriteOperation; parameters: Record<string, unknown> },
    context: SafetyContext,
  ): SafetyCheckResult {
    if (context.agent_config.dry_run) {
      return {
        gate: this.name,
        status: 'failed',
        reason: 'Dry run mode — action logged but not executed',
      };
    }

    return { gate: this.name, status: 'passed' };
  }
}
