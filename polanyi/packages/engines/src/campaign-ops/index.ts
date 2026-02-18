// ─── Campaign Ops Engine ────────────────────────────────────────────
// Is the campaign on track? State machine, optimization rules, reallocation.

import type { Engine } from '@openagency/types';
import {
  createCampaignState,
  updateTaskStatus,
  getNextActions,
  campaignSummary,
} from './campaign-state.js';
import { analyze, reallocate } from './optimization-rules.js';

export class CampaignOpsEngine implements Engine {
  readonly id = 'campaign-ops';
  readonly name = 'Campaign Ops';
  readonly description = 'Campaign lifecycle management, optimization rules, and cross-channel reallocation';
  readonly skills = [
    'campaign-create',
    'campaign-update-task',
    'campaign-summary',
    'campaign-next-actions',
    'optimization-analyze',
    'optimization-reallocate',
  ];

  async run(skill: string, input: unknown): Promise<unknown> {
    switch (skill) {
      case 'campaign-create':
        return createCampaignState(input as Parameters<typeof createCampaignState>[0]);
      case 'campaign-update-task':
        return updateTaskStatus(input as Parameters<typeof updateTaskStatus>[0]);
      case 'campaign-summary':
        return campaignSummary(input as Parameters<typeof campaignSummary>[0]);
      case 'campaign-next-actions':
        return getNextActions(input as Parameters<typeof getNextActions>[0]);
      case 'optimization-analyze':
        return analyze(input as Parameters<typeof analyze>[0]);
      case 'optimization-reallocate':
        return reallocate(input as Parameters<typeof reallocate>[0]);
      default:
        throw new Error(
          `Unknown skill "${skill}". Available: ${this.skills.join(', ')}`,
        );
    }
  }
}
