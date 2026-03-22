import * as React from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

/* ── GlassWidgetBase (shared wrapper) ──────────────────────────────── */

interface GlassWidgetBaseProps extends React.HTMLAttributes<HTMLDivElement> {
  glow?: 'primary' | 'secondary' | 'tertiary' | 'none';
}

function GlassWidgetBase({
  glow = 'none',
  className,
  children,
  ...props
}: GlassWidgetBaseProps) {
  const glowMap: Record<string, string> = {
    primary: 'shadow-[0_0_30px_rgba(0,245,255,0.08)]',
    secondary: 'shadow-[0_0_30px_rgba(255,0,255,0.08)]',
    tertiary: 'shadow-[0_0_30px_rgba(112,0,255,0.08)]',
    none: '',
  };

  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-xl',
        'bg-white/[0.05] backdrop-blur-xl',
        'border border-white/[0.10]',
        'p-5',
        'transition-all duration-300',
        'hover:border-white/[0.15] hover:bg-white/[0.07]',
        glowMap[glow],
        className,
      )}
      {...props}
    >
      {/* Top highlight */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent"
      />
      {children}
    </div>
  );
}

/* ── StatCard ──────────────────────────────────────────────────────── */

interface StatCardProps extends React.HTMLAttributes<HTMLDivElement> {
  label: string;
  value: string | number;
  icon?: React.ReactNode;
  glow?: 'primary' | 'secondary' | 'tertiary' | 'none';
}

function StatCard({ label, value, icon, glow = 'none', className, ...props }: StatCardProps) {
  return (
    <GlassWidgetBase glow={glow} className={className} {...props}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-medium text-white/50 uppercase tracking-wider">
            {label}
          </p>
          <motion.p
            key={String(value)}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-2 text-2xl font-bold text-white/95"
          >
            {value}
          </motion.p>
        </div>
        {icon && (
          <div className="rounded-lg bg-white/10 p-2 text-white/60">
            {icon}
          </div>
        )}
      </div>
    </GlassWidgetBase>
  );
}

/* ── MetricStat (with trend) ───────────────────────────────────────── */

interface MetricStatProps extends React.HTMLAttributes<HTMLDivElement> {
  label: string;
  value: string | number;
  change?: number;
  changeLabel?: string;
  icon?: React.ReactNode;
  glow?: 'primary' | 'secondary' | 'tertiary' | 'none';
}

function MetricStat({
  label,
  value,
  change,
  changeLabel,
  icon,
  glow = 'none',
  className,
  ...props
}: MetricStatProps) {
  const trend =
    change === undefined || change === 0
      ? 'neutral'
      : change > 0
        ? 'up'
        : 'down';

  const TrendIcon =
    trend === 'up' ? TrendingUp : trend === 'down' ? TrendingDown : Minus;
  const trendColor =
    trend === 'up'
      ? 'text-emerald-400'
      : trend === 'down'
        ? 'text-red-400'
        : 'text-white/40';

  return (
    <GlassWidgetBase glow={glow} className={className} {...props}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-medium text-white/50 uppercase tracking-wider">
            {label}
          </p>
          <motion.p
            key={String(value)}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-2 text-2xl font-bold text-white/95"
          >
            {value}
          </motion.p>
          {change !== undefined && (
            <div className={cn('mt-1 flex items-center gap-1 text-xs', trendColor)}>
              <TrendIcon className="h-3 w-3" />
              <span>
                {change > 0 ? '+' : ''}
                {change}%
              </span>
              {changeLabel && (
                <span className="text-white/40 ml-1">{changeLabel}</span>
              )}
            </div>
          )}
        </div>
        {icon && (
          <div className="rounded-lg bg-white/10 p-2 text-white/60">
            {icon}
          </div>
        )}
      </div>
    </GlassWidgetBase>
  );
}

/* ── ComparisonStat ────────────────────────────────────────────────── */

