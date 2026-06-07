# Web Push Notifications - Implementation Deep Dive

## What was built

A full server-side Web Push stack using VAPID authentication - the same mechanism Slack, Gmail, and WhatsApp Web use. Notifications reach the user's OS even after the browser tab is closed.

**Feature:** after the AI replies to a message, a 5-minute timer starts on the server. If the user goes quiet (closes the tab, switches apps), the server fires an OS-level push: "Did we resolve your issue? We are here if you need more help." If the user sends another message before the timer expires, the follow-up is cancelled.

---

## VAPID, Web Push Protocol, and the Headers in Depth

### What is VAPID?

VAPID stands for **Voluntary Application Server Identification**. It is a protocol on top of the Web Push specification (RFC 8292) that lets your server cryptographically sign every push request it sends to FCM (Google) or APNs (Apple).

Without VAPID, FCM and APNs would have no way to verify that the push request actually came from your server - anyone who obtained a user's push endpoint URL could spam them. VAPID solves this.

### The key pair

VAPID uses an **EC (Elliptic Curve) key pair on the P-256 curve**:

- **Private key** - stored as a secret on your server. Never exposed. Signs every outgoing push request.
- **Public key** - given to the browser during `pushManager.subscribe()`. FCM/APNs use it to verify the server's signature. Safe to expose in frontend code.

Generate once:
```bash
npx web-push generate-vapid-keys
```

### How the browser uses the public key

When `pushManager.subscribe()` is called, the browser sends the VAPID public key (`applicationServerKey`) to FCM/APNs as part of the subscription request. FCM/APNs store it alongside the subscription endpoint.

From that point on, whenever a push arrives at that endpoint, FCM/APNs verify it was signed with the matching private key. If the signature does not match, the push is rejected before the device even sees it.

### The Authorization header on server push requests

Every time the server calls `webpush.sendNotification()`, the `web-push` npm package builds a signed HTTP POST to the subscription endpoint. The request has:

```
POST https://fcm.googleapis.com/fcm/send/... HTTP/1.1
Authorization: vapid t=<JWT>,k=<public key base64url>
Content-Type: application/octet-stream
Content-Encoding: aes128gcm
TTL: 86400
```

Breaking down the `Authorization` header:

- `vapid` - the scheme name, tells the push server this is a VAPID-signed request
- `t=<JWT>` - a signed JSON Web Token. The JWT payload contains:
  - `aud`: the push service origin (e.g. `https://fcm.googleapis.com`)
  - `exp`: expiry timestamp (usually 24 hours from now)
  - `sub`: a `mailto:` contact URI (`VAPID_EMAIL`) so push services can contact you if something is wrong
  The JWT is signed with the VAPID private key using ES256 (ECDSA + SHA-256)
- `k=<public key>` - the VAPID public key in base64url format, so the push server knows which key to verify against

### Payload encryption (RFC 8291)

The notification body is not sent in plaintext. It is encrypted end-to-end using the browser's own `p256dh` public key and the `auth` secret from the `PushSubscription`:

```
p256dh  - the browser's EC public key (Diffie-Hellman)
auth    - a 16-byte random secret
```

The server (via `web-push`) performs ECDH key agreement using `p256dh` to derive a shared secret, then uses `auth` as additional keying material, and encrypts the payload with AES-128-GCM. Only the browser that generated that key pair can decrypt it. Even FCM and APNs cannot read the notification body in transit.

The `Content-Encoding: aes128gcm` header tells the push service which encryption scheme was used.

### TTL header

`TTL: 86400` means the push service should hold the notification for up to 24 hours if the device is offline and deliver it when it reconnects. Setting TTL to 0 means discard if not immediately deliverable.

---

## Database changes

### New table: `push_subscriptions`

Stores one row per session. When a user grants notification permission, the browser creates a `PushSubscription` object. We store the three values we need to send pushes to that browser later:

**Schema** (`lib/db/schema.ts`):
```ts
export const pushSubscriptions = pgTable('push_subscriptions', {
  id:        uuid('id').primaryKey().defaultRandom().notNull(),
  sessionId: uuid('session_id').notNull().unique(),
  endpoint:  text('endpoint').notNull(),   // FCM or APNs URL for this browser
  p256dh:    text('p256dh').notNull(),     // browser's public key for payload encryption
  auth:      text('auth').notNull(),       // 16-byte secret for encryption
  createdAt: timestamp('created_at').defaultNow().notNull(),
});
```

