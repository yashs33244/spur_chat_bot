'use client';

import { useState, useEffect, useCallback } from 'react';

export type NotifPermission = 'default' | 'granted' | 'denied' | 'unsupported';

export function usePushNotifications() {
  const [permission, setPermission] = useState<NotifPermission>(() => {
    if (typeof Notification === 'undefined') return 'unsupported';
    return Notification.permission;
  });

  // Keep in sync if the user changes browser settings while the tab is open
  useEffect(() => {
    if (typeof Notification === 'undefined') return;
    const id = setInterval(() => {
      const current = Notification.permission;
      setPermission((prev) => (prev !== current ? current : prev));
    }, 5000);
    return () => clearInterval(id);
  }, []);

  const requestPermission = useCallback(async (): Promise<NotifPermission> => {
    if (typeof Notification === 'undefined') return 'unsupported';
    const result = await Notification.requestPermission();
    setPermission(result);
    return result;
  }, []);

  const notify = useCallback(async (title: string, body: string, url?: string) => {
    if (typeof Notification === 'undefined') return;
    if (Notification.permission !== 'granted') return;
    if (!document.hidden) return;

    const options: NotificationOptions = {
      body,
      icon: '/icon-192.png',
      badge: '/icon-72.png',
      tag: 'spur-reply',
    };

    if ('serviceWorker' in navigator) {
      try {
        const reg = await navigator.serviceWorker.ready;
        await reg.showNotification(title, {
          ...options,
          data: { url: url ?? window.location.pathname },
        });
        return;
      } catch {
        // fall through to basic notification
      }
    }

    new Notification(title, options);
  }, []);

  return { permission, requestPermission, notify };
}
