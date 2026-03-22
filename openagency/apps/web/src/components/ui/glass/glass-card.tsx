import * as React from 'react';
import { cn } from '@/lib/utils';

/* ── GlassCard ─────────────────────────────────────────────────────── */

interface GlassCardProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Render the protocol gradient glow behind the card */
  glow?: boolean;
}

const GlassCard = React.forwardRef<HTMLDivElement, GlassCardProps>(
  ({ className, glow = false, children, ...props }, ref) => (
    <div ref={ref} className={cn('relative group', className)} {...props}>
      {/* Glow layer */}
      {glow && (
        <div
          aria-hidden
          className="absolute -inset-px rounded-xl bg-gradient-to-r from-[#00F5FF]/30 via-[#7000FF]/30 to-[#FF00FF]/30 opacity-0 blur-xl transition-opacity duration-500 group-hover:opacity-100"
        />
      )}
      {/* Card body */}
      <div
        className={cn(
          'relative overflow-hidden rounded-xl',
          'bg-white/[0.05] backdrop-blur-xl',
          'border border-white/[0.10]',
          'shadow-[0_8px_32px_rgba(0,0,0,0.37)]',
          'transition-all duration-300',
          'hover:border-white/[0.15] hover:bg-white/[0.07]',
        )}
      >
        {/* Top highlight */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent"
        />
        {children}
      </div>
    </div>
  ),
);
GlassCard.displayName = 'GlassCard';

/* ── Sub-components ────────────────────────────────────────────────── */

const GlassCardHeader = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn('flex flex-col space-y-1.5 p-6', className)}
    {...props}
  />
));
GlassCardHeader.displayName = 'GlassCardHeader';

const GlassCardTitle = React.forwardRef<
  HTMLHeadingElement,
  React.HTMLAttributes<HTMLHeadingElement>
>(({ className, ...props }, ref) => (
  <h3
    ref={ref}
    className={cn(
      'text-lg font-semibold leading-none tracking-tight text-white/95',
      className,
    )}
    {...props}
  />
));
GlassCardTitle.displayName = 'GlassCardTitle';

const GlassCardDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <p
    ref={ref}
    className={cn('text-sm text-white/50', className)}
    {...props}
  />
));
GlassCardDescription.displayName = 'GlassCardDescription';

const GlassCardContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn('p-6 pt-0', className)} {...props} />
));
GlassCardContent.displayName = 'GlassCardContent';

const GlassCardFooter = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      'flex items-center p-6 pt-0 border-t border-white/[0.08]',
      className,
    )}
    {...props}
  />
));
GlassCardFooter.displayName = 'GlassCardFooter';

export {
  GlassCard,
  GlassCardHeader,
  GlassCardTitle,
  GlassCardDescription,
  GlassCardContent,
  GlassCardFooter,
};
