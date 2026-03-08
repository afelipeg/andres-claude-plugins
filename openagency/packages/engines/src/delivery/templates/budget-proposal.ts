// ─── Budget Proposal Template ─────────────────────────────────────────
// Layout definition for the budget proposal deliverable.
// TODO(1.3): implement slide/page layout using PLINTH_TEMPLATE.

export interface BudgetProposalSection {
  id: string;
  heading: string;
  layout: 'narrative' | 'budget-breakdown' | 'channel-allocation' | 'kpi-targets' | 'timeline';
}

export const BUDGET_PROPOSAL_SECTIONS: BudgetProposalSection[] = [
  { id: 'rationale', heading: 'Investment Rationale', layout: 'narrative' },
  { id: 'breakdown', heading: 'Budget Breakdown', layout: 'budget-breakdown' },
  { id: 'channel-allocation', heading: 'Channel Allocation', layout: 'channel-allocation' },
  { id: 'kpi-targets', heading: 'KPI Targets', layout: 'kpi-targets' },
  { id: 'timeline', heading: 'Execution Timeline', layout: 'timeline' },
];
