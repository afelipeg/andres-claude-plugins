import * as React from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

/* ── GlassGauge — SVG circular gauge with animated fill ────────────── */

interface GlassGaugeProps extends React.HTMLAttributes<HTMLDivElement> {
  /** 0-100 */
  value: number;
  /** Diameter in px (default 120) */
  size?: number;
  /** Stroke width (default 8) */
  strokeWidth?: number;
  /** Label below value */
  label?: string;
  /** Format value display (default: round to int + %) */
  formatValue?: (value: number) => string;
}

function GlassGauge({
  value,
  size = 120,
  strokeWidth = 8,
  label,
  formatValue,
  className,
  ...props
}: GlassGaugeProps) {
  const clamped = Math.max(0, Math.min(100, value));
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (clamped / 100) * circumference;
  const center = size / 2;

  const gradientId = React.useId();

  const displayValue = formatValue
    ? formatValue(clamped)
    : `${Math.round(clamped)}%`;

  return (
    <div
      className={cn('relative inline-flex flex-col items-center', className)}
      {...props}
    >
      {/* Glow behind */}
      <div
        aria-hidden
        className="absolute inset-0 rounded-full opacity-30 blur-xl"
        style={{
          background: `conic-gradient(from 0deg, #00F5FF, #7000FF, #FF00FF, transparent ${clamped}%)`,
        }}
      />

      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        className="relative -rotate-90"
      >
        <defs>
          <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#00F5FF" />
            <stop offset="50%" stopColor="#7000FF" />
            <stop offset="100%" stopColor="#FF00FF" />
          </linearGradient>
        </defs>

        {/* Track */}
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke="rgba(255,255,255,0.1)"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
        />

        {/* Indicator */}
        <motion.circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke={`url(#${gradientId})`}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 1, ease: 'easeOut' }}
        />
      </svg>

      {/* Center text */}
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <motion.span
          key={clamped}
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-xl font-bold text-white/95"
        >
          {displayValue}
        </motion.span>
        {label && (
          <span className="text-xs text-white/50 mt-0.5">{label}</span>
        )}
      </div>
    </div>
  );
}

export { GlassGauge };
