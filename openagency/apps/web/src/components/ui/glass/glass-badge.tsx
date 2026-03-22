import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const glassBadgeVariants = cva(
  'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium backdrop-blur-sm transition-colors',
  {
    variants: {
      variant: {
        default: 'bg-white/15 border-white/25 text-white/90',
        primary:
          'bg-gradient-to-r from-[#00F5FF]/30 to-[#00F5FF]/20 border-[#00F5FF]/30 text-[#00F5FF]',
        success:
          'bg-emerald-500/20 border-emerald-400/30 text-emerald-300',
        warning:
          'bg-amber-500/20 border-amber-400/30 text-amber-300',
        destructive:
          'bg-red-500/20 border-red-400/30 text-red-300',
        secondary:
          'bg-gradient-to-r from-[#FF00FF]/30 to-[#FF00FF]/20 border-[#FF00FF]/30 text-[#FF00FF]',
        info:
          'bg-gradient-to-r from-[#7000FF]/30 to-[#7000FF]/20 border-[#7000FF]/30 text-[#a78bfa]',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  },
);

interface GlassBadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof glassBadgeVariants> {
  /** Optional dot indicator before text */
  dot?: boolean;
}

const GlassBadge = React.forwardRef<HTMLSpanElement, GlassBadgeProps>(
  ({ className, variant, dot, children, ...props }, ref) => (
    <span
      ref={ref}
      className={cn(glassBadgeVariants({ variant }), className)}
      {...props}
    >
      {dot && (
        <span
          aria-hidden
          className={cn(
            'mr-1.5 h-1.5 w-1.5 rounded-full',
            variant === 'primary' && 'bg-[#00F5FF]',
            variant === 'success' && 'bg-emerald-400',
            variant === 'warning' && 'bg-amber-400',
            variant === 'destructive' && 'bg-red-400',
            variant === 'secondary' && 'bg-[#FF00FF]',
            variant === 'info' && 'bg-[#7000FF]',
            (!variant || variant === 'default') && 'bg-white/60',
          )}
        />
      )}
      {children}
    </span>
  ),
);
GlassBadge.displayName = 'GlassBadge';

export { GlassBadge, glassBadgeVariants };
