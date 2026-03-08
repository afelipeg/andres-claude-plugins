// ─── Competitive Analysis Template ───────────────────────────────────
// Layout definition for the competitive analysis deliverable.
// TODO(1.3): implement slide/page layout using PLINTH_TEMPLATE.

export interface CompetitiveAnalysisTemplate {
  title: string;
  sections: CompetitiveSection[];
}

export interface CompetitiveSection {
  id: string;
  heading: string;
  layout: 'narrative' | 'comparison-table' | 'ad-gallery' | 'swot' | 'recommendations';
}

export const COMPETITIVE_ANALYSIS_SECTIONS: CompetitiveSection[] = [
  { id: 'overview', heading: 'Competitive Overview', layout: 'narrative' },
  { id: 'ad-activity', heading: 'Active Ads Comparison', layout: 'ad-gallery' },
  { id: 'spend-comparison', heading: 'Estimated Spend Comparison', layout: 'comparison-table' },
  { id: 'swot', heading: 'SWOT Analysis', layout: 'swot' },
  { id: 'opportunities', heading: 'Opportunities', layout: 'recommendations' },
];
