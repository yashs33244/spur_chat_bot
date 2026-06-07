interface RateLimitEntry {
  count: number;
  windowStart: number;
}

const store = new Map<string, RateLimitEntry>();
const WINDOW_MS = 60_000;

export function checkRateLimit(
  ip: string,
  limitPerMinute = 20
): { allowed: boolean; remaining: number; resetAt: number } {
  const now = Date.now();
  const entry = store.get(ip);

  if (!entry || now - entry.windowStart > WINDOW_MS) {
    store.set(ip, { count: 1, windowStart: now });
    return { allowed: true, remaining: limitPerMinute - 1, resetAt: now + WINDOW_MS };
  }

  if (entry.count >= limitPerMinute) {
    return { allowed: false, remaining: 0, resetAt: entry.windowStart + WINDOW_MS };
  }

  entry.count++;
  return {
    allowed: true,
    remaining: limitPerMinute - entry.count,
    resetAt: entry.windowStart + WINDOW_MS,
  };
}

setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of store.entries()) {
    if (now - entry.windowStart > WINDOW_MS * 2) store.delete(key);
  }
}, WINDOW_MS);
