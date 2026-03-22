import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const glassButtonVariants = cva(
  [
    'inline-flex items-center justify-center gap-2 rounded-lg',
    'font-medium whitespace-nowrap',
    'transition-all duration-200',
    'hover:scale-105 active:scale-95',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00F5FF]/50 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0A0A0F]',
    'disabled:pointer-events-none disabled:opacity-50',
  ].join(' '),
  {
    variants: {
      variant: {
        default:
          'bg-white/20 backdrop-blur-xl border border-white/30 text-white hover:bg-white/30',
        primary:
          'bg-gradient-to-r from-[#00F5FF]/80 via-[#7000FF]/80 to-[#FF00FF]/80 text-white border border-white/20 shadow-[0_0_20px_rgba(0,245,255,0.2)] hover:shadow-[0_0_30px_rgba(0,245,255,0.4)]',
        outline:
          'bg-transparent border-2 border-white/40 text-white hover:bg-white/10 hover:border-white/60',
        ghost:
          'bg-transparent text-white/70 hover:bg-white/10 hover:text-white',
        destructive:
          'bg-red-500/30 border border-red-400/40 text-red-200 hover:bg-red-500/40',
        secondary:
          'bg-[#FF00FF]/20 border border-[#FF00FF]/30 text-[#FF00FF] hover:bg-[#FF00FF]/30',
      },
      size: {
        default: 'h-10 px-4 py-2 text-sm',
        sm: 'h-8 px-3 text-xs',
        lg: 'h-12 px-6 text-base',
        icon: 'h-10 w-10',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
);

interface GlassButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof glassButtonVariants> {
  asChild?: boolean;
  glowEffect?: boolean;
}

const GlassButton = React.forwardRef<HTMLButtonElement, GlassButtonProps>(
  (
    { className, variant, size, asChild = false, glowEffect = false, ...props },
    ref,
  ) => {
    const Comp = asChild ? Slot : 'button';
    return (
      <div className="relative inline-flex">
        {glowEffect && (
          <div
            aria-hidden
            className="absolute -inset-1 rounded-lg bg-gradient-to-r from-[#00F5FF]/40 via-[#7000FF]/40 to-[#FF00FF]/40 opacity-0 blur-lg transition-opacity duration-300 group-hover:opacity-100 hover:opacity-100"
            style={{ pointerEvents: 'none' }}
          />
        )}
        <Comp
          ref={ref}
          className={cn(glassButtonVariants({ variant, size }), className)}
          {...props}
        />
      </div>
    );
  },
);
GlassButton.displayName = 'GlassButton';

export { GlassButton, glassButtonVariants };
export type { GlassButtonProps };
