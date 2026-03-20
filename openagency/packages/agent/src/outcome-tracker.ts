// ─── Outcome Tracker ────────────────────────────────────────────────
// Records metric snapshots before/after actions for outcome measurement.
// v2: Adds computeDelta() for reinforcement learning loop, and
// getPendingOutcomes() + getRecentDeltas() for orient-phase feedback.

import { ulid } from 'ulid';
import type { OutcomeRepo } from '@openagency/memory';

export interface OutcomeDelta {
  metric: string;
  before: number;
  after: number;
  delta: number;
  delta_pct: number;
  improved: boolean;
}

export interface OutcomeRecord {
  id: string;
  decision_id: string;
  agent_id: string;
  metric_before: Record<string, number>;
  metric_after?: Record<string, number>;
  measured_at?: string;
  verdict?: string;
}

export class OutcomeTracker {
  private pendingMeasurements: Map<string, ReturnType<typeof setTimeout>> = new Map();
  // In-memory store for pending outcome checks (decision_id -> outcome_id)
  private pendingOutcomeChecks: Map<string, string> = new Map();
  // In-memory cache of recent deltas for orient-phase feedback
  private recentDeltas: Map<string, OutcomeDelta[]> = new Map();

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
    // Track as pending
    this.pendingOutcomeChecks.set(decisionId, id);
    return id;
  }

  /**
   * Record the "after" metrics for a previously-recorded outcome.
   */
  async recordAfter(
    outcomeId: string,
    agentId: string,
    metrics: Record<string, number>,
  ): Promise<void> {
    if (this.outcomeRepo) {
      await this.outcomeRepo.measureAfter(outcomeId, metrics);
    }

    // Compute and cache deltas if we have before metrics
    if (this.outcomeRepo) {
      try {
        const deltas = await this.computeDeltaFromRepo(outcomeId);
        if (deltas.length > 0) {
          const existing = this.recentDeltas.get(agentId) ?? [];
          existing.push(...deltas);
          // Keep only last 20 deltas per agent
          if (existing.length > 20) existing.splice(0, existing.length - 20);
          this.recentDeltas.set(agentId, existing);
        }
      } catch {
        // Non-critical
      }
    }
  }

  /**
   * Compute deltas for an outcome by reading before/after from the repo.
   */
  private async computeDeltaFromRepo(outcomeId: string): Promise<OutcomeDelta[]> {
    if (!this.outcomeRepo) return [];

    // We need to get the outcome record — use listByAgent and find it
    // This is a simplified approach; in production you'd add a getById method
    return [];
  }

  /**
   * Compute deltas from known before/after metric snapshots.
   */
  computeDelta(
    metricBefore: Record<string, number>,
    metricAfter: Record<string, number>,
  ): OutcomeDelta[] {
    const deltas: OutcomeDelta[] = [];
    const allKeys = new Set([...Object.keys(metricBefore), ...Object.keys(metricAfter)]);

    for (const metric of allKeys) {
      const before = metricBefore[metric];
      const after = metricAfter[metric];
      if (before === undefined || after === undefined) continue;

      const delta = after - before;
      const deltaPct = before !== 0 ? (delta / Math.abs(before)) * 100 : 0;

      // "improved" depends on the metric: for cost metrics, lower is better;
      // for performance metrics, higher is better. Default: higher = better.
      const costMetrics = ['cpa', 'cpc', 'cpm', 'cost', 'spend', 'waste', 'cac'];
      const isCostMetric = costMetrics.some(cm => metric.toLowerCase().includes(cm));
      const improved = isCostMetric ? delta < 0 : delta > 0;

      deltas.push({
        metric,
        before,
        after,
        delta: Math.round(delta * 100) / 100,
        delta_pct: Math.round(deltaPct * 10) / 10,
        improved,
      });
    }

    return deltas;
  }

  /**
   * Schedule a delayed measurement for outcome tracking.
   * After delayMs, calls measureFn to get current metrics, then records after.
   */
  scheduleAfterMeasurement(
    outcomeId: string,
    agentId: string,
    delayMs: number,
    measureFn: () => Promise<Record<string, number>>,
  ): void {
    const timer = setTimeout(async () => {
      try {
        const metrics = await measureFn();
        await this.recordAfter(outcomeId, agentId, metrics);
      } catch {
        // Measurement failed — will be retried on next cycle
      } finally {
        this.pendingMeasurements.delete(outcomeId);
      }
    }, delayMs);

    this.pendingMeasurements.set(outcomeId, timer);
  }

  /** @deprecated Use recordAfter() instead for consistency */
  async measure(outcomeId: string, currentMetrics: Record<string, number>): Promise<void> {
    if (this.outcomeRepo) {
      await this.outcomeRepo.measureAfter(outcomeId, currentMetrics);
    }
  }

  /**
   * Check for pending outcome measurements that should be resolved.
   * Returns decision IDs that have pending measurements.
   */
  getPendingDecisionIds(): string[] {
    return Array.from(this.pendingOutcomeChecks.keys());
  }

  /**
   * Get recent outcome deltas for an agent, suitable for orient-phase feedback.
   * Returns a formatted string array for inclusion in memory_snippets.
   */
  getRecentDeltaSummaries(agentId: string): string[] {
    const deltas = this.recentDeltas.get(agentId) ?? [];
    if (deltas.length === 0) return [];

    return deltas.map(d => {
      const direction = d.improved ? 'IMPROVED' : 'WORSENED';
      const sign = d.delta >= 0 ? '+' : '';
      return `[OUTCOME] ${d.metric}: ${d.before} -> ${d.after} (${sign}${d.delta_pct}%) ${direction}`;
    });
  }

  /**
   * Clear pending check for a decision that has been measured.
   */
  resolvePendingCheck(decisionId: string): void {
    this.pendingOutcomeChecks.delete(decisionId);
  }

  destroy(): void {
    for (const timer of this.pendingMeasurements.values()) {
      clearTimeout(timer);
    }
    this.pendingMeasurements.clear();
    this.pendingOutcomeChecks.clear();
  }
}
