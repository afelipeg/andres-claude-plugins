'use client';

import React from 'react';
import { cn } from '@/lib/utils';

export interface KPIMetric {
  label: string;
  value: number | string;
  delta?: string;
  direction?: 'up' | 'down';
}

export interface KPIData {
  metrics: KPIMetric[];
}

interface KPICardsProps {
  data: KPIData;
  options?: Record<string, unknown>;
}

const formatValue = (value: number | string): string => {
  if (typeof value === 'string') return value;
  if (Math.abs(value) >= 1_000_000_000) return `$${(value / 1_000_000_000).toFixed(2)}B`;
  if (Math.abs(value) >= 1_000_000) return `$${(value / 1_000_000).toFixed(2)}M`;
  if (Math.abs(value) >= 1_000) return `$${(value / 1_000).toFixed(1)}K`;
  if (Number.isInteger(value)) return value.toLocaleString();
  return value.toFixed(2);
};

const ArrowUp = () => (
  <svg width="12" height="12" viewBox="0 0 12 12" fill="none" className="inline-block">
    <path d="M6 2.5L10 7H2L6 2.5Z" fill="currentColor" />
  </svg>
);

const ArrowDown = () => (
  <svg width="12" height="12" viewBox="0 0 12 12" fill="none" className="inline-block">
    <path d="M6 9.5L2 5H10L6 9.5Z" fill="currentColor" />
  </svg>
);

export function KPICards({ data }: KPICardsProps) {
  if (!data?.metrics?.length) {
    return (
      <div className="flex items-center justify-center h-32 text-zinc-500 text-sm">
        No KPI data available
      </div>
    );
  }

  const colCount = data.metrics.length <= 2 ? data.metrics.length : data.metrics.length <= 4 ? 2 : 3;

  return (
    <div
      className={cn(
        'grid gap-3',
        colCount === 1 && 'grid-cols-1',
        colCount === 2 && 'grid-cols-2',
        colCount === 3 && 'grid-cols-2 md:grid-cols-3',
      )}
    >
      {data.metrics.map((metric, i) => {
        const isUp = metric.direction === 'up';
        const isDown = metric.direction === 'down';
        const deltaColor = isUp ? 'text-emerald-400' : isDown ? 'text-red-400' : 'text-zinc-400';

        return (
          <div
            key={`${metric.label}-${i}`}
            className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-4 flex flex-col gap-1"
          >
            <p className="text-xs font-medium text-zinc-500 uppercase tracking-wider truncate">
              {metric.label}
            </p>
            <p className="text-2xl font-bold text-zinc-100 tabular-nums truncate">
              {formatValue(metric.value)}
            </p>
            {metric.delta && (
              <p className={cn('text-xs font-medium flex items-center gap-1', deltaColor)}>
                {isUp && <ArrowUp />}
                {isDown && <ArrowDown />}
                {metric.delta}
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
}
