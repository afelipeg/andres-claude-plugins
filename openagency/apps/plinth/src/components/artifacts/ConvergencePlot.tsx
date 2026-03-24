'use client';

import React, { useMemo } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  ReferenceLine,
} from 'recharts';
import { cn } from '@/lib/utils';

export interface ConvergenceData {
  r_hat: Record<string, number>;
  ess: Record<string, number>;
  converged: boolean;
}

interface ConvergencePlotProps {
  data: ConvergenceData;
  options?: Record<string, unknown>;
}

export function ConvergencePlot({ data }: ConvergencePlotProps) {
  const { rhatData, essData } = useMemo(() => {
    if (!data?.r_hat || !data?.ess) return { rhatData: [], essData: [] };

    const rhatEntries = Object.entries(data.r_hat).map(([param, value]) => ({
      param,
      value,
      fill: value <= 1.1 ? '#10b981' : '#ef4444',
      status: value <= 1.1 ? 'converged' : 'not converged',
    }));

    const essEntries = Object.entries(data.ess).map(([param, value]) => ({
      param,
      value,
      fill: value >= 400 ? '#10b981' : value >= 100 ? '#f59e0b' : '#ef4444',
      status: value >= 400 ? 'good' : value >= 100 ? 'marginal' : 'low',
    }));

    return { rhatData: rhatEntries, essData: essEntries };
  }, [data]);

  if (!rhatData.length && !essData.length) {
    return (
      <div className="flex items-center justify-center h-64 text-zinc-500 text-sm">
        No convergence diagnostics available
      </div>
    );
  }

  const chartHeight = Math.max(240, Math.max(rhatData.length, essData.length) * 32 + 60);

  return (
    <div className="w-full space-y-6">
      {/* Overall convergence status */}
      <div className={cn(
        'flex items-center gap-2 px-3 py-2 rounded-lg border text-sm font-medium',
        data.converged
          ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400'
          : 'border-red-500/30 bg-red-500/10 text-red-400',
      )}>
        <span className={cn('w-2 h-2 rounded-full', data.converged ? 'bg-emerald-500' : 'bg-red-500')} />
        {data.converged ? 'MCMC chains converged' : 'MCMC chains have NOT converged'}
      </div>

      {/* R-hat chart */}
      {rhatData.length > 0 && (
        <div>
          <h4 className="text-xs font-medium text-zinc-400 mb-2 px-1">
            R-hat (target: &le; 1.1)
          </h4>
          <ResponsiveContainer width="100%" height={chartHeight}>
            <BarChart
              data={rhatData}
              layout="vertical"
              margin={{ top: 5, right: 40, left: 100, bottom: 5 }}
              barCategoryGap="25%"
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#27272a" horizontal={false} />
              <XAxis
                type="number"
                tick={{ fill: '#a1a1aa', fontSize: 11 }}
                axisLine={{ stroke: '#27272a' }}
                tickLine={false}
                domain={[0.9, 'auto']}
              />
              <YAxis
                type="category"
                dataKey="param"
                tick={{ fill: '#a1a1aa', fontSize: 10 }}
                axisLine={false}
                tickLine={false}
                width={90}
              />
              <Tooltip
                content={({ active, payload }) => {
                  if (!active || !payload?.[0]) return null;
                  const d = payload[0].payload;
                  return (
                    <div className="rounded-lg border border-zinc-700 bg-zinc-900 p-3 shadow-xl text-sm">
                      <p className="font-medium text-zinc-200">{d.param}</p>
                      <p className="text-zinc-400 mt-1">
                        R-hat: <span className="text-zinc-100">{d.value.toFixed(4)}</span>
                      </p>
                      <p className={cn('text-xs mt-0.5', d.fill === '#10b981' ? 'text-emerald-400' : 'text-red-400')}>
                        {d.status}
                      </p>
                    </div>
                  );
                }}
                cursor={{ fill: 'rgba(255,255,255,0.03)' }}
              />
              <ReferenceLine
                x={1.1}
                stroke="#ef4444"
                strokeDasharray="4 4"
                label={{ value: '1.1', fill: '#ef4444', fontSize: 10, position: 'top' }}
              />
              <ReferenceLine
                x={1.0}
                stroke="#10b981"
                strokeDasharray="4 4"
                label={{ value: '1.0 (ideal)', fill: '#10b981', fontSize: 10, position: 'top' }}
              />
              <Bar dataKey="value" radius={[0, 3, 3, 0]} barSize={16} isAnimationActive animationDuration={600}>
                {rhatData.map((entry, i) => (
                  <Cell key={`rhat-${i}`} fill={entry.fill} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* ESS chart */}
      {essData.length > 0 && (
        <div>
          <h4 className="text-xs font-medium text-zinc-400 mb-2 px-1">
            Effective Sample Size (ESS)
          </h4>
          <ResponsiveContainer width="100%" height={chartHeight}>
            <BarChart
              data={essData}
              layout="vertical"
              margin={{ top: 5, right: 40, left: 100, bottom: 5 }}
              barCategoryGap="25%"
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#27272a" horizontal={false} />
              <XAxis
                type="number"
                tick={{ fill: '#a1a1aa', fontSize: 11 }}
                axisLine={{ stroke: '#27272a' }}
                tickLine={false}
              />
              <YAxis
                type="category"
                dataKey="param"
                tick={{ fill: '#a1a1aa', fontSize: 10 }}
                axisLine={false}
                tickLine={false}
                width={90}
              />
              <Tooltip
                content={({ active, payload }) => {
                  if (!active || !payload?.[0]) return null;
                  const d = payload[0].payload;
                  return (
                    <div className="rounded-lg border border-zinc-700 bg-zinc-900 p-3 shadow-xl text-sm">
                      <p className="font-medium text-zinc-200">{d.param}</p>
                      <p className="text-zinc-400 mt-1">
                        ESS: <span className="text-zinc-100">{d.value.toLocaleString()}</span>
                      </p>
                      <p className={cn('text-xs mt-0.5',
                        d.status === 'good' ? 'text-emerald-400' :
                        d.status === 'marginal' ? 'text-amber-400' : 'text-red-400'
                      )}>
                        {d.status}
                      </p>
                    </div>
                  );
                }}
                cursor={{ fill: 'rgba(255,255,255,0.03)' }}
              />
              <ReferenceLine
                x={400}
                stroke="#10b981"
                strokeDasharray="4 4"
                label={{ value: '400 (target)', fill: '#10b981', fontSize: 10, position: 'top' }}
              />
              <Bar dataKey="value" radius={[0, 3, 3, 0]} barSize={16} isAnimationActive animationDuration={600}>
                {essData.map((entry, i) => (
                  <Cell key={`ess-${i}`} fill={entry.fill} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Legend */}
      <div className="flex items-center gap-4 px-1 text-[10px] text-zinc-600">
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" /> Converged / Good
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-amber-500 inline-block" /> Marginal
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-red-500 inline-block" /> Not converged / Low
        </span>
      </div>
    </div>
  );
}
