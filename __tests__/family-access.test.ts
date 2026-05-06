import { describe, it, expect, vi } from 'vitest';
import { resolveFamilyAccess, canWriteFamilyContent } from '../src/lib/family-access';

const OWNER_PROFILE = {
  id:                'family-owner-id',
  name:              'Marcus',
  family_name:       'Joseph Family',
  role:              'father',
  custom_role_label: null,
  child_name:        null,
  child_dob:         null,
};

const INVITEE_PROFILE = {
  id:                'invitee-user-id',
  name:              'Sarah',
  family_name:       null,
  role:              'mother',
  custom_role_label: null,
  child_name:        null,
  child_dob:         null,
};

const INVITEE_MEMBER = {
  id:                  'member-wife-id',
  user_id:             'family-owner-id',
  name:                'Sarah',
  role:                'mother',
  app_permission_role: 'admin',
  status:              'active',
};

function makeQuery(result: unknown) {
  return {
    select:      vi.fn().mockReturnThis(),
    eq:          vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue({ data: result, error: null }),
    single:      vi.fn().mockResolvedValue({ data: result, error: null }),
  };
}

function makeDb({
  viewerProfile,
  linkedMember = null,
  familyProfile = OWNER_PROFILE,
}: {
  viewerProfile: unknown;
  linkedMember?: unknown;
  familyProfile?: unknown;
}) {
  const userByAuthQuery = makeQuery(viewerProfile);
  const linkedMemberQuery = makeQuery(linkedMember);
  const ownerQuery = makeQuery(familyProfile);

  return {
    queries: { userByAuthQuery, linkedMemberQuery, ownerQuery },
    db: {
      from: vi.fn((table: string) => {
        if (table === 'users') {
          const queryCount = (makeDb as unknown as { userQueryCount?: number }).userQueryCount ?? 0;
          (makeDb as unknown as { userQueryCount?: number }).userQueryCount = queryCount + 1;
          return queryCount === 0 ? userByAuthQuery : ownerQuery;
        }
        if (table === 'family_members') return linkedMemberQuery;
        return {};
      }),
    },
  };
}

describe('resolveFamilyAccess', () => {
  it('returns owner access when the auth user owns the family environment', async () => {
    (makeDb as unknown as { userQueryCount?: number }).userQueryCount = 0;
    const { db } = makeDb({ viewerProfile: OWNER_PROFILE });

    const access = await resolveFamilyAccess(db as never, 'auth-owner');

    expect(access?.familyId).toBe('family-owner-id');
    expect(access?.viewerUserId).toBe('family-owner-id');
    expect(access?.familyMemberId).toBeNull();
    expect(access?.appPermissionRole).toBe('owner');
    expect(access?.isOwner).toBe(true);
    expect(access?.canInvite).toBe(true);
    expect(access?.familyProfile.name).toBe('Marcus');
  });

  it('returns invited-member access when the auth user is linked into an existing family', async () => {
    (makeDb as unknown as { userQueryCount?: number }).userQueryCount = 0;
    const { db } = makeDb({
      viewerProfile: INVITEE_PROFILE,
      linkedMember:  INVITEE_MEMBER,
      familyProfile: OWNER_PROFILE,
    });

    const access = await resolveFamilyAccess(db as never, 'auth-wife');

    expect(access?.familyId).toBe('family-owner-id');
    expect(access?.viewerUserId).toBe('invitee-user-id');
    expect(access?.familyMemberId).toBe('member-wife-id');
    expect(access?.familyRole).toBe('mother');
    expect(access?.appPermissionRole).toBe('admin');
    expect(access?.isOwner).toBe(false);
    expect(access?.canInvite).toBe(true);
    expect(access?.familyProfile.family_name).toBe('Joseph Family');
  });

  it('returns null when the auth user has no public profile yet', async () => {
    (makeDb as unknown as { userQueryCount?: number }).userQueryCount = 0;
    const { db } = makeDb({ viewerProfile: null });

    const access = await resolveFamilyAccess(db as never, 'auth-new');

    expect(access).toBeNull();
  });
});

describe('canWriteFamilyContent', () => {
  it('is false for recipient', () => {
    expect(
      canWriteFamilyContent({
        familyId:          'x',
        viewerUserId:      'y',
        familyMemberId:    null,
        familyRole:        'son',
        appPermissionRole: 'recipient',
        isOwner:           false,
        canInvite:         false,
        familyProfile:     OWNER_PROFILE,
        viewerProfile:     INVITEE_PROFILE,
      })
    ).toBe(false);
  });

  it('is true for contributor and above', () => {
    for (const appPermissionRole of ['owner', 'admin', 'contributor'] as const) {
      expect(
        canWriteFamilyContent({
          familyId:          'x',
          viewerUserId:      'y',
          familyMemberId:    null,
          familyRole:        'mother',
          appPermissionRole,
          isOwner:           appPermissionRole === 'owner',
          canInvite:         true,
          familyProfile:     OWNER_PROFILE,
          viewerProfile:     OWNER_PROFILE,
        })
      ).toBe(true);
    }
  });
});
