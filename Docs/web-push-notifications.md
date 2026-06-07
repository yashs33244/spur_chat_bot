# Web Push Notifications - Implementation

## What was built

A full server-side Web Push stack using VAPID authentication. Notifications reach the user even after the browser tab is closed.

Feature: after the AI replies to a message, a 5-minute timer starts. If the user goes quiet (closes the tab, switches apps), the server sends an OS-level push notification: "Did we resolve your issue? We are here if you need more help." If the user sends another message before the timer expires, it is cancelled.

---

## Files changed

| File | Status | What it does |
|---|---|---|
| `public/sw.js` | New | Service worker - receives push events from FCM/APNs, shows the OS notification, handles notification click |
| `public/manifest.json` | New | PWA manifest - enables "Add to Home Screen" on Android and iOS |
| `hooks/usePushNotifications.ts` | New | Manages permission state, creates VAPID PushSubscription in the browser, POSTs subscription to server |
| `app/api/push/subscribe/route.ts` | New | Stores the browser PushSubscription (endpoint, p256dh, auth) keyed by sessionId |
| `app/api/push/followup/route.ts` | New | Cron endpoint - queries DB for due follow-ups, signs with VAPID private key, sends via web-push package |
| `lib/repositories/push-subscription.repo.ts` | New | DB helpers: upsertPushSubscription, scheduleFollowUp, cancelFollowUp, getPendingFollowUps, markFollowUpSent |
| `lib/db/schema.ts` | Modified | Added push_subscriptions table + followup_scheduled_at / followup_sent columns on conversations |
| `drizzle/0003_push_notifications.sql` | New | Migration applied to Neon |
| `app/api/chat/route.ts` | Modified | onFinish: scheduleFollowUp(sessionId). On new user message: cancelFollowUp(sessionId) |
| `app/layout.tsx` | Modified | Registers service worker via afterInteractive script |
| `vercel.json` | New | Vercel Cron - hits /api/push/followup every minute |
| `.env.example` | Modified | Documents NEXT_PUBLIC_VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_EMAIL, CRON_SECRET |

---

## Architecture

### Key concepts

**VAPID (Voluntary Application Server Identification)** - an EC key pair on the P-256 curve. The public key is given to the browser during subscription. The private key signs every push request sent to FCM/APNs, proving the push came from this server and not a third party.

**Service worker** - a JavaScript file (`public/sw.js`) that runs in a separate background context, persists after the tab closes (as long as the browser is open), and is the only context that can receive server-sent push events and show OS notifications.

**PushSubscription** - a browser object created when the user grants permission. Contains:
- `endpoint`: an FCM or APNs URL unique to this browser installation
- `p256dh`: browser's public key for payload encryption
- `auth`: a secret for the encryption

These three values are stored in the `push_subscriptions` table and used by the server to send pushes later.

### End-to-end flow

```
User sends first message
  -> handleSend fires (user gesture required by all browsers for permission prompt)
  -> Notification.requestPermission() called
  -> Browser shows native "Allow notifications?" dialog
  -> User clicks Allow

Browser creates PushSubscription
  -> pushManager.subscribe({ applicationServerKey: VAPID_PUBLIC_KEY })
  -> Returns { endpoint: "https://fcm.googleapis.com/...", keys: { p256dh, auth } }
  -> Endpoint is tied to this browser on Google/Apple's servers

App stores subscription
  -> POST /api/push/subscribe { sessionId, endpoint, p256dh, auth }
  -> Upserted into push_subscriptions table in Neon

AI replies to a message
  -> /api/chat onFinish: scheduleFollowUp(sessionId)
  -> conversations.followup_scheduled_at = NOW() + 5 minutes
  -> conversations.followup_sent = false

User sends another message before 5 minutes
  -> cancelFollowUp(sessionId) on next user message
  -> followup_scheduled_at = NULL, followup_sent = true
  -> No notification sent

User goes quiet / closes the tab
  -> Vercel Cron hits GET /api/push/followup every minute
  -> Queries: conversations JOIN push_subscriptions
              WHERE followup_scheduled_at <= NOW()
              AND followup_sent = false
  -> For each match:
       webpush.sendNotification(
         { endpoint, keys: { p256dh, auth } },
         JSON.stringify({ title, body, url })
       )
       Signs request with VAPID private key
       POSTs encrypted payload to FCM or APNs endpoint

Google/Apple relays to device
  -> sw.js wakes up in background - 'push' event fires
  -> self.registration.showNotification("Spur Support - Quick Check", ...)
  -> OS shows notification even with browser closed

User taps notification
  -> notificationclick in sw.js
  -> If tab already open: client.focus()
  -> Otherwise: clients.openWindow("/{sessionId}")
```

