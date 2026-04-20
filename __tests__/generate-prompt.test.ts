import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/lib/env',        () => ({ assertEnv: vi.fn() }));
vi.mock('@/lib/rate-limit', () => ({
  checkRateLimit: vi.fn(() => ({ allowed: true, remaining: 29, resetAt: Date.now() + 3_600_000 })),
}));
vi.mock('@/lib/supabase', () => ({
  getSessionClient: vi.fn(),
  getServiceClient: vi.fn(),
}));
vi.mock('@/lib/ai', () => ({
  generateDailyPrompt: vi.fn(),
  FALLBACK_PROMPTS: ['Fallback prompt alpha', 'Fallback prompt beta'],
}));

import { POST } from '../src/app/api/generate-prompt/route';
import { getSessionClient, getServiceClient } from '@/lib/supabase';
import { generateDailyPrompt, FALLBACK_PROMPTS } from '@/lib/ai';
import { checkRateLimit } from '@/lib/rate-limit';

const MOCK_SESSION = { user: { id: 'uid-abc', user_metadata: {} } };
const MOCK_PROFILE = { id: 'pid-xyz', name: 'Alice', child_name: 'Bob', child_dob: '2018-06-01' };

function makeDb() {
  return {
    from: vi.fn((table: string) => {
      if (table === 'users') {
        return {
          select: vi.fn().mockReturnThis(),
          eq:     vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({ data: MOCK_PROFILE, error: null }),
        };
      }
      // entries — recent topics
      return {
        select: vi.fn().mockReturnThis(),
        eq:     vi.fn().mockReturnThis(),
        order:  vi.fn().mockReturnThis(),
        limit:  vi.fn().mockResolvedValue({ data: [], error: null }),
      };
    }),
  };
}

function makeSession(session: unknown) {
  return {
    auth: { getSession: vi.fn().mockResolvedValue({ data: { session } }) },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  // Restore the default "allowed" state so the 429 test's mockReturnValue doesn't leak
  vi.mocked(checkRateLimit).mockReturnValue({ allowed: true, remaining: 29, resetAt: Date.now() + 3_600_000 });
});

describe('POST /api/generate-prompt', () => {
  it('returns 401 for unauthenticated requests', async () => {
    vi.mocked(getSessionClient).mockResolvedValue(makeSession(null) as never);

    const res = await POST();
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe('Unauthorized');
  });

  it('returns 429 when rate limit is exceeded', async () => {
    vi.mocked(getSessionClient).mockResolvedValue(makeSession(MOCK_SESSION) as never);
    vi.mocked(checkRateLimit).mockReturnValue({ allowed: false, remaining: 0, resetAt: Date.now() + 60_000 });

    const res = await POST();
    expect(res.status).toBe(429);
    expect(res.headers.get('Retry-After')).toBeTruthy();
  });

  it('returns AI-generated prompt on success', async () => {
    vi.mocked(getSessionClient).mockResolvedValue(makeSession(MOCK_SESSION) as never);
    vi.mocked(getServiceClient).mockReturnValue(makeDb() as never);
    vi.mocked(generateDailyPrompt).mockResolvedValue('What did you learn the hard way?');

    const res = await POST();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.prompt).toBe('What did you learn the hard way?');
  });

  it('returns a fallback prompt — not a 500 — when AI throws', async () => {
    vi.mocked(getSessionClient).mockResolvedValue(makeSession(MOCK_SESSION) as never);
    vi.mocked(getServiceClient).mockReturnValue(makeDb() as never);
    vi.mocked(generateDailyPrompt).mockRejectedValue(new Error('AI service unavailable'));

    const res = await POST();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(FALLBACK_PROMPTS).toContain(body.prompt);
  });

  it('returns 404 when profile is not found', async () => {
    vi.mocked(getSessionClient).mockResolvedValue(makeSession(MOCK_SESSION) as never);
    vi.mocked(getServiceClient).mockReturnValue({
      from: vi.fn((table: string) => {
        if (table === 'users') {
          return {
            select: vi.fn().mockReturnThis(),
            eq:     vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({ data: null, error: { code: 'PGRST116' } }),
          };
        }
        return {};
      }),
    } as never);

    const res = await POST();
    expect(res.status).toBe(404);
  });
});
