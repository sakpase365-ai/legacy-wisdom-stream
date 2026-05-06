import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/env', () => ({ assertEnv: vi.fn() }));
vi.mock('@/lib/supabase', () => ({
  getSessionClient: vi.fn(),
  getServiceClient: vi.fn(),
}));
vi.mock('@/lib/family-access', () => ({
  resolveFamilyAccess: vi.fn(),
}));

import { GET } from '../src/app/api/profile/route';
import { getSessionClient, getServiceClient } from '@/lib/supabase';
import { resolveFamilyAccess } from '@/lib/family-access';

const MOCK_SESSION = { user: { id: 'auth-wife', user_metadata: {} } };

const FAMILY_PROFILE = {
  id:                'family-owner-id',
  name:              'Marcus',
  family_name:       'Joseph Family',
  role:              'father',
  custom_role_label: null,
  child_name:        null,
  child_dob:         null,
};

const INVITED_ACCESS = {
  familyId:          'family-owner-id',
  viewerUserId:      'invitee-user-id',
  familyMemberId:    'member-wife-id',
  familyRole:        'mother',
  appPermissionRole: 'admin',
  isOwner:           false,
  canInvite:         true,
  familyProfile:     FAMILY_PROFILE,
  viewerProfile:     {
    id:                'invitee-user-id',
    name:              'Sarah',
    family_name:       null,
    role:              'mother',
    custom_role_label: null,
    child_name:        null,
    child_dob:         null,
  },
};

function makeSession(session: unknown) {
  return {
    auth: { getSession: vi.fn().mockResolvedValue({ data: { session } }) },
  };
}

function makeDb() {
  const familyMembersQuery = {
    select: vi.fn().mockReturnThis(),
    eq:     vi.fn().mockReturnThis(),
    order:  vi.fn().mockResolvedValue({
      data: [
        {
          id:                  'member-wife-id',
          name:                'Sarah',
          role:                'mother',
          custom_role_label:   null,
          birth_date:          null,
          status:              'active',
          linked_user_id:      'invitee-user-id',
          app_permission_role: 'admin',
        },
      ],
      error: null,
    }),
  };

  return {
    familyMembersQuery,
    db: {
      from: vi.fn((table: string) => {
        if (table === 'family_members') return familyMembersQuery;
        return {};
      }),
    },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('GET /api/profile', () => {
  it('returns 401 when unauthenticated', async () => {
    vi.mocked(getSessionClient).mockResolvedValue(makeSession(null) as never);

    const res = await GET();

    expect(res.status).toBe(401);
  });

  it('returns the resolved family environment for an invited member', async () => {
    const { db, familyMembersQuery } = makeDb();
    vi.mocked(getSessionClient).mockResolvedValue(makeSession(MOCK_SESSION) as never);
    vi.mocked(getServiceClient).mockReturnValue(db as never);
    vi.mocked(resolveFamilyAccess).mockResolvedValue(INVITED_ACCESS as never);

    const res = await GET();
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(resolveFamilyAccess).toHaveBeenCalledWith(db, 'auth-wife');
    expect(familyMembersQuery.eq).toHaveBeenCalledWith('user_id', 'family-owner-id');
    expect(body.profile.id).toBe('family-owner-id');
    expect(body.profile.family_name).toBe('Joseph Family');
    expect(body.access.familyMemberId).toBe('member-wife-id');
    expect(body.access.appPermissionRole).toBe('admin');
    expect(body.access.isOwner).toBe(false);
  });
});
