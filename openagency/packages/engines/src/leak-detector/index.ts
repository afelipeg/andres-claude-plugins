// ─── Leak Detector Engine ────────────────────────────────────────────
// Finds where ad budgets leak money through waste, fees, and quality issues.

import type { Engine } from '@openagency/types';
import * as wasteWaterfall from './waste-waterfall.js';
import * as supplyChainAudit from './supply-chain-audit.js';
import * as mediaQualityScore from './media-quality-score.js';

export class LeakDetectorEngine implements Engine {
  id = 'leak-detector';
  name = 'Leak Detector';
  description =
    'Find where your ad budget leaks money. 6-stage waste waterfall, supply chain audit, media quality scoring.';
  skills = [
    'waste-waterfall',
    'waste-estimate',
    'waste-compare',
    'supply-chain-audit',
    'media-quality-score',
  ];

  async run(skill: string, input: unknown): Promise<unknown> {
    switch (skill) {
      case 'waste-waterfall':
        return wasteWaterfall.analyze(input as Parameters<typeof wasteWaterfall.analyze>[0]);
      case 'waste-estimate':
        return wasteWaterfall.estimate(input as Parameters<typeof wasteWaterfall.estimate>[0]);
      case 'waste-compare':
        return wasteWaterfall.comparePeriods(
          input as Parameters<typeof wasteWaterfall.comparePeriods>[0],
        );
      case 'supply-chain-audit':
        return supplyChainAudit.audit(input as Parameters<typeof supplyChainAudit.audit>[0]);
      case 'media-quality-score':
        return mediaQualityScore.score(input as Parameters<typeof mediaQualityScore.score>[0]);
      default:
        throw new Error(
          `Unknown skill "${skill}". Available: ${this.skills.join(', ')}`,
        );
    }
  }
}