The `sessionId` column has a `UNIQUE` constraint so one session can only have one active subscription (upsert pattern - if the user re-grants permission it just updates the endpoint).

### Modified table: `conversations`

Two columns added to track the follow-up state:

```ts
// in the conversations table definition
followupScheduledAt: timestamp('followup_scheduled_at'),       // nullable - when to fire the follow-up
followupSent:        boolean('followup_sent').default(false).notNull(),
```

- `followup_scheduled_at` - set to `NOW() + 5 minutes` after every AI reply. Null means no follow-up is pending.
- `followup_sent` - flipped to `true` after the push is sent, or if the user replies first (cancels it). Prevents duplicate sends.

### Migration: `drizzle/0003_push_notifications.sql`

```sql
-- Follow-up scheduling on conversations
ALTER TABLE "conversations"
  ADD COLUMN IF NOT EXISTS "followup_scheduled_at" TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS "followup_sent" BOOLEAN NOT NULL DEFAULT FALSE;

-- Push subscriptions (one per session/device)
CREATE TABLE IF NOT EXISTS "push_subscriptions" (
  "id"         UUID PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "session_id" UUID NOT NULL UNIQUE,
  "endpoint"   TEXT NOT NULL,
  "p256dh"     TEXT NOT NULL,
  "auth"       TEXT NOT NULL,
  "created_at" TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Index for subscription lookups by session
CREATE INDEX IF NOT EXISTS "push_subscriptions_session_id_idx"
  ON "push_subscriptions" ("session_id");

-- Partial index for the cron query - only rows that are pending and due
-- This is the exact query the cron runs every minute; a full-table scan would be wasteful
CREATE INDEX IF NOT EXISTS "conversations_followup_idx"
  ON "conversations" ("followup_scheduled_at")
  WHERE "followup_sent" = FALSE AND "followup_scheduled_at" IS NOT NULL;
```

The partial index on `conversations` is important. The cron runs every minute and queries `WHERE followup_scheduled_at <= NOW() AND followup_sent = FALSE`. Without the index this scans every row in conversations. With the partial index it only touches the small subset that has a pending follow-up.

---

## Code changes

### `public/sw.js` (new)

The service worker is the bridge between the push server and the OS notification system. It runs in a background thread, separate from the page.

```js
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(clients.claim()));

self.addEventListener('push', (event) => {
  const data = event.data?.json() ?? {};
  event.waitUntil(
    self.registration.showNotification(data.title ?? 'Spur Support', {
      body: data.body ?? 'New message from Spur Support',
      icon: '/icon-192.png',
      badge: '/icon-72.png',
      data: { url: data.url ?? '/' },
      tag: 'spur-chat',   // same tag replaces existing notification rather than stacking
      renotify: true,
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data?.url ?? '/';
  event.waitUntil(
    clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        for (const client of clientList) {
          if (client.url.includes(self.location.origin) && 'focus' in client) {
            return client.focus();  // bring existing tab to front
          }
        }
        return clients.openWindow(url);  // no open tab - open a new one
      })
  );
});
```

`skipWaiting()` + `clients.claim()` ensures a newly installed service worker takes over immediately without waiting for existing tabs to close. Without this, a user who has never visited before would not get the service worker activated until they refresh.

### `public/manifest.json` (new)

Enables "Add to Home Screen" on Android and iOS, which is required for Web Push to work on iOS:

```json
{
  "name": "Spur Support",
  "short_name": "Spur",
  "display": "standalone",
  "start_url": "/",
  "theme_color": "#0284c7",
  "background_color": "#080c14",
  "icons": [{ "src": "/icon-192.png", "sizes": "192x192", "type": "image/png" },
            { "src": "/icon-512.png", "sizes": "512x512", "type": "image/png" }]
}
```

### `app/layout.tsx` (modified)

Two additions:

**1. Register the service worker** - runs after the page is interactive (not during SSR):
```tsx
<Script id="register-sw" strategy="afterInteractive">
  {`if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  }`}
</Script>
```

