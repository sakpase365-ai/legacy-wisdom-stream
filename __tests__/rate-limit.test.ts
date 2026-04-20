import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { checkRateLimit, pruneExpired } from '../src/lib/rate-limit';

// Suppress the probabilistic pruning during tests by controlling Math.random
beforeEach(() => {
  vi.spyOn(Math, 'random').mockReturnValue(0.5); // never triggers 5% prune
});

afterEach(() => {
  vi.restoreAllMocks();
  pruneExpired(); // clean up between tests
});

describe('checkRateLimit', () => {
  it('allows the first request', () => {
    const result = checkRateLimit('test-key-1', 5, 60_000);
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(4);
  });

  it('allows requests within the limit', () => {
    const key = 'test-key-2';
    for (let i = 0; i < 5; i++) {
      const r = checkRateLimit(key, 5, 60_000);
      expect(r.allowed).toBe(true);
    }
  });

  it('denies the request that exceeds the limit', () => {
    const key = 'test-key-3';
    for (let i = 0; i < 5; i++) checkRateLimit(key, 5, 60_000);
    const overLimit = checkRateLimit(key, 5, 60_000);
    expect(overLimit.allowed).toBe(false);
    expect(overLimit.remaining).toBe(0);
  });

  it('resets after the window expires', () => {
    vi.useFakeTimers();
    const key = 'test-key-4';

    // Exhaust the limit
    for (let i = 0; i < 3; i++) checkRateLimit(key, 3, 1_000);
    expect(checkRateLimit(key, 3, 1_000).allowed).toBe(false);

    // Advance past the window
    vi.advanceTimersByTime(1_001);
    const after = checkRateLimit(key, 3, 1_000);
    expect(after.allowed).toBe(true);
    expect(after.remaining).toBe(2);

    vi.useRealTimers();
  });

  it('tracks different keys independently', () => {
    // Exhaust key A
    for (let i = 0; i < 2; i++) checkRateLimit('key-A', 2, 60_000);
    expect(checkRateLimit('key-A', 2, 60_000).allowed).toBe(false);

    // Key B should be unaffected
    expect(checkRateLimit('key-B', 2, 60_000).allowed).toBe(true);
  });

  it('returns correct resetAt timestamp', () => {
    vi.useFakeTimers();
    const now = Date.now();
    const windowMs = 3_600_000;
    const result = checkRateLimit('test-key-5', 10, windowMs);
    expect(result.resetAt).toBeGreaterThanOrEqual(now + windowMs - 10);
    expect(result.resetAt).toBeLessThanOrEqual(now + windowMs + 10);
    vi.useRealTimers();
  });
});
