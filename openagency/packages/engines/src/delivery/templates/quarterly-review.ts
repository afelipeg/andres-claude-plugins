// ─── Quarterly Review (QBR) Template ────────────────────────────────
// Layout definition for the quarterly business review deck.
// TODO(1.3): implement slide/page layout using PLINTH_TEMPLATE.

export interface QBRSection {
  id: string;
  heading: string;
  layout: 'title-slide' | 'narrative' | 'kpi-grid' | 'chart' | 'table' | 'roadmap' | 'closing';
}

export const QBR_SECTIONS: QBRSection[] = [
  { id: 'title', heading: 'Title Slide', layout: 'title-slide' },
  { id: 'agenda', heading: 'Agenda', layout: 'narrative' },
  { id: 'quarter-summary', heading: 'Quarter Summary', layout: 'kpi-grid' },
  { id: 'channel-deep-dive', heading: 'Channel Deep Dive', layout: 'chart' },
  { id: 'wins-losses', heading: 'Wins & Losses', layout: 'table' },
  { id: 'next-quarter', heading: 'Next Quarter Roadmap', layout: 'roadmap' },
  { id: 'closing', heading: 'Closing', layout: 'closing' },
];
