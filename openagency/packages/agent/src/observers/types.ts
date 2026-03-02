// ─── Observer Types ─────────────────────────────────────────────────

import type { Observation } from '@openagency/types';

export interface ObservationSource {
  readonly name: string;
  start(callback: (obs: Observation) => void): void;
  stop(): void;
}
