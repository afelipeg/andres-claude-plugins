import * as React from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

/* ── Types ─────────────────────────────────────────────────────────── */

type TimelineItemStatus = 'completed' | 'current' | 'upcoming';

interface TimelineItem {
  id: string;
  title: string;
  description?: string;
  status: TimelineItemStatus;
  timestamp?: string;
  icon?: React.ReactNode;
}

/* ── GlassTimeline ─────────────────────────────────────────────────── */

interface GlassTimelineProps extends React.HTMLAttributes<HTMLDivElement> {
  items: TimelineItem[];
}

function GlassTimeline({ items, className, ...props }: GlassTimelineProps) {
  return (
    <div className={cn('relative', className)} {...props}>
      {/* Vertical line */}
      <div
        aria-hidden
        className="absolute left-4 top-0 bottom-0 w-px bg-gradient-to-b from-[#00F5FF]/30 via-[#7000FF]/30 to-white/10"
      />

      <div className="space-y-6">
        {items.map((item, index) => (
          <TimelineEntry key={item.id} item={item} index={index} />
        ))}
      </div>
    </div>
  );
}

/* ── TimelineEntry ─────────────────────────────────────────────────── */

function TimelineEntry({ item, index }: { item: TimelineItem; index: number }) {
  const dotClasses: Record<TimelineItemStatus, string> = {
    completed:
      'bg-gradient-to-r from-[#00F5FF] to-[#7000FF] shadow-[0_0_8px_rgba(0,245,255,0.5)]',
    current:
      'bg-[#00F5FF] shadow-[0_0_12px_rgba(0,245,255,0.6)] animate-pulse',
    upcoming: 'bg-white/20 border border-white/30',
  };

  const cardClasses: Record<TimelineItemStatus, string> = {
    completed: 'bg-white/[0.07] border-white/[0.12]',
    current:
      'bg-white/[0.10] border-[#00F5FF]/30 shadow-[0_0_20px_rgba(0,245,255,0.1)]',
    upcoming: 'bg-white/[0.03] border-white/[0.08] opacity-60',
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.3, delay: index * 0.1 }}
      className="relative flex items-start gap-4 pl-10"
    >
      {/* Dot */}
      <div
        aria-hidden
        className={cn(
          'absolute left-2.5 top-3 h-3 w-3 rounded-full',
          dotClasses[item.status],
        )}
      />

      {/* Card */}
      <div
        className={cn(
          'flex-1 rounded-lg border p-4 backdrop-blur-xl',
          'transition-all duration-200 hover:bg-white/[0.08]',
          cardClasses[item.status],
        )}
      >
        <div className="flex items-center gap-2">
          {item.icon && (
            <span className="text-white/60">{item.icon}</span>
          )}
          <h4
            className={cn(
              'text-sm font-medium',
              item.status === 'upcoming' ? 'text-white/50' : 'text-white/90',
            )}
          >
            {item.title}
          </h4>
          {item.timestamp && (
            <span className="ml-auto text-xs text-white/40">
              {item.timestamp}
            </span>
          )}
        </div>
        {item.description && (
          <p className="mt-1 text-xs text-white/50">{item.description}</p>
        )}
      </div>
    </motion.div>
  );
}

export { GlassTimeline };
export type { TimelineItem, TimelineItemStatus };
