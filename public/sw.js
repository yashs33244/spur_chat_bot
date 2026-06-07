self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(clients.claim()));

// Handle push events from server (VAPID integration point)
self.addEventListener('push', (event) => {
  const data = event.data?.json() ?? {};

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // If any tab is focused, post a message so the page shows an in-app toast
      // instead of relying on the OS banner (which Chrome suppresses on focused tabs)
      const focused = clientList.find((c) => c.focused);
      if (focused) {
        focused.postMessage({ type: 'PUSH_RECEIVED', data });
      }
      // Always show the OS notification too (for unfocused/minimized state)
      return self.registration.showNotification(data.title ?? 'Spur Support', {
        body: data.body ?? 'New message from Spur Support',
        icon: '/icon-192.png',
        badge: '/icon-72.png',
        data: { url: data.url ?? '/' },
        tag: 'spur-chat',
        renotify: true,
      });
    })
  );
});

// Handle notification click - focus existing tab or open new one
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data?.url ?? '/';
  event.waitUntil(
    clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        for (const client of clientList) {
          if (client.url.includes(self.location.origin) && 'focus' in client) {
            return client.focus();
          }
        }
        return clients.openWindow(url);
      })
  );
});
