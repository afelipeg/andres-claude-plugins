'use client';

import React from 'react';
import { cn } from '@/lib/utils';
import { WaterfallChart } from './WaterfallChart';
import { ResponseCurves } from './ResponseCurves';
import { ContributionChart } from './ContributionChart';
import { ROIChart } from './ROIChart';
import { ModelFit } from './ModelFit';
import { AdstockDecay } from './AdstockDecay';
import { ShapleyChart } from './ShapleyChart';
import { RadarChart as RadarArtifact } from './RadarChart';
import { GaugeChart } from './GaugeChart';
import { TableArtifact } from './TableArtifact';
import { KPICards } from './KPICards';
import { FunnelChart } from './FunnelChart';
import { AlertDashboard } from './AlertDashboard';
import { ConvergencePlot } from './ConvergencePlot';

export interface VisualizationHint {
  chart_type: string;
  title: string;
  data: unknown;
  options?: Record<string, unknown>;
}

interface ArtifactRendererProps {
  hint: VisualizationHint;
  className?: string;
}

const CHART_REGISTRY: Record<string, React.ComponentType<{ data: any; options?: Record<string, unknown> }>> = {
  waterfall: WaterfallChart,
  response_curve: ResponseCurves,
  contribution: ContributionChart,
  area: ContributionChart,
  roi: ROIChart,
  bar: ROIChart,
  scatter: ROIChart,
  model_fit: ModelFit,
  adstock_decay: AdstockDecay,
  shapley: ShapleyChart,
  radar: RadarArtifact,
  gauge: GaugeChart,
  table: TableArtifact,
  kpi_cards: KPICards,
  funnel: FunnelChart,
  alert_dashboard: AlertDashboard,
  alerts: AlertDashboard,
  convergence: ConvergencePlot,
  pie: ContributionChart,
  line: ResponseCurves,
  scatter_mroi: ROIChart,
  scatter_effectiveness: ROIChart,
};

export function ArtifactRenderer({ hint, className }: ArtifactRendererProps) {
  const { chart_type, title, data, options } = hint;

  const ChartComponent = CHART_REGISTRY[chart_type];

  if (!ChartComponent) {
    return (
      <div className={cn('rounded-xl border border-zinc-800 bg-zinc-950 p-6', className)}>
        <h3 className="text-sm font-medium text-zinc-400 mb-2">{title}</h3>
        <div className="flex items-center justify-center h-48 text-zinc-500 text-sm">
          Unsupported chart type: <code className="ml-1 text-zinc-400 bg-zinc-800 px-1.5 py-0.5 rounded">{chart_type}</code>
        </div>
      </div>
    );
  }

  const mergedOptions = { ...options };
  if (['scatter_mroi', 'scatter_effectiveness', 'bar', 'area', 'pie'].includes(chart_type) && !mergedOptions.mode) {
    const modeMap: Record<string, string> = {
      scatter_mroi: 'scatter_mroi',
      scatter_effectiveness: 'scatter_effectiveness',
      bar: 'bar',
      area: 'area',
      pie: 'pie',
    };
    mergedOptions.mode = modeMap[chart_type];
  }

  return (
    <div className={cn('rounded-xl border border-zinc-800 bg-zinc-950 p-6', className)}>
      <h3 className="text-sm font-semibold text-zinc-200 mb-4">{title}</h3>
      <ChartComponent data={data} options={mergedOptions} />
    </div>
  );
}

export function ArtifactList({ hints, className }: { hints: VisualizationHint[]; className?: string }) {
  if (!hints || hints.length === 0) return null;

  return (
    <div className={cn('space-y-4', className)}>
      {hints.map((hint, i) => (
        <ArtifactRenderer key={`${hint.chart_type}-${i}`} hint={hint} />
      ))}
    </div>
  );
}
