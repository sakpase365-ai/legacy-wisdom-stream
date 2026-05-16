import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/env',      () => ({ assertEnv: vi.fn() }));
vi.mock('@/lib/supabase', () => ({
  getSessionClient: vi.fn(),
  getServiceClient: vi.fn(),
}));

import { GET } from '../src/app/api/entries/route';
import { getSessionClient, getServiceClient } from '@/lib/supabase';

const MOCK_SESSION  = { user: { id: 'uid-abc' } };
const MOCK_PROFILE  = {
  id:                'pid-xyz',
  name:              'Alice',
  family_name:       null,
  role:              'father',
  custom_role_label: null,
  child_name:        null,
  child_dob:         null,
};
const MOCK_ENTRIES = [
  {
    id:            'entry-1',
    summary:       'A lesson about patience.',
    content:       'Full letter text here, not truncated.',
    domain:        'resilience',
    relevant_age:  16,
    delivery_type: 'age-locked',
    created_at:    '2026-04-01T10:00:00Z',
    delivered_at:  null,
  },
];

function makeSession(session: unknown) {
  return { auth: { getSession: vi.fn().mockResolvedValue({ data: { session } }) } };
}

beforeEach(() => { vi.clearAllMocks(); });

describe('GET /api/entries', () => {
  it('returns 401 for unauthenticated requests', async () => {
    vi.mocked(getSessionClient).mockResolvedValue(makeSession(null) as never);

    const res = await GET();
    expect(res.status).toBe(401);
  });

  it('returns entries including the content field', async () => {
    vi.mocked(getSessionClient).mockResolvedValue(makeSession(MOCK_SESSION) as never);
    vi.mocked(getServiceClient).mockReturnValue({
      from: vi.fn((table: string) => {
        if (table === 'users') {
          return {
            select:      vi.fn().mockReturnThis(),
            eq:          vi.fn().mockReturnThis(),
            maybeSingle: vi.fn().mockResolvedValue({ data: MOCK_PROFILE, error: null }),
          };
        }
        if (table === 'family_members') {
          return {
            select:      vi.fn().mockReturnThis(),
            eq:          vi.fn().mockReturnThis(),
            maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
          };
        }
        return {
          select: vi.fn().mockReturnThis(),
          eq:     vi.fn().mockReturnThis(),
          order:  vi.fn().mockResolvedValue({ data: MOCK_ENTRIES, error: null }),
        };
      }),
    } as never);

    const res = await GET();
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.entries).toHaveLength(1);

    const entry = body.entries[0];
    expect(entry).toHaveProperty('content');
    expect(entry.content).toBe('Full letter text here, not truncated.');
    expect(entry).toHaveProperty('summary');
    expect(entry).toHaveProperty('domain');
    expect(entry).toHaveProperty('delivery_type');
    expect(entry.content_type).toBe('text');
    expect(entry.media_url).toBeNull();
  });

  it('returns 404 when profile is not found', async () => {
    vi.mocked(getSessionClient).mockResolvedValue(makeSession(MOCK_SESSION) as never);
    vi.mocked(getServiceClient).mockReturnValue({
      from: vi.fn(() => ({
        select:      vi.fn().mockReturnThis(),
        eq:          vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
      })),
    } as never);

    const res = await GET();
    expect(res.status).toBe(404);
  });

  it('returns empty entries array when user has no letters', async () => {
    vi.mocked(getSessionClient).mockResolvedValue(makeSession(MOCK_SESSION) as never);
    vi.mocked(getServiceClient).mockReturnValue({
      from: vi.fn((table: string) => {
        if (table === 'users') {
          return {
            select:      vi.fn().mockReturnThis(),
            eq:          vi.fn().mockReturnThis(),
            maybeSingle: vi.fn().mockResolvedValue({ data: MOCK_PROFILE, error: null }),
          };
        }
        if (table === 'family_members') {
          return {
            select:      vi.fn().mockReturnThis(),
            eq:          vi.fn().mockReturnThis(),
            maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
          };
        }
        return {
          select: vi.fn().mockReturnThis(),
          eq:     vi.fn().mockReturnThis(),
          order:  vi.fn().mockResolvedValue({ data: [], error: null }),
        };
      }),
    } as never);

    const res = await GET();
    const body = await res.json();
    expect(body.entries).toEqual([]);
  });
});