interface ComparisonStatProps extends React.HTMLAttributes<HTMLDivElement> {
  label: string;
  current: string | number;
  previous: string | number;
  currentLabel?: string;
  previousLabel?: string;
  glow?: 'primary' | 'secondary' | 'tertiary' | 'none';
}

function ComparisonStat({
  label,
  current,
  previous,
  currentLabel = 'Current',
  previousLabel = 'Previous',
  glow = 'none',
  className,
  ...props
}: ComparisonStatProps) {
  return (
    <GlassWidgetBase glow={glow} className={className} {...props}>
      <p className="text-xs font-medium text-white/50 uppercase tracking-wider">
        {label}
      </p>
      <div className="mt-3 grid grid-cols-2 gap-4">
        <div>
          <p className="text-xs text-white/40">{currentLabel}</p>
          <p className="mt-1 text-xl font-bold text-white/95">{current}</p>
        </div>
        <div>
          <p className="text-xs text-white/40">{previousLabel}</p>
          <p className="mt-1 text-xl font-bold text-white/50">{previous}</p>
        </div>
      </div>
    </GlassWidgetBase>
  );
}

/* ── CircularProgressStat ──────────────────────────────────────────── */

interface CircularProgressStatProps extends React.HTMLAttributes<HTMLDivElement> {
  label: string;
  value: number;
  maxValue?: number;
  formatValue?: (v: number) => string;
  glow?: 'primary' | 'secondary' | 'tertiary' | 'none';
}

function CircularProgressStat({
  label,
  value,
  maxValue = 100,
  formatValue,
  glow = 'none',
  className,
  ...props
}: CircularProgressStatProps) {
  const pct = Math.min(100, (value / maxValue) * 100);
  const radius = 36;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (pct / 100) * circumference;
  const gradientId = React.useId();

  const display = formatValue ? formatValue(value) : `${Math.round(pct)}%`;

  return (
    <GlassWidgetBase glow={glow} className={cn('flex items-center gap-4', className)} {...props}>
      <div className="relative shrink-0">
        <svg width="80" height="80" viewBox="0 0 80 80" className="-rotate-90">
          <defs>
            <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#00F5FF" />
              <stop offset="50%" stopColor="#7000FF" />
              <stop offset="100%" stopColor="#FF00FF" />
            </linearGradient>
          </defs>
          <circle
            cx="40"
            cy="40"
            r={radius}
            fill="none"
            stroke="rgba(255,255,255,0.1)"
            strokeWidth="6"
          />
          <motion.circle
            cx="40"
            cy="40"
            r={radius}
            fill="none"
            stroke={`url(#${gradientId})`}
            strokeWidth="6"
            strokeLinecap="round"
            strokeDasharray={circumference}
            initial={{ strokeDashoffset: circumference }}
            animate={{ strokeDashoffset: offset }}
            transition={{ duration: 0.8, ease: 'easeOut' }}
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-sm font-bold text-white/90">{display}</span>
        </div>
      </div>
      <div>
        <p className="text-xs font-medium text-white/50 uppercase tracking-wider">
          {label}
        </p>
        <p className="mt-1 text-lg font-bold text-white/95">
          {value}
          {maxValue !== 100 && (
            <span className="text-sm text-white/40 font-normal">
              {' '}
              / {maxValue}
            </span>
          )}
        </p>
      </div>
    </GlassWidgetBase>
  );
}

/* ── StatsGrid ─────────────────────────────────────────────────────── */

interface StatsGridProps extends React.HTMLAttributes<HTMLDivElement> {
  columns?: 2 | 3 | 4;
}

function StatsGrid({ columns = 4, className, children, ...props }: StatsGridProps) {
  const colMap: Record<number, string> = {
    2: 'grid-cols-1 sm:grid-cols-2',
    3: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3',
    4: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4',
  };

  return (
    <div className={cn('grid gap-4', colMap[columns], className)} {...props}>
      {children}
    </div>
  );
}

export {
  GlassWidgetBase,
  StatCard,
  MetricStat,
  ComparisonStat,
  CircularProgressStat,
  StatsGrid,
};
