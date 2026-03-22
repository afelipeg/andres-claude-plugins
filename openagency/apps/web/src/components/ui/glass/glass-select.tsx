import * as React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, Check } from 'lucide-react';
import { cn } from '@/lib/utils';

/* ── Context ───────────────────────────────────────────────────────── */

interface SelectContextValue {
  value: string;
  onChange: (value: string) => void;
  open: boolean;
  setOpen: React.Dispatch<React.SetStateAction<boolean>>;
}

const SelectContext = React.createContext<SelectContextValue | null>(null);

function useSelectContext() {
  const ctx = React.useContext(SelectContext);
  if (!ctx) throw new Error('GlassSelect components must be used within <GlassSelect>');
  return ctx;
}

/* ── GlassSelect (root) ───────────────────────────────────────────── */

interface GlassSelectProps {
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  children: React.ReactNode;
}

function GlassSelect({
  value: controlledValue,
  defaultValue = '',
  onValueChange,
  children,
}: GlassSelectProps) {
  const [internal, setInternal] = React.useState(defaultValue);
  const [open, setOpen] = React.useState(false);

  const value = controlledValue ?? internal;
  const onChange = React.useCallback(
    (v: string) => {
      if (controlledValue === undefined) setInternal(v);
      onValueChange?.(v);
    },
    [controlledValue, onValueChange],
  );

  // Close on outside click
  const ref = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  return (
    <SelectContext.Provider value={{ value, onChange, open, setOpen }}>
      <div ref={ref} className="relative inline-block text-left">
        {children}
      </div>
    </SelectContext.Provider>
  );
}

/* ── Trigger ───────────────────────────────────────────────────────── */

interface GlassSelectTriggerProps {
  placeholder?: string;
  className?: string;
  children?: React.ReactNode;
  disabled?: boolean;
}

function GlassSelectTrigger({
  className,
  placeholder = 'Select...',
  children,
  disabled,
}: GlassSelectTriggerProps) {
  const { value, open, setOpen } = useSelectContext();

  return (
    <button
      type="button"
      role="combobox"
      aria-expanded={open}
      disabled={disabled}
      onClick={() => setOpen((o) => !o)}
      className={cn(
        'flex h-10 w-full items-center justify-between rounded-lg px-3 py-2',
        'bg-white/10 backdrop-blur-xl border border-white/20',
        'text-sm text-white/95',
        'transition-all duration-200',
        'hover:bg-white/[0.12] hover:border-white/30',
        'focus:outline-none focus:border-[#00F5FF]/50',
        'focus:shadow-[0_0_0_3px_rgba(0,245,255,0.15)]',
        'disabled:cursor-not-allowed disabled:opacity-50',
        className,
      )}
    >
      <span className={cn(!value && 'text-white/40')}>
        {children ?? (value || placeholder)}
      </span>
      <ChevronDown
        className={cn(
          'ml-2 h-4 w-4 shrink-0 text-white/40 transition-transform duration-200',
          open && 'rotate-180',
        )}
      />
    </button>
  );
}

/* ── Content ───────────────────────────────────────────────────────── */

function GlassSelectContent({
  className,
  children,
}: {
  className?: string;
  children?: React.ReactNode;
}) {
  const { open } = useSelectContext();

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0, y: -4, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -4, scale: 0.95 }}
          transition={{ duration: 0.15 }}
          className={cn(
            'absolute z-50 mt-1 w-full min-w-[8rem] overflow-hidden rounded-lg',
            'bg-white/10 backdrop-blur-2xl border border-white/20',
            'shadow-[0_8px_32px_rgba(0,0,0,0.5)]',
            'p-1',
            className,
          )}
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/* ── Item ──────────────────────────────────────────────────────────── */

interface GlassSelectItemProps {
  value: string;
  className?: string;
  children?: React.ReactNode;
  disabled?: boolean;
}

function GlassSelectItem({
  value: itemValue,
  className,
  children,
  disabled,
}: GlassSelectItemProps) {
  const { value, onChange, setOpen } = useSelectContext();
  const isSelected = value === itemValue;

  return (
    <button
      type="button"
      role="option"
      aria-selected={isSelected}
      disabled={disabled}
      onClick={() => {
        onChange(itemValue);
        setOpen(false);
      }}
      className={cn(
        'relative flex w-full cursor-pointer select-none items-center rounded-md py-1.5 pl-8 pr-2',
        'text-sm text-white/80 outline-none',
        'transition-colors duration-150',
        'hover:bg-white/10 hover:text-white',
        isSelected && 'bg-white/10 text-white',
        disabled && 'pointer-events-none opacity-50',
        className,
      )}
    >
      {isSelected && (
        <span className="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">
          <Check className="h-4 w-4 text-[#00F5FF]" />
        </span>
      )}
      {children}
    </button>
  );
}

/* ── Label (group label) ───────────────────────────────────────────── */

function GlassSelectLabel({
  className,
  children,
}: {
  className?: string;
  children?: React.ReactNode;
}) {
  return (
    <div
      className={cn('py-1.5 pl-8 pr-2 text-xs font-medium text-white/40', className)}
    >
      {children}
    </div>
  );
}

export {
  GlassSelect,
  GlassSelectTrigger,
  GlassSelectContent,
  GlassSelectItem,
  GlassSelectLabel,
};
