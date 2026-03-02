// ─── Outcome Tracker ────────────────────────────────────────────────
// Records metric snapshots before/after actions for outcome measurement.

import { ulid } from 'ulid';
import type { OutcomeRepo } from '@openagency/memory';

export class OutcomeTracker {
  private pendingMeasurements: Map<string, ReturnType<typeof setTimeout>> = new Map();

  constructor(private outcomeRepo: OutcomeRepo | null) {}

  async recordBefore(
    decisionId: string,
    agentId: string,
    metrics: Record<string, number>,
  ): Promise<string> {
    const id = ulid();
    if (this.outcomeRepo) {
      await this.outcomeRepo.recordBefore({
        id,
        decision_id: decisionId,
        agent_id: agentId,
        metric_before: metrics,
      });
    }
    return id;
  }

  scheduleAfterMeasurement(
    outcomeId: string,
    delayMs: number,
    measureFn: () => Promise<Record<string, number>>,
  ): void {
    const timer = setTimeout(async () => {
      try {
        const metrics = await measureFn();
        await this.measure(outcomeId, metrics);
      } catch {
        // Measurement failed — will be retried on next cycle
      } finally {
        this.pendingMeasurements.delete(outcomeId);
      }
    }, delayMs);

    this.pendingMeasurements.set(outcomeId, timer);
  }

  async measure(outcomeId: string, currentMetrics: Record<string, number>): Promise<void> {
    if (this.outcomeRepo) {
      await this.outcomeRepo.measureAfter(outcomeId, currentMetrics);
    }
  }

  destroy(): void {
    for (const timer of this.pendingMeasurements.values()) {
      clearTimeout(timer);
    }
    this.pendingMeasurements.clear();
  }
}