**2. PWA metadata** for iOS:
```ts
export const metadata = {
  manifest: '/manifest.json',
  appleWebApp: { capable: true, statusBarStyle: 'black-translucent' },
};
export const viewport = {
  themeColor: '#0284c7',
  viewportFit: 'cover',
};
```

### `hooks/usePushNotifications.ts` (new)

The client-side hook that manages the full permission + subscription lifecycle.

**Permission state with SSR fix:**
```ts
// Start at 'default' - the same value on server and client
// Never read Notification.permission during render (server has no Notification API)
const [permission, setPermission] = useState<NotifPermission>('default');

useEffect(() => {
  const t = setTimeout(() => {
    if (typeof Notification === 'undefined') { setPermission('unsupported'); return; }
    setPermission(Notification.permission as NotifPermission);
  }, 0);
  // Poll every 4 seconds to catch changes (user can change in browser settings)
  const id = setInterval(() => {
    if (typeof Notification === 'undefined') return;
    const current = Notification.permission as NotifPermission;
    setPermission((prev) => (prev === current ? prev : current));
  }, 4000);
  return () => { clearTimeout(t); clearInterval(id); };
}, []);
```

**Requesting permission and creating the VAPID subscription:**
```ts
async function requestPermission(sessionId?: string) {
  const result = await Notification.requestPermission();
  setPermission(result as NotifPermission);
  if (result === 'granted' && sessionId) {
    await registerServerSubscription(sessionId);
    // Fire a test notification immediately so the user sees the system works
    fireNotification('Notifications enabled', 'You will be notified when we reply.');
  }
}

async function registerServerSubscription(sessionId: string) {
  const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  if (!vapidKey || !('serviceWorker' in navigator)) return;
  const reg = await navigator.serviceWorker.ready;
  const existing = await reg.pushManager.getSubscription();
  const sub = existing ?? await reg.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(vapidKey).buffer as ArrayBuffer,
  });
  const json = sub.toJSON();
  await fetch('/api/push/subscribe', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      sessionId,
      endpoint: json.endpoint,
      p256dh: json.keys!.p256dh,
      auth: json.keys!.auth,
    }),
  });
}
```

`urlBase64ToUint8Array` converts the base64url VAPID public key string to an `ArrayBuffer` - the exact format the browser's `pushManager.subscribe()` expects.

### `app/api/push/subscribe/route.ts` (new)

Receives and stores the PushSubscription. Validates with Zod before touching the DB:

```ts
const bodySchema = z.object({
  sessionId: z.string().uuid(),
  endpoint:  z.string().url(),
  p256dh:    z.string().min(1),
  auth:      z.string().min(1),
});

export async function POST(req: NextRequest) {
  const parsed = bodySchema.safeParse(await req.json());
  if (!parsed.success) return Response.json({ error: 'Invalid' }, { status: 400 });
  const { sessionId, endpoint, p256dh, auth } = parsed.data;
  await upsertPushSubscription(sessionId, endpoint, p256dh, auth);
  return Response.json({ ok: true });
}
```

Also exposes a `DELETE ?sessionId=...` for unsubscribing.

### `lib/repositories/push-subscription.repo.ts` (new)

All DB operations for push in one file:

```ts
// Store or update subscription for a session
export async function upsertPushSubscription(sessionId, endpoint, p256dh, auth) {
  const db = getDb();
  await db.insert(schema.pushSubscriptions)
    .values({ sessionId, endpoint, p256dh, auth })
    .onConflictDoUpdate({
      target: schema.pushSubscriptions.sessionId,
      set: { endpoint, p256dh, auth },
    });
}

// Called in onFinish after every AI reply
export async function scheduleFollowUp(sessionId: string) {
  const db = getDb();
  const followupAt = new Date(Date.now() + 5 * 60 * 1000);  // NOW + 5 min
  await db.update(schema.conversations)
    .set({ followupScheduledAt: followupAt, followupSent: false })
    .where(eq(schema.conversations.id, sessionId));
}

// Called when user sends a new message - cancels pending follow-up
export async function cancelFollowUp(sessionId: string) {
  const db = getDb();
  await db.update(schema.conversations)
    .set({ followupScheduledAt: null, followupSent: true })
    .where(eq(schema.conversations.id, sessionId));
}

// Called by cron every minute - finds all due follow-ups with subscriptions
export async function getPendingFollowUps() {
  const db = getDb();
  return db.select({
      sessionId: schema.conversations.id,
      endpoint:  schema.pushSubscriptions.endpoint,
      p256dh:    schema.pushSubscriptions.p256dh,
      auth:      schema.pushSubscriptions.auth,
    })
    .from(schema.conversations)
    .innerJoin(
      schema.pushSubscriptions,
      eq(schema.pushSubscriptions.sessionId, schema.conversations.id)
    )
    .where(and(
      isNotNull(schema.conversations.followupScheduledAt),
      lte(schema.conversations.followupScheduledAt, new Date()),
      eq(schema.conversations.followupSent, false)
    ))
    .limit(50);
}
```

