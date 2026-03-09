// ─── Notification Hook ────────────────────────────────────────────
// Manages in-app notifications from SSE events (HFL escalations, etc.)

import { useState, useCallback } from 'react';

export type NotificationType = 'hfl_escalation' | 'pipeline_failed' | 'info';
export type NotificationUrgency = 'low' | 'medium' | 'high' | 'critical';

export interface AppNotification {
  id: string;
  type: NotificationType;
  urgency: NotificationUrgency;
  title: string;
  message: string;
  timestamp: string;
  dismissed: boolean;
  meta?: Record<string, unknown>;
}

const MAX_NOTIFICATIONS = 50;

export function useNotifications() {
  const [notifications, setNotifications] = useState<AppNotification[]>([]);

  const push = useCallback((n: Omit<AppNotification, 'dismissed'>) => {
    setNotifications((prev) => {
      const next = [{ ...n, dismissed: false }, ...prev];
      return next.length > MAX_NOTIFICATIONS ? next.slice(0, MAX_NOTIFICATIONS) : next;
    });
  }, []);

  const dismiss = useCallback((id: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, dismissed: true } : n)),
    );
  }, []);

  const dismissAll = useCallback(() => {
    setNotifications((prev) => prev.map((n) => ({ ...n, dismissed: true })));
  }, []);

  const active = notifications.filter((n) => !n.dismissed);

  return { notifications, active, push, dismiss, dismissAll };
}