---

## Why a service worker is required

JavaScript in a tab stops running when the tab closes. A service worker is the only JavaScript context that:

1. Survives tab close (as long as the browser process is running)
2. Can receive a server-sent `push` event
3. Can call `self.registration.showNotification` to show an OS-level notification
4. Can handle `notificationclick` to focus or open a tab

Without the service worker, notifications can only be shown while the tab is open. The entire point of the follow-up feature is to reach users who left.

---

## The SSR hydration bug that was fixed

`useState` initializers in Next.js client components run on the server during SSR. Node.js has no `Notification` API, so `typeof Notification === 'undefined'` is true. The original code initialized permission state directly from `Notification.permission`, which resolved to `'unsupported'` on the server. React hydrated the client with that value, so the bell icon appeared disabled on every browser including Chrome and Firefox.

Fix applied in `hooks/usePushNotifications.ts`:

```ts
// Always start at 'default' - safe neutral value server and client agree on
const [permission, setPermission] = useState<NotifPermission>('default');

useEffect(() => {
  // setTimeout(fn, 0) defers detection until after hydration
  // also satisfies the react-hooks/set-state-in-effect lint rule
  const t = setTimeout(() => {
    if (typeof Notification === 'undefined') { setPermission('unsupported'); return; }
    setPermission(Notification.permission as NotifPermission);
  }, 0);
  return () => clearTimeout(t);
}, []);
```

---

## Platform support

| Platform | Works? | Reason |
|---|---|---|
| Chrome / Edge / Firefox (desktop) | Yes | Full Web Push API support |
| Android Chrome | Yes | Works even with browser backgrounded |
| macOS Safari 16.1+ | Yes | Apple shipped Web Push in Safari 16.1 (2022) |
| iOS PWA (Add to Home Screen, iOS 16.4+) | Yes | Apple enabled Web Push for installed PWAs in iOS 16.4 |
| iOS Safari (browser tab) | No | Apple restricts Web Push to installed PWAs only - platform decision, not fixable |
| Chrome on iOS | No | Apple requires all iOS browsers to use WebKit - inherits the same restriction |

For iOS browser users the app shows a dismissible banner directing them to "Tap Share then Add to Home Screen". Once installed as a PWA, push works identically to Android.

---

## Setup (for local dev or new deployment)

Generate VAPID keys once per deployment:

```bash
npx web-push generate-vapid-keys
```

Set as environment variables:

```
NEXT_PUBLIC_VAPID_PUBLIC_KEY=<public key>
VAPID_PRIVATE_KEY=<private key>
VAPID_EMAIL=support@yourapp.com
CRON_SECRET=<random string to protect the cron endpoint>
```

Apply the DB migration:

```bash
psql $DATABASE_URL -f drizzle/0003_push_notifications.sql
```

The Vercel Cron in `vercel.json` runs every minute. Sub-hourly cron requires Vercel Pro. On Hobby, use an external cron service (cron-job.org is free) pointing at `GET /api/push/followup` with `Authorization: Bearer <CRON_SECRET>`.
