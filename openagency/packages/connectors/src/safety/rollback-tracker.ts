// ─── Rollback Tracker ──────────────────────────────────────────────
// Always passes — records the previous value in metadata so that
// write operations can be rolled back if needed.

import type { SafetyGate, SafetyCheckResult, SafetyContext, WriteOperation } from '@openagency/types';

export class RollbackTracker implements SafetyGate {
  readonly name = 'rollback_tracker';

  check(
    action: { type: WriteOperation; parameters: Record<string, unknown> },
    context: SafetyContext,
  ): SafetyCheckResult {
    const metadata: Record<string, unknown> = {
      operation: action.type,
      timestamp: new Date().toISOString(),
    };

    // Record previous values depending on operation type
    switch (action.type) {
      case 'budget_update':
        metadata['previous_budget'] = context.current_budget;
        metadata['new_budget'] = action.parameters['new_budget'];
        break;
      case 'campaign_pause':
      case 'campaign_enable':
        metadata['previous_status'] = context.campaign_status;
        break;
      case 'bid_adjustment':
        metadata['new_bid'] = action.parameters['new_bid'];
        break;
    }

    return {
      gate: this.name,
      status: 'passed',
      metadata,
    };
  }
}
