// ─── Daily Write Limit Gate ────────────────────────────────────────
// Enforces a maximum of 50 write operations per platform per day.
// Counts recent_writes from context that match today's date.

import type { SafetyGate, SafetyCheckResult, SafetyContext, WriteOperation } from '@openagency/types';

const MAX_WRITES_PER_DAY = 50;

export class DailyWriteLimitGate implements SafetyGate {
  readonly name = 'daily_write_limit';

  check(
    _action: { type: WriteOperation; parameters: Record<string, unknown> },
    context: SafetyContext,
  ): SafetyCheckResult {
    const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD

    const writesToday = context.recent_writes.filter((w) => {
      return w.timestamp.startsWith(today);
    });

    if (writesToday.length >= MAX_WRITES_PER_DAY) {
      return {
        gate: this.name,
        status: 'failed',
        reason: `Daily write limit reached: ${writesToday.length}/${MAX_WRITES_PER_DAY} writes today`,
        metadata: {
          writes_today: writesToday.length,
          max_writes: MAX_WRITES_PER_DAY,
        },
      };
    }

    return {
      gate: this.name,
      status: 'passed',
      metadata: { writes_today: writesToday.length },
    };
  }
}
