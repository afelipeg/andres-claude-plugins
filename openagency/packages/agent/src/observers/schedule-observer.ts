// ─── Schedule Observer ──────────────────────────────────────────────
// Timer-based observer that fires schedule_tick at cycle_interval_ms.

import { ulid } from 'ulid';
import type { Observation } from '@openagency/types';
import type { ObservationSource } from './types.js';

export class ScheduleObserver implements ObservationSource {
  readonly name = 'schedule';
  private timer: ReturnType<typeof setInterval> | null = null;

  constructor(private intervalMs: number) {}

  start(callback: (obs: Observation) => void): void {
    if (this.intervalMs <= 0) return;

    this.timer = setInterval(() => {
      callback({
        id: ulid(),
        source: this.name,
        type: 'schedule_tick',
        data: { interval_ms: this.intervalMs },
        timestamp: new Date().toISOString(),
      });
    }, this.intervalMs);
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }
}
