'use client';

import React, { useState, useMemo } from 'react';
import { cn } from '@/lib/utils';

export interface Alert {
  severity: 'critical' | 'warning' | 'info';
  message: string;
  campaign?: string;
  channel?: string;
}

export interface AlertTotals {
  critical: number;
  warning: number;
  info: number;
}

export interface AlertData {
  totals: AlertTotals;
  alerts: Alert[];
}

interface AlertDashboardProps {
  data: AlertData;
  options?: Record<string, unknown>;
}

type SeverityFilter = 'all' | 'critical' | 'warning' | 'info';

const SEVERITY_CONFIG = {
  critical: {
    bg: 'bg-red-500/15',
    text: 'text-red-400',
    border: 'border-red-500/30',
    dot: 'bg-red-500',
    badge: 'bg-red-500/20 text-red-400 border-red-500/30',
    label: 'Critical',
  },
  warning: {
    bg: 'bg-amber-500/15',
    text: 'text-amber-400',
    border: 'border-amber-500/30',
    dot: 'bg-amber-500',
    badge: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
    label: 'Warning',
  },
  info: {
    bg: 'bg-blue-500/15',
    text: 'text-blue-400',
    border: 'border-blue-500/30',
    dot: 'bg-blue-500',
    badge: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
    label: 'Info',
  },
};

export function AlertDashboard({ data }: AlertDashboardProps) {
  const [filter, setFilter] = useState<SeverityFilter>('all');

  const filteredAlerts = useMemo(() => {
    if (!data?.alerts?.length) return [];
    if (filter === 'all') return data.alerts;
    return data.alerts.filter(a => a.severity === filter);
  }, [data?.alerts, filter]);

  if (!data?.alerts?.length && !data?.totals) {
    return (
      <div className="flex items-center justify-center h-32 text-zinc-500 text-sm">
        No alert data available
      </div>
    );
  }

  const totals = data.totals ?? { critical: 0, warning: 0, info: 0 };
  const totalCount = totals.critical + totals.warning + totals.info;

  return (
    <div className="w-full space-y-4">
      {/* Summary counters */}
      <div className="grid grid-cols-4 gap-2">
        <button
          onClick={() => setFilter('all')}
          className={cn(
            'rounded-lg border p-3 text-center transition-colors',
            filter === 'all'
              ? 'border-zinc-500 bg-zinc-800/50'
              : 'border-zinc-800 bg-zinc-900/30 hover:bg-zinc-800/30',
          )}
        >
          <p className="text-2xl font-bold text-zinc-100 tabular-nums">{totalCount}</p>
          <p className="text-[10px] font-medium text-zinc-500 uppercase tracking-wider mt-0.5">All</p>
        </button>

        {(['critical', 'warning', 'info'] as const).map((severity) => {
          const cfg = SEVERITY_CONFIG[severity];
          const count = totals[severity];
          return (
            <button
              key={severity}
              onClick={() => setFilter(severity)}
              className={cn(
                'rounded-lg border p-3 text-center transition-colors',
                filter === severity
                  ? `${cfg.border} ${cfg.bg}`
                  : 'border-zinc-800 bg-zinc-900/30 hover:bg-zinc-800/30',
              )}
            >
              <p className={cn('text-2xl font-bold tabular-nums', cfg.text)}>{count}</p>
              <p className="text-[10px] font-medium text-zinc-500 uppercase tracking-wider mt-0.5">
                {cfg.label}
              </p>
            </button>
          );
        })}
      </div>

      {/* Alert list */}
      <div className="space-y-1.5 max-h-[320px] overflow-y-auto pr-1">
        {filteredAlerts.length === 0 ? (
          <p className="text-sm text-zinc-500 text-center py-4">
            No {filter !== 'all' ? filter : ''} alerts
          </p>
        ) : (
          filteredAlerts.map((alert, i) => {
            const cfg = SEVERITY_CONFIG[alert.severity] || SEVERITY_CONFIG.info;
            return (
              <div
                key={i}
                className={cn(
                  'flex items-start gap-3 rounded-lg border px-3 py-2.5 transition-colors',
                  cfg.border,
                  cfg.bg,
                )}
              >
                <span className={cn('w-2 h-2 rounded-full mt-1.5 shrink-0', cfg.dot)} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-zinc-200">{alert.message}</p>
                  {(alert.campaign || alert.channel) && (
                    <div className="flex items-center gap-2 mt-1">
                      {alert.campaign && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-400">
                          {alert.campaign}
                        </span>
                      )}
                      {alert.channel && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-400">
                          {alert.channel}
                        </span>
                      )}
                    </div>
                  )}
                </div>
                <span className={cn('text-[10px] px-1.5 py-0.5 rounded-full border font-medium shrink-0', cfg.badge)}>
                  {cfg.label}
                </span>
              </div>
            );
          })
        )}
      </div>

      <p className="text-[10px] text-zinc-600 px-1">
        Showing {filteredAlerts.length} of {totalCount} alert{totalCount !== 1 ? 's' : ''}
      </p>
    </div>
  );
}
