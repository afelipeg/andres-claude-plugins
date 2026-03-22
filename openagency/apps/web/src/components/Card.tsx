import type { ReactNode } from 'react';

interface CardProps {
  title?: string;
  children: ReactNode;
  className?: string;
  action?: ReactNode;
}

export function Card({ title, children, className = '', action }: CardProps) {
  return (
    <div className={`relative overflow-hidden rounded-xl bg-white/[0.05] backdrop-blur-xl border border-white/[0.10] shadow-[0_8px_32px_rgba(0,0,0,0.37)] transition-all duration-300 hover:border-white/[0.15] hover:bg-white/[0.07] ${className}`}>
      {/* Top highlight */}
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />
      {title && (
        <div className="flex items-center justify-between border-b border-white/[0.06] px-6 py-4">
          <h3 className="text-sm font-semibold text-white/95">{title}</h3>
          {action}
        </div>
      )}
      <div className="p-6">{children}</div>
    </div>
  );
}

interface MetricCardProps {
  label: string;
  value: string;
  sub?: string;
  color?: 'green' | 'red' | 'yellow' | 'blue' | 'gray';
}

const COLOR_MAP = {
  green: 'text-emerald-400',
  red: 'text-red-400',
  yellow: 'text-amber-400',
  blue: 'text-[#00F5FF]',
  gray: 'text-white/70',
} as const;

const SUB_COLOR_MAP = {
  green: 'bg-emerald-500/20 border-emerald-400/30 text-emerald-300',
  red: 'bg-red-500/20 border-red-400/30 text-red-300',
  yellow: 'bg-amber-500/20 border-amber-400/30 text-amber-300',
  blue: 'bg-[#00F5FF]/20 border-[#00F5FF]/30 text-[#00F5FF]',
  gray: 'bg-white/10 border-white/20 text-white/70',
} as const;

export function MetricCard({ label, value, sub, color = 'blue' }: MetricCardProps) {
  return (
    <div className="relative overflow-hidden rounded-xl bg-white/[0.05] backdrop-blur-xl border border-white/[0.10] p-5 shadow-[0_8px_32px_rgba(0,0,0,0.37)] transition-all duration-300 hover:border-white/[0.15] hover:bg-white/[0.07]">
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />
      <p className="text-xs font-medium uppercase tracking-wider text-white/50">{label}</p>
      <p className={`mt-2 text-2xl font-bold ${COLOR_MAP[color]}`}>{value}</p>
      {sub && (
        <span className={`mt-2 inline-block rounded-full border px-2 py-0.5 text-xs font-medium ${SUB_COLOR_MAP[color]}`}>
          {sub}
        </span>
      )}
    </div>
  );
}
