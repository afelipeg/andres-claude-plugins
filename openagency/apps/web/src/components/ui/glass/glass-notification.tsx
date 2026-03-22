import * as React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, CheckCircle, AlertCircle, AlertTriangle, Info } from 'lucide-react';
import { cn } from '@/lib/utils';

/* ── Types ─────────────────────────────────────────────────────────── */

type NotificationType = 'success' | 'error' | 'warning' | 'info';

interface GlassNotification {
  id: string;
  type: NotificationType;
  title: string;
  description?: string;
  duration?: number;
}

/* ── Context + Provider ────────────────────────────────────────────── */

interface NotificationContextValue {
  notifications: GlassNotification[];
  addNotification: (n: Omit<GlassNotification, 'id'>) => string;
  removeNotification: (id: string) => void;
}

const NotificationContext = React.createContext<NotificationContextValue | null>(null);

function useGlassNotifications() {
  const ctx = React.useContext(NotificationContext);
  if (!ctx) throw new Error('useGlassNotifications must be used within <GlassNotificationProvider>');
  return ctx;
}

let idCounter = 0;

function GlassNotificationProvider({ children }: { children: React.ReactNode }) {
  const [notifications, setNotifications] = React.useState<GlassNotification[]>([]);

  const addNotification = React.useCallback(
    (n: Omit<GlassNotification, 'id'>) => {
      const id = `glass-notif-${++idCounter}`;
      setNotifications((prev) => [...prev, { ...n, id }]);

      // Auto-dismiss
      const dur = n.duration ?? 5000;
      if (dur > 0) {
        setTimeout(() => {
          setNotifications((prev) => prev.filter((x) => x.id !== id));
        }, dur);
      }

      return id;
    },
    [],
  );

  const removeNotification = React.useCallback((id: string) => {
    setNotifications((prev) => prev.filter((x) => x.id !== id));
  }, []);

  return (
    <NotificationContext.Provider
      value={{ notifications, addNotification, removeNotification }}
    >
      {children}
      <GlassNotificationList />
    </NotificationContext.Provider>
  );
}

/* ── Notification list (rendered by provider) ──────────────────────── */

function GlassNotificationList() {
  const { notifications, removeNotification } = useGlassNotifications();

  return (
    <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2 pointer-events-none">
      <AnimatePresence>
        {notifications.map((n) => (
          <GlassNotificationToast
            key={n.id}
            notification={n}
            onDismiss={() => removeNotification(n.id)}
          />
        ))}
      </AnimatePresence>
    </div>
  );
}

/* ── Single toast ──────────────────────────────────────────────────── */

const typeConfig: Record<
  NotificationType,
  { icon: React.ReactNode; glow: string; border: string }
> = {
  success: {
    icon: <CheckCircle className="h-5 w-5 text-emerald-400" />,
    glow: 'shadow-[0_0_20px_rgba(52,211,153,0.2)]',
    border: 'border-emerald-400/30',
  },
  error: {
    icon: <AlertCircle className="h-5 w-5 text-red-400" />,
    glow: 'shadow-[0_0_20px_rgba(248,113,113,0.2)]',
    border: 'border-red-400/30',
  },
  warning: {
    icon: <AlertTriangle className="h-5 w-5 text-amber-400" />,
    glow: 'shadow-[0_0_20px_rgba(251,191,36,0.2)]',
    border: 'border-amber-400/30',
  },
  info: {
    icon: <Info className="h-5 w-5 text-[#00F5FF]" />,
    glow: 'shadow-[0_0_20px_rgba(0,245,255,0.2)]',
    border: 'border-[#00F5FF]/30',
  },
};

function GlassNotificationToast({
  notification,
  onDismiss,
}: {
  notification: GlassNotification;
  onDismiss: () => void;
}) {
  const config = typeConfig[notification.type];
  const duration = notification.duration ?? 5000;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 20, scale: 0.95 }}
      transition={{ duration: 0.2 }}
      className={cn(
        'pointer-events-auto relative w-80 overflow-hidden rounded-lg',
        'bg-white/10 backdrop-blur-2xl border',
        config.border,
        config.glow,
      )}
    >
      <div className="flex items-start gap-3 p-4">
        <div className="shrink-0 mt-0.5">{config.icon}</div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-white/90">
            {notification.title}
          </p>
          {notification.description && (
            <p className="mt-1 text-xs text-white/50">
              {notification.description}
            </p>
          )}
        </div>
        <button
          onClick={onDismiss}
          className="shrink-0 rounded p-0.5 text-white/40 hover:text-white hover:bg-white/10 transition-colors"
          aria-label="Dismiss"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Progress timer */}
      {duration > 0 && (
        <motion.div
          initial={{ width: '100%' }}
          animate={{ width: '0%' }}
          transition={{ duration: duration / 1000, ease: 'linear' }}
          className="h-0.5 bg-gradient-to-r from-[#00F5FF] via-[#7000FF] to-[#FF00FF]"
        />
      )}
    </motion.div>
  );
}

export {
  GlassNotificationProvider,
  useGlassNotifications,
};
export type { GlassNotification, NotificationType };