### `app/api/push/followup/route.ts` (new)

The cron handler. Called by Vercel every minute:

```ts
export async function GET(req: NextRequest) {
  // Vercel Cron sets Authorization: Bearer <CRON_SECRET> automatically
  const authHeader = req.headers.get('authorization');
  if (CRON_SECRET && authHeader !== `Bearer ${CRON_SECRET}`) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  webpush.setVapidDetails(`mailto:${VAPID_EMAIL}`, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);

  const pending = await getPendingFollowUps();
  const results = await Promise.allSettled(
    pending.map(async (row) => {
      const payload = JSON.stringify({
        title: 'Spur Support - Quick Check',
        body:  'Did we resolve your issue? We are here if you need more help.',
        url:   `/${row.sessionId}`,
      });
      await webpush.sendNotification(
        { endpoint: row.endpoint, keys: { p256dh: row.p256dh, auth: row.auth } },
        payload
      );
      await markFollowUpSent(row.sessionId);
    })
  );

  const sent   = results.filter(r => r.status === 'fulfilled').length;
  const failed = results.filter(r => r.status === 'rejected').length;
  return Response.json({ sent, failed, total: pending.length });
}
```

`Promise.allSettled` (not `Promise.all`) is deliberate - one failed push (e.g. expired subscription) should not prevent the others from sending.

### `app/api/chat/route.ts` (modified)

Two additions around message handling:

```ts
// When user sends a new message - cancel any pending follow-up (they are active)
cancelFollowUp(sessionId).catch(() => {});

// In onFinish callback after AI reply - schedule a follow-up 5 minutes out
scheduleFollowUp(sessionId).catch(() => {});
```

Both calls are fire-and-forget (`.catch(() => {})`). A failure here is non-fatal - the chat stream has already completed successfully.

### `vercel.json` (new)

```json
{
  "crons": [{ "path": "/api/push/followup", "schedule": "* * * * *" }]
}
```

`* * * * *` = every minute. Requires Vercel Pro for sub-hourly. On Hobby, point an external cron (cron-job.org) at the same endpoint with `Authorization: Bearer <CRON_SECRET>`.

---

## End-to-end flow

```
User sends first message
  -> handleSend fires (user gesture - required by browsers for permission prompt)
  -> Notification.requestPermission() called
  -> Browser shows native "Allow notifications?" dialog
  -> User clicks Allow

Browser creates PushSubscription
  -> pushManager.subscribe({ applicationServerKey: VAPID_PUBLIC_KEY })
  -> FCM/APNs return { endpoint, keys: { p256dh, auth } }
  -> Endpoint is unique to this browser install on Google/Apple's infrastructure

App stores subscription
  -> POST /api/push/subscribe { sessionId, endpoint, p256dh, auth }
  -> Upserted into push_subscriptions table in Neon

AI replies to a message
  -> /api/chat onFinish: scheduleFollowUp(sessionId)
  -> conversations.followup_scheduled_at = NOW() + 5 minutes
  -> conversations.followup_sent = false

User replies before 5 minutes
  -> cancelFollowUp(sessionId) on next message
  -> followup_scheduled_at = NULL, followup_sent = true
  -> No notification sent

User goes quiet / closes the tab
  -> Vercel Cron fires GET /api/push/followup every minute
  -> Queries conversations JOIN push_subscriptions
     WHERE followup_scheduled_at <= NOW() AND followup_sent = false
  -> For each row:
       web-push builds signed HTTP POST to row.endpoint
       Authorization: vapid t=<JWT signed with private key>,k=<public key>
       Payload encrypted with AES-128-GCM using row.p256dh + row.auth
       POSTs to FCM (Chrome/Android) or APNs (Safari/iOS)
       markFollowUpSent(sessionId) called after successful send

Google/Apple relays to device
  -> sw.js wakes up - 'push' event fires in background thread
  -> self.registration.showNotification("Spur Support - Quick Check", ...)
  -> OS renders the notification even with browser fully closed

User taps notification
  -> notificationclick in sw.js
  -> Finds open tab matching origin -> client.focus()
  -> No open tab -> clients.openWindow("/{sessionId}")
```

