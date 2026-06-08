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

// Stable identity for this physical device. Generated once and persisted in localStorage.
// Survives page navigations and session changes. Used to link push subscriptions to devices.
export function getDeviceId(): string {
  if (typeof window === 'undefined') return '';
  const key = 'spur_device_id';
  let id = localStorage.getItem(key);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(key, id);
  }
  return id;
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)));
}

// Register a VAPID push subscription and POST it to the server.
// Sends both deviceId (stable per device) and sessionId (current chat session).
// Only called from message-send paths where a conversation is guaranteed to exist.
async function registerServerSubscription(deviceId: string, sessionId: string) {
  const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  if (!vapidKey || !('serviceWorker' in navigator) || !deviceId || !sessionId) return;

  try {
    const reg = await navigator.serviceWorker.ready;
    const existing = await reg.pushManager.getSubscription();
    const newKeyBytes = urlBase64ToUint8Array(vapidKey);

    // Detect VAPID key rotation: the old sub's key won't match the current key.
    // FCM silently drops pushes when keys mismatch, so force a re-subscribe.
    let needsResub = !existing;
    if (existing) {
      const existingKey = new Uint8Array(existing.options.applicationServerKey ?? new ArrayBuffer(0));
      needsResub =
        existingKey.length !== newKeyBytes.length ||
        existingKey.some((b, i) => b !== newKeyBytes[i]);
      if (needsResub) await existing.unsubscribe();
    }

    const sub = needsResub
      ? await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: newKeyBytes.buffer as ArrayBuffer,
        })
      : existing!;

    const json = sub.toJSON();
    if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) return;

    await fetch('/api/push/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        deviceId,
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

export type InAppToast = { title: string; body: string; url: string } | null;

export function usePushNotifications() {
  const [permission, setPermission] = useState<NotifPermission>('default');
  const [inAppToast, setInAppToast] = useState<InAppToast>(null);

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

  // Listen for PUSH_RECEIVED messages from the service worker.
  // Shows an in-app toast when the tab is focused (Chrome suppresses OS banners in that case).
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;
    const handler = (event: MessageEvent) => {
      if (event.data?.type !== 'PUSH_RECEIVED') return;
      const { title, body, url } = event.data.data ?? {};
      setInAppToast({ title: title ?? 'Spur Support', body: body ?? '', url: url ?? '/' });
      setTimeout(() => setInAppToast(null), 8000);
    };
    navigator.serviceWorker.addEventListener('message', handler);
    return () => navigator.serviceWorker.removeEventListener('message', handler);
  }, []);

  // requestPermission - shows browser dialog for new users.
  // Pass BOTH deviceId and sessionId when called from a message-send path (conversation exists).
  // Call with no args from the bell button - only shows the dialog, no server subscription saved.
  const requestPermission = useCallback(
    async (deviceId?: string, sessionId?: string): Promise<NotifPermission> => {
      if (typeof Notification === 'undefined') return 'unsupported';

      if (Notification.permission === 'granted') {
        setPermission('granted');
        if (deviceId && sessionId) await registerServerSubscription(deviceId, sessionId);
        return 'granted';
      }

      const result = await Notification.requestPermission();
      setPermission(result as NotifPermission);

      if (result === 'granted') {
        await fireNotification(
          'Spur Support',
          "Notifications enabled - you'll be notified when we reply"
        );
        if (deviceId && sessionId) await registerServerSubscription(deviceId, sessionId);
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

  return { permission, requestPermission, notify, inAppToast, dismissToast: () => setInAppToast(null) };
}
