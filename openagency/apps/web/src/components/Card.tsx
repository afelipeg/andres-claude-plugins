import type { ReactNode } from 'react';

interface CardProps {
  title?: string;
  children: ReactNode;
  className?: string;
  action?: ReactNode;
}

export function Card({ title, children, className = '', action }: CardProps) {
  return (
    <div className={`rounded-xl border border-gray-200 bg-white shadow-sm ${className}`}>
      {title && (
        <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
          <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
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
  green: 'text-green-600 bg-green-50',
  red: 'text-red-600 bg-red-50',
  yellow: 'text-yellow-600 bg-yellow-50',
  blue: 'text-brand-600 bg-brand-50',
  gray: 'text-gray-600 bg-gray-50',
} as const;

export function MetricCard({ label, value, sub, color = 'blue' }: MetricCardProps) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
      <p className="text-xs font-medium uppercase tracking-wider text-gray-500">{label}</p>
      <p className={`mt-2 text-2xl font-bold ${COLOR_MAP[color].split(' ')[0]}`}>{value}</p>
      {sub && (
        <span className={`mt-2 inline-block rounded-full px-2 py-0.5 text-xs font-medium ${COLOR_MAP[color]}`}>
          {sub}
        </span>
      )}
    </div>
  );
}
