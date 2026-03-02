// ─── Threshold Observer ─────────────────────────────────────────────
// Watches metric values and fires when thresholds are crossed.

import { ulid } from 'ulid';
import type { Observation } from '@openagency/types';
import type { ObservationSource } from './types.js';

export interface ThresholdRule {
  metric: string;
  operator: 'gt' | 'lt' | 'gte' | 'lte';
  value: number;
  platform?: string;
}

export class ThresholdObserver implements ObservationSource {
  readonly name = 'threshold';
  private callback: ((obs: Observation) => void) | null = null;

  constructor(private rules: ThresholdRule[]) {}

  start(callback: (obs: Observation) => void): void {
    this.callback = callback;
  }

  stop(): void {
    this.callback = null;
  }

  /** Call this when new metric data arrives to check thresholds */
  evaluate(metrics: Record<string, number>, platform?: string): void {
    if (!this.callback) return;

    for (const rule of this.rules) {
      const value = metrics[rule.metric];
      if (value === undefined) continue;
      if (rule.platform && rule.platform !== platform) continue;

      let breached = false;
      switch (rule.operator) {
        case 'gt': breached = value > rule.value; break;
        case 'lt': breached = value < rule.value; break;
        case 'gte': breached = value >= rule.value; break;
        case 'lte': breached = value <= rule.value; break;
      }

      if (breached) {
        this.callback({
          id: ulid(),
          source: this.name,
          type: 'threshold_breach',
          data: {
            metric: rule.metric,
            operator: rule.operator,
            threshold: rule.value,
            actual: value,
          },
          timestamp: new Date().toISOString(),
          platform,
        });
      }
    }
  }
}
