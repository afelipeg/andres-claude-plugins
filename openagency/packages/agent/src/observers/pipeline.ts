// ─── Observer Pipeline ──────────────────────────────────────────────
// Aggregates observations from multiple sources into a buffer.

import type { Observation } from '@openagency/types';
import type { ObservationSource } from './types.js';

export class ObserverPipeline {
  private buffer: Observation[] = [];
  private sources: ObservationSource[] = [];

  addSource(source: ObservationSource): void {
    this.sources.push(source);
    source.start((obs) => {
      this.buffer.push(obs);
    });
  }

  /** Return and clear the observation buffer */
  flush(): Observation[] {
    const observations = [...this.buffer];
    this.buffer = [];
    return observations;
  }

  /** Get current buffer size without flushing */
  get bufferSize(): number {
    return this.buffer.length;
  }

  destroy(): void {
    for (const source of this.sources) {
      source.stop();
    }
    this.sources = [];
    this.buffer = [];
  }
}
