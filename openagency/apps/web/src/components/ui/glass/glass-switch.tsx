import * as React from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

/* ── GlassSwitch (div-based, no Radix dependency) ─────────────────── */

interface GlassSwitchProps
  extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'onChange'> {
  checked?: boolean;
  defaultChecked?: boolean;
  onCheckedChange?: (checked: boolean) => void;
  label?: string;
}

const GlassSwitch = React.forwardRef<HTMLButtonElement, GlassSwitchProps>(
  (
    {
      className,
      checked: controlledChecked,
      defaultChecked = false,
      onCheckedChange,
      label,
      disabled,
      ...props
    },
    ref,
  ) => {
    const [internal, setInternal] = React.useState(defaultChecked);
    const checked = controlledChecked ?? internal;

    const toggle = () => {
      if (disabled) return;
      const next = !checked;
      if (controlledChecked === undefined) setInternal(next);
      onCheckedChange?.(next);
    };

    return (
      <div className="inline-flex items-center gap-2">
        <button
          ref={ref}
          type="button"
          role="switch"
          aria-checked={checked}
          aria-label={label}
          disabled={disabled}
          onClick={toggle}
          className={cn(
            'relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full',
            'border-2 transition-colors duration-200',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00F5FF]/50 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0A0A0F]',
            'disabled:cursor-not-allowed disabled:opacity-50',
            checked
              ? 'bg-gradient-to-r from-[#00F5FF]/60 to-[#7000FF]/60 border-[#00F5FF]/40'
              : 'bg-white/10 border-white/20',
            className,
          )}
          {...props}
        >
          <motion.span
            aria-hidden
            layout
            transition={{ type: 'spring', stiffness: 500, damping: 30 }}
            className={cn(
              'pointer-events-none block h-5 w-5 rounded-full shadow-lg',
              checked ? 'bg-white' : 'bg-white/60',
            )}
            style={{ x: checked ? 20 : 0 }}
          />
        </button>
        {label && (
          <span className="text-sm text-white/70">{label}</span>
        )}
      </div>
    );
  },
);
GlassSwitch.displayName = 'GlassSwitch';

export { GlassSwitch };
