// ─── Media Architect Engine ─────────────────────────────────────────
// Where should budget go? Channel optimization, MMM, benchmarks, media plans.

import type { Engine } from '@openagency/types';
import { optimize as chOptimize, scenarioAnalysis } from './channel-optimizer.js';
import { preModel, model, postModel, optimize as mmmOptimize } from './mmm-scenario-planner.js';
import { healthCheck, anomalyDetect } from './benchmark-tracker.js';
import { generate as generatePlan } from './media-plan-generator.js';

export class MediaArchitectEngine implements Engine {
  readonly id = 'media-architect';
  readonly name = 'Media Architect';
  readonly description = 'Budget optimization, MMM scenario planning, benchmarks, and media plan generation';
  readonly skills = [
    'channel-optimize',
    'channel-scenario',
    'mmm-pre-model',
    'mmm-model',
    'mmm-post-model',
    'mmm-optimize',
    'benchmark-health',
    'anomaly-detect',
    'media-plan',
  ];

  async run(skill: string, input: unknown): Promise<unknown> {
    switch (skill) {
      case 'channel-optimize':
        return chOptimize(input as Parameters<typeof chOptimize>[0]);
      case 'channel-scenario':
        return scenarioAnalysis(input as Parameters<typeof scenarioAnalysis>[0]);
      case 'mmm-pre-model':
        return preModel(input as Parameters<typeof preModel>[0]);
      case 'mmm-model':
        return model(input as Parameters<typeof model>[0]);
      case 'mmm-post-model':
        return postModel(input as Parameters<typeof postModel>[0]);
      case 'mmm-optimize':
        return mmmOptimize(input as Parameters<typeof mmmOptimize>[0]);
      case 'benchmark-health':
        return healthCheck(input as Parameters<typeof healthCheck>[0]);
      case 'anomaly-detect':
        return anomalyDetect(input as Parameters<typeof anomalyDetect>[0]);
      case 'media-plan':
        return generatePlan(input as Parameters<typeof generatePlan>[0]);
      default:
        throw new Error(
          `Unknown skill "${skill}". Available: ${this.skills.join(', ')}`,
        );
    }
  }
}
