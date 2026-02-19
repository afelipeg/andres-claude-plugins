// ─── Executive Bridge Engine ────────────────────────────────────────
// What's the real ROI? Attribution, revenue translation, reconciliation, incrementality.

import type { Engine } from '@openagency/types';
import { attribute, compare } from './shapley-attribution.js';
import { translate, compareChannels } from './revenue-bridge.js';
import { reconcile, integrity } from './revenue-reconciliation.js';
import { geoLift, conversionLift, holdout } from './power-analysis.js';

export class ExecutiveBridgeEngine implements Engine {
  readonly id = 'executive-bridge';
  readonly name = 'Executive Bridge';
  readonly description = 'Attribution, revenue translation, platform reconciliation, and incrementality testing';
  readonly skills = [
    'shapley-attribute',
    'shapley-compare',
    'revenue-translate',
    'revenue-compare',
    'reconcile',
    'integrity',
    'geo-lift',
    'conversion-lift',
    'holdout',
  ];

  async run(skill: string, input: unknown): Promise<unknown> {
    switch (skill) {
      case 'shapley-attribute':
        return attribute(input as Parameters<typeof attribute>[0]);
      case 'shapley-compare':
        return compare(input as Parameters<typeof compare>[0]);
      case 'revenue-translate':
        return translate(input as Parameters<typeof translate>[0]);
      case 'revenue-compare':
        return compareChannels(input as Parameters<typeof compareChannels>[0]);
      case 'reconcile':
        return reconcile(input as Parameters<typeof reconcile>[0]);
      case 'integrity':
        return integrity(input as Parameters<typeof integrity>[0]);
      case 'geo-lift':
        return geoLift(input as Parameters<typeof geoLift>[0]);
      case 'conversion-lift':
        return conversionLift(input as Parameters<typeof conversionLift>[0]);
      case 'holdout':
        return holdout(input as Parameters<typeof holdout>[0]);
      default:
        throw new Error(
          `Unknown skill "${skill}". Available: ${this.skills.join(', ')}`,
        );
    }
  }
}
