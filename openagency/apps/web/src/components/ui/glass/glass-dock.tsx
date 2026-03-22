import * as React from 'react';
import { motion, useMotionValue, useSpring, useTransform } from 'framer-motion';
import { cn } from '@/lib/utils';

/* ── GlassDock — macOS-style magnification dock ────────────────────── */

interface GlassDockProps {
  /** Direction of the dock */
  direction?: 'horizontal' | 'vertical';
  /** Max scale on hover (default 1.5) */
  magnification?: number;
  /** Distance of effect in px (default 140) */
  distance?: number;
  className?: string;
  children?: React.ReactNode;
}

function GlassDock({
  direction = 'horizontal',
  magnification = 1.5,
  distance = 140,
  className,
  children,
}: GlassDockProps) {
  const mousePos = useMotionValue(Infinity);

  return (
    <motion.div
      onMouseMove={(e) => {
        const rect = e.currentTarget.getBoundingClientRect();
        mousePos.set(
          direction === 'horizontal'
            ? e.clientX - rect.left
            : e.clientY - rect.top,
        );
      }}
      onMouseLeave={() => mousePos.set(Infinity)}
      className={cn(
        'inline-flex items-end gap-2 rounded-2xl p-3',
        'bg-white/[0.05] backdrop-blur-xl border border-white/[0.10]',
        'shadow-[0_8px_32px_rgba(0,0,0,0.37)]',
        direction === 'vertical' && 'flex-col items-center',
        className,
      )}
    >
      {React.Children.map(children, (child) => {
        if (!React.isValidElement(child)) return child;
        return React.cloneElement(child as React.ReactElement<GlassDockItemInternalProps>, {
          _mousePos: mousePos,
          _direction: direction,
          _magnification: magnification,
          _distance: distance,
        } as Partial<GlassDockItemInternalProps>);
      })}
    </motion.div>
  );
}

/* ── GlassDockItem ─────────────────────────────────────────────────── */

interface GlassDockItemInternalProps {
  _mousePos: ReturnType<typeof useMotionValue<number>>;
  _direction: 'horizontal' | 'vertical';
  _magnification: number;
  _distance: number;
}

interface GlassDockItemProps {
  /** Whether this item is active */
  active?: boolean;
  /** Accessible label */
  label?: string;
  className?: string;
  children?: React.ReactNode;
  onClick?: () => void;
}

function GlassDockItem({
  className,
  active,
  label,
  children,
  onClick,
  _mousePos,
  _direction = 'horizontal',
  _magnification = 1.5,
  _distance = 140,
}: GlassDockItemProps & Partial<GlassDockItemInternalProps>) {
  const itemRef = React.useRef<HTMLDivElement>(null);

  const fallbackMv = useMotionValue(Infinity);
  const mousePosResolved = _mousePos ?? fallbackMv;

  const distanceFromMouse = useTransform(
    mousePosResolved,
    (val: number) => {
      const el = itemRef.current;
      if (!el) return Infinity;
      const rect = el.getBoundingClientRect();
      const parentRect = el.parentElement?.getBoundingClientRect();
      if (!parentRect) return Infinity;
      const center =
        _direction === 'horizontal'
          ? rect.left - parentRect.left + rect.width / 2
          : rect.top - parentRect.top + rect.height / 2;
      return Math.abs(val - center);
    },
  );

  const scaleRaw = useTransform(distanceFromMouse, [0, _distance], [_magnification, 1]);
  const scale = useSpring(scaleRaw, { stiffness: 300, damping: 25 });

  return (
    <motion.div
      ref={itemRef}
      style={{ scale }}
      className={cn('relative flex items-center justify-center', className)}
      aria-label={label}
      onClick={onClick}
    >
      <div
        className={cn(
          'flex items-center justify-center rounded-xl p-2',
          'bg-white/10 border border-white/20',
          'transition-colors duration-200',
          'hover:bg-white/20',
          'cursor-pointer',
        )}
      >
        {children}
      </div>
      {/* Active dot */}
      {active && (
        <div
          aria-hidden
          className="absolute -bottom-1.5 h-1 w-1 rounded-full bg-[#00F5FF] shadow-[0_0_6px_rgba(0,245,255,0.8)]"
        />
      )}
    </motion.div>
  );
}

export { GlassDock, GlassDockItem };
