'use client';

import { useState, useEffect, useCallback } from 'react';

export type NotifPermission = 'default' | 'granted' | 'denied' | 'unsupported';

export function isIOSDevice(): boolean {
  if (typeof navigator === 'undefined') return false;
  return (
    /iPhone|iPad|iPod/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  );
}

export function isInstalledPWA(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as { standalone?: boolean }).standalone === true
  );
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)));
}

// Register a VAPID push subscription and POST it to the server.
// No-ops gracefully if VAPID public key is not configured.
async function registerServerSubscription(sessionId: string) {
  const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  if (!vapidKey || !('serviceWorker' in navigator)) return;

  try {
    const reg = await navigator.serviceWorker.ready;
    const existing = await reg.pushManager.getSubscription();
    const sub =
      existing ??
      (await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidKey).buffer as ArrayBuffer,
      }));

    const json = sub.toJSON();
    if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) return;

    await fetch('/api/push/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId,
        endpoint: json.endpoint,
        p256dh: json.keys.p256dh,
        auth: json.keys.auth,
      }),
    });
  } catch {
    // SW not available or pushManager.subscribe rejected - non-fatal
  }
}

async function fireNotification(title: string, body: string, url?: string) {
  const options: NotificationOptions = {
    body,
    tag: 'spur-reply',
    requireInteraction: false,
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

  const n = new Notification(title, options);
  setTimeout(() => n.close(), 6000);
}

export function usePushNotifications() {
  const [permission, setPermission] = useState<NotifPermission>('default');

  useEffect(() => {
    const t = setTimeout(() => {
      if (typeof Notification === 'undefined') {
        setPermission('unsupported');
        return;
      }
      setPermission(Notification.permission as NotifPermission);
    }, 0);

    const id = setInterval(() => {
      if (typeof Notification === 'undefined') return;
      const current = Notification.permission as NotifPermission;
      setPermission((prev) => (prev === current ? prev : current));
    }, 4000);

    return () => { clearTimeout(t); clearInterval(id); };
  }, []);

  // requestPermission registers the VAPID subscription.
  // If permission is already granted (returning user), silently re-registers
  // without showing the browser prompt - so every new session gets a subscription.
  const requestPermission = useCallback(
    async (sessionId?: string): Promise<NotifPermission> => {
      if (typeof Notification === 'undefined') return 'unsupported';

      // Already granted - no dialog needed, just ensure subscription is live
      if (Notification.permission === 'granted') {
        setPermission('granted');
        if (sessionId) await registerServerSubscription(sessionId);
        return 'granted';
      }

      const result = await Notification.requestPermission();
      setPermission(result as NotifPermission);

      if (result === 'granted') {
        await fireNotification(
          'Spur Support',
          "Notifications enabled - you'll be notified when we reply"
        );
        if (sessionId) await registerServerSubscription(sessionId);
      }

      return result as NotifPermission;
    },
    []
  );

  const notify = useCallback(async (title: string, body: string, url?: string) => {
    if (typeof Notification === 'undefined') return;
    if (Notification.permission !== 'granted') return;
    if (!document.hidden) return;
    await fireNotification(title, body, url);
  }, []);

  return { permission, requestPermission, notify };
}
