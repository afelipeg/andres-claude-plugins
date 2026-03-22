import * as React from 'react';
import { cn } from '@/lib/utils';

interface GlassInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  icon?: React.ReactNode;
}

const GlassInput = React.forwardRef<HTMLInputElement, GlassInputProps>(
  ({ className, icon, type, ...props }, ref) => (
    <div className="relative">
      {icon && (
        <div className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-white/40">
          {icon}
        </div>
      )}
      <input
        type={type}
        ref={ref}
        className={cn(
          'flex h-10 w-full rounded-lg',
          'bg-white/10 backdrop-blur-xl',
          'border border-white/20',
          'px-3 py-2 text-sm text-white/95',
          'placeholder:text-white/40',
          'transition-all duration-200',
          'focus:outline-none focus:border-[#00F5FF]/50 focus:bg-white/[0.12]',
          'focus:shadow-[0_0_0_3px_rgba(0,245,255,0.15),0_0_20px_rgba(0,245,255,0.1)]',
          'disabled:cursor-not-allowed disabled:opacity-50',
          'file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-white/70',
          icon && 'pl-10',
          className,
        )}
        {...props}
      />
    </div>
  ),
);
GlassInput.displayName = 'GlassInput';

/* ── GlassTextarea ─────────────────────────────────────────────────── */

const GlassTextarea = React.forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement>
>(({ className, ...props }, ref) => (
  <textarea
    ref={ref}
    className={cn(
      'flex min-h-[80px] w-full rounded-lg',
      'bg-white/10 backdrop-blur-xl',
      'border border-white/20',
      'px-3 py-2 text-sm text-white/95',
      'placeholder:text-white/40',
      'transition-all duration-200',
      'focus:outline-none focus:border-[#00F5FF]/50 focus:bg-white/[0.12]',
      'focus:shadow-[0_0_0_3px_rgba(0,245,255,0.15),0_0_20px_rgba(0,245,255,0.1)]',
      'disabled:cursor-not-allowed disabled:opacity-50',
      'resize-none',
      className,
    )}
    {...props}
  />
));
GlassTextarea.displayName = 'GlassTextarea';

export { GlassInput, GlassTextarea };
