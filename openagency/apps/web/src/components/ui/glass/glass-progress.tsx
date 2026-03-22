import * as React from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

/* ── GlassProgress (linear) ────────────────────────────────────────── */

interface GlassProgressProps extends React.HTMLAttributes<HTMLDivElement> {
  /** 0-100 */
  value?: number;
  /** Show percentage label */
  showLabel?: boolean;
  /** Use protocol gradient (default) or a single color */
  color?: 'protocol' | 'primary' | 'secondary' | 'tertiary' | 'success' | 'warning' | 'destructive';
}

const colorMap: Record<string, string> = {
  protocol: 'bg-gradient-to-r from-[#00F5FF] via-[#7000FF] to-[#FF00FF]',
  primary: 'bg-[#00F5FF]',
  secondary: 'bg-[#FF00FF]',
  tertiary: 'bg-[#7000FF]',
  success: 'bg-emerald-400',
  warning: 'bg-amber-400',
  destructive: 'bg-red-400',
};

const GlassProgress = React.forwardRef<HTMLDivElement, GlassProgressProps>(
  ({ className, value = 0, showLabel = false, color = 'protocol', ...props }, ref) => {
    const clamped = Math.max(0, Math.min(100, value));

    return (
      <div className={cn('flex flex-col gap-1', className)} {...props}>
        {showLabel && (
          <div className="flex justify-between text-xs text-white/50">
            <span>Progress</span>
            <span>{Math.round(clamped)}%</span>
          </div>
        )}
        <div
          ref={ref}
          role="progressbar"
          aria-valuenow={clamped}
          aria-valuemin={0}
          aria-valuemax={100}
          className="relative h-2 w-full overflow-hidden rounded-full bg-white/10 backdrop-blur"
        >
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${clamped}%` }}
            transition={{ duration: 0.6, ease: 'easeOut' }}
            className={cn(
              'h-full rounded-full',
              colorMap[color] ?? colorMap.protocol,
            )}
          />
          {/* Glow */}
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${clamped}%` }}
            transition={{ duration: 0.6, ease: 'easeOut' }}
            className={cn(
              'absolute top-0 h-full rounded-full blur-sm opacity-50',
              colorMap[color] ?? colorMap.protocol,
            )}
          />
        </div>
      </div>
    );
  },
);
GlassProgress.displayName = 'GlassProgress';

export { GlassProgress };