---

## Why a service worker is required

JavaScript in a browser tab stops running the moment the tab closes. A service worker is a separate background script registered once per origin. It:

1. Survives tab close (as long as the browser process is running)
2. Is the only JavaScript context that can receive a `push` event from FCM/APNs
3. Can call `self.registration.showNotification()` to render an OS notification
4. Can handle `notificationclick` to bring the right tab into focus

Without a service worker, notifications can only be shown while the tab is open. The entire follow-up feature requires delivering to a user who has already left.

---

## The SSR hydration bug that was fixed

`useState` initializer functions in Next.js run on the server during SSR. Node.js has no `Notification` API. The original code read `Notification.permission` directly in the initializer, which evaluates to `'unsupported'` on the server. React hydrated the client with that server-rendered value, so the bell icon appeared permanently disabled on Chrome, Firefox, and macOS Safari - every browser.

**Fix in `hooks/usePushNotifications.ts`:**

```ts
// 'default' is a safe neutral value both server and client agree on
const [permission, setPermission] = useState<NotifPermission>('default');

useEffect(() => {
  // setTimeout(fn, 0) defers until after hydration completes
  // also satisfies react-hooks/set-state-in-effect lint rule
  const t = setTimeout(() => {
    if (typeof Notification === 'undefined') { setPermission('unsupported'); return; }
    setPermission(Notification.permission as NotifPermission);
  }, 0);
  return () => clearTimeout(t);
}, []);
```

The `setTimeout(fn, 0)` is the key. It ensures the state update runs after React has reconciled the hydrated DOM, so the server and client both start with `'default'` and the client corrects to the real value in the next event loop tick.

---

## Platform support

| Platform | Works? | Reason |
|---|---|---|
| Chrome / Edge / Firefox (desktop) | Yes | Full Web Push API + service worker support |
| Android Chrome | Yes | Works even with browser backgrounded or killed |
| macOS Safari 16.1+ | Yes | Apple shipped Web Push support in Safari 16.1 (Nov 2022) |
| iOS PWA (Add to Home Screen, iOS 16.4+) | Yes | Apple enabled Web Push for installed PWAs in iOS 16.4 (Mar 2023) |
| iOS Safari (browser tab) | No | Apple restricts Web Push to installed PWAs only - browser tabs cannot receive pushes |
| Chrome on iOS | No | Apple requires all iOS browsers to use WebKit - the same PWA restriction applies |

For iOS browser users the app shows a dismissible install banner directing them to "Tap Share then Add to Home Screen". Once installed as a PWA the experience is identical to Android.

---

## Setup

Generate VAPID keys once per deployment:

```bash
npx web-push generate-vapid-keys
```

Set as environment variables (Vercel dashboard or CLI):

```
NEXT_PUBLIC_VAPID_PUBLIC_KEY=<public key>   # safe to expose - used by browser
VAPID_PRIVATE_KEY=<private key>             # secret - signs every push
VAPID_EMAIL=support@yourapp.com             # required by VAPID spec (mailto: contact)
CRON_SECRET=<random string>                 # protects /api/push/followup from abuse
```

Apply the DB migration:

```bash
psql $DATABASE_URL -f drizzle/0003_push_notifications.sql
```

**Important:** never commit real VAPID keys to the repo. Store them only in environment variables. The `NEXT_PUBLIC_` prefix makes the public key available to browser code at build time - this is intentional and safe. The private key must never have the `NEXT_PUBLIC_` prefix.
