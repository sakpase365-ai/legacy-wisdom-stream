// In-memory sliding-window rate limiter. Alpha-grade: single-process only.
// Upgrade path: replace store with a Redis client (Upstash works on Netlify edge).

interface Window {
  count: number;
  resetAt: number;
}

const store = new Map<string, Window>();

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;
}

export function checkRateLimit(
  key: string,
  limit: number,
  windowMs: number
): RateLimitResult {
  // Probabilistic cleanup to prevent unbounded growth (5% chance per call)
  if (Math.random() < 0.05) pruneExpired();

  const now = Date.now();
  const existing = store.get(key);

  if (!existing || now >= existing.resetAt) {
    store.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, remaining: limit - 1, resetAt: now + windowMs };
  }

  existing.count += 1;
  const allowed = existing.count <= limit;
  return {
    allowed,
    remaining: Math.max(0, limit - existing.count),
    resetAt: existing.resetAt,
  };
}

export function pruneExpired() {
  const now = Date.now();
  for (const [key, w] of store) {
    if (now >= w.resetAt) store.delete(key);
  }
}
