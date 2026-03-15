// ─── Notification Banner ──────────────────────────────────────────
// Displays HFL escalation alerts and other notifications as a
// dismissable banner in the top bar area.

import { useNavigate } from 'react-router-dom';
import type { AppNotification, NotificationUrgency } from '../hooks/useNotifications';

interface NotificationBannerProps {
  notifications: AppNotification[];
  onDismiss: (id: string) => void;
  onDismissAll: () => void;
}

const URGENCY_STYLES: Record<NotificationUrgency, string> = {
  low: 'bg-zinc-50 border-zinc-200 text-zinc-800',
  medium: 'bg-amber-50 border-amber-200 text-amber-800',
  high: 'bg-orange-50 border-orange-300 text-orange-900',
  critical: 'bg-red-50 border-red-300 text-red-900',
};

const URGENCY_ICON_BG: Record<NotificationUrgency, string> = {
  low: 'bg-zinc-100 text-zinc-600',
  medium: 'bg-amber-100 text-amber-600',
  high: 'bg-orange-100 text-orange-600',
  critical: 'bg-red-100 text-red-600',
};

export function NotificationBanner({ notifications, onDismiss, onDismissAll }: NotificationBannerProps) {
  if (notifications.length === 0) return null;

  return (
    <div className="space-y-2 px-6 py-3 border-b border-gray-200 bg-gray-50">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
          Alerts ({notifications.length})
        </span>
        {notifications.length > 1 && (
          <button
            onClick={onDismissAll}
            className="text-xs text-gray-400 hover:text-gray-600 transition-colors"
          >
            Dismiss all
          </button>
        )}
      </div>
      {notifications.slice(0, 5).map((n) => (
        <NotificationCard key={n.id} notification={n} onDismiss={onDismiss} />
      ))}
    </div>
  );
}

function NotificationCard({
  notification,
  onDismiss,
}: {
  notification: AppNotification;
  onDismiss: (id: string) => void;
}) {
  const navigate = useNavigate();
  const style = URGENCY_STYLES[notification.urgency];
  const iconBg = URGENCY_ICON_BG[notification.urgency];
  const time = new Date(notification.timestamp).toLocaleTimeString();
  const conversationId = notification.meta?.['conversation_id'] as string | undefined;

  const handleReview = () => {
    const path = conversationId ? `/app/assistant/${conversationId}` : '/app/assistant';
    navigate(path);
    onDismiss(notification.id);
  };

  return (
    <div className={`flex items-start gap-3 rounded-lg border px-4 py-3 ${style}`}>
      <div className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${iconBg}`}>
        {notification.type === 'hfl_escalation' ? (
          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 15.75h.007v.008H12v-.008z" />
          </svg>
        ) : (
          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z" />
          </svg>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm font-semibold">{notification.title}</p>
          <span className="text-xs opacity-60 shrink-0">{time}</span>
        </div>
        <p className="mt-0.5 text-xs opacity-80 line-clamp-2">{notification.message}</p>
        {conversationId && (
          <button
            onClick={handleReview}
            className="mt-2 text-xs font-semibold underline underline-offset-2 opacity-90 hover:opacity-100 transition-opacity"
          >
            Review in Assistant →
          </button>
        )}
      </div>
      <button
        onClick={() => onDismiss(notification.id)}
        className="mt-0.5 shrink-0 opacity-40 hover:opacity-80 transition-opacity"
        aria-label="Dismiss notification"
      >
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
}
