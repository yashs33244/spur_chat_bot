'use client';

import { useState, useEffect, useCallback } from 'react';

export type NotifPermission = 'default' | 'granted' | 'denied' | 'unsupported';

export function isIOSDevice(): boolean {
  if (typeof navigator === 'undefined') return false;
  return (
    /iPhone|iPad|iPod/.test(navigator.userAgent) ||
    // iPad on iOS 13+ reports as MacIntel with touch points
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  );
}

export function isInstalledPWA(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    // iOS Safari standalone flag
    (window.navigator as { standalone?: boolean }).standalone === true
  );
}

export function usePushNotifications() {
  // Start with 'default' - safe for SSR. Real value is detected after mount.
  const [permission, setPermission] = useState<NotifPermission>('default');

  useEffect(() => {
    // Defer initial detection so it runs after hydration and avoids
    // synchronous setState-in-effect lint rule
    const t = setTimeout(() => {
      if (typeof Notification === 'undefined') {
        setPermission('unsupported');
        return;
      }
      setPermission(Notification.permission as NotifPermission);
    }, 0);

    // Poll for changes (user may change browser settings while tab is open)
    const id = setInterval(() => {
      if (typeof Notification === 'undefined') return;
      const current = Notification.permission as NotifPermission;
      setPermission((prev) => (prev === current ? prev : current));
    }, 4000);

    return () => {
      clearTimeout(t);
      clearInterval(id);
    };
  }, []);

  const requestPermission = useCallback(async (): Promise<NotifPermission> => {
    if (typeof Notification === 'undefined') return 'unsupported';
    const result = await Notification.requestPermission();
    setPermission(result as NotifPermission);
    return result as NotifPermission;
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
        // fall through
      }
    }

    new Notification(title, options);
  }, []);

  return { permission, requestPermission, notify };
}
