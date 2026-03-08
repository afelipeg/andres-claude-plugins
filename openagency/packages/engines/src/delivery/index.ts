// ─── Delivery Engine (5th Motor) ─────────────────────────────────────
// Consumes Layer-1 engine outputs → web search / ad libraries → Claude
// → generates file deliverables (PPTX, PDF, DOCX, XLSX).

import type { Engine } from '@openagency/types';
import * as monthlyReport from './skills/monthly-report.js';
import * as competitiveAnalysis from './skills/competitive-analysis.js';
import * as industryBenchmarks from './skills/industry-benchmarks.js';
import * as budgetProposal from './skills/budget-proposal.js';
import * as campaignBrief from './skills/campaign-brief.js';
import * as projectStatus from './skills/project-status.js';
import * as quarterlyReview from './skills/quarterly-review.js';
import * as mediaPlanDeck from './skills/media-plan-deck.js';
import * as learningsDigest from './skills/learnings-digest.js';
import * as clientScorecardExport from './skills/client-scorecard-export.js';

export class DeliveryEngine implements Engine {
  id = 'delivery';
  name = 'Delivery Engine';
  description =
    'Generate client-facing deliverables — reports, decks, briefs, scorecards — ' +
    'by combining Layer-1 engine outputs with fresh web data and Claude narrative.';

  skills = [
    'monthly-report',
    'competitive-analysis',
    'industry-benchmarks',
    'budget-proposal',
    'campaign-brief',
    'project-status',
    'quarterly-review',
    'media-plan-deck',
    'learnings-digest',
    'client-scorecard-export',
  ];

  async run(skill: string, input: unknown): Promise<unknown> {
    switch (skill) {
      case 'monthly-report':
        return monthlyReport.run(input as Parameters<typeof monthlyReport.run>[0]);
      case 'competitive-analysis':
        return competitiveAnalysis.run(input as Parameters<typeof competitiveAnalysis.run>[0]);
      case 'industry-benchmarks':
        return industryBenchmarks.run(input as Parameters<typeof industryBenchmarks.run>[0]);
      case 'budget-proposal':
        return budgetProposal.run(input as Parameters<typeof budgetProposal.run>[0]);
      case 'campaign-brief':
        return campaignBrief.run(input as Parameters<typeof campaignBrief.run>[0]);
      case 'project-status':
        return projectStatus.run(input as Parameters<typeof projectStatus.run>[0]);
      case 'quarterly-review':
        return quarterlyReview.run(input as Parameters<typeof quarterlyReview.run>[0]);
      case 'media-plan-deck':
        return mediaPlanDeck.run(input as Parameters<typeof mediaPlanDeck.run>[0]);
      case 'learnings-digest':
        return learningsDigest.run(input as Parameters<typeof learningsDigest.run>[0]);
      case 'client-scorecard-export':
        return clientScorecardExport.run(input as Parameters<typeof clientScorecardExport.run>[0]);
      default:
        throw new Error(`Unknown skill "${skill}". Available: ${this.skills.join(', ')}`);
    }
  }
}
