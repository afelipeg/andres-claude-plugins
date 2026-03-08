// ─── Monthly Report Template ─────────────────────────────────────────
// Layout definition for the monthly performance report deliverable.
// TODO(1.3): implement slide/page layout using PLINTH_TEMPLATE.

export interface MonthlyReportTemplate {
  title: string;
  subtitle: string;
  sections: MonthlyReportSection[];
}

export interface MonthlyReportSection {
  id: string;
  heading: string;
  layout: 'kpi-grid' | 'chart' | 'table' | 'narrative' | 'recommendations';
}

export const MONTHLY_REPORT_SECTIONS: MonthlyReportSection[] = [
  { id: 'executive-summary', heading: 'Executive Summary', layout: 'narrative' },
  { id: 'kpi-overview', heading: 'KPI Overview', layout: 'kpi-grid' },
  { id: 'waste-analysis', heading: 'Waste Analysis', layout: 'chart' },
  { id: 'channel-performance', heading: 'Channel Performance', layout: 'table' },
  { id: 'optimizations', heading: 'Optimizations Executed', layout: 'table' },
  { id: 'recommendations', heading: 'Recommendations', layout: 'recommendations' },
];
