import { NextResponse } from 'next/server';
import { getSessionClient, getServiceClient } from '@/lib/supabase';
import { logger } from '@/lib/logger';
import { assertEnv } from '@/lib/env';
import { resolveFamilyAccess } from '@/lib/family-access';

const VALID_ROLES = new Set([
  'parent', 'mother', 'father', 'child', 'son', 'daughter', 'sibling', 'brother', 'sister',
  'wife', 'husband', 'grandparent', 'grandmother', 'grandfather',
  'spouse', 'co_parent',
]);

export async function GET() {
  assertEnv();

  const supabase = await getSessionClient();
  const { data: { session } } = await supabase.auth.getSession();

  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const db = getServiceClient();

  const access = await resolveFamilyAccess(db, session.user.id);

  if (access) {
    const profile = access.familyProfile;
    let familyMembers = await fetchMembers(db, access.familyId);

    if (access.isOwner && familyMembers.length === 0) {
      const meta = session.user.user_metadata ?? {};
      const membersFromMeta = (meta.family_members ?? []) as Array<{
        name:              string;
        role:              string;
        custom_role_label: string | null;
        birth_date:        string | null;
      }>;

      const recoveryRows = membersFromMeta
        .filter((m) => m.name)
        .map((m) => ({
          user_id:           access.familyId,
          name:              m.name,
          role:              VALID_ROLES.has(m.role) ? m.role : 'child',
          custom_role_label: null as string | null,
          birth_date:        m.birth_date ?? null,
        }));

      // Legacy single-child fallback
      if (recoveryRows.length === 0 && profile.child_name) {
        recoveryRows.push({
          user_id:           access.familyId,
          name:              profile.child_name,
          role:              'child',
          custom_role_label: null,
          birth_date:        profile.child_dob ?? null,
        });
      }

      if (recoveryRows.length > 0) {
        await db.from('family_members').insert(recoveryRows);
        familyMembers = await fetchMembers(db, access.familyId);
      }
    }

    return NextResponse.json({
      profile,
      familyMembers,
      access: {
        familyId:          access.familyId,
        viewerUserId:      access.viewerUserId,
        familyMemberId:    access.familyMemberId,
        familyRole:        access.familyRole,
        appPermissionRole: access.appPermissionRole,
        isOwner:           access.isOwner,
        canInvite:         access.canInvite,
      },
    });
  }

  // ── First login: create profile from user_metadata ────────────
  const meta = session.user.user_metadata ?? {};

  // Support both new-format metadata and legacy parent_name/child_name metadata.
  const ownerName             = (meta.owner_name   ?? meta.parent_name) as string | undefined;
  const rawOwnerRole          = (meta.owner_role   ?? 'parent')         as string;
  // Sanitize role against the allowed taxonomy; fall back to 'parent' for unrecognized values.
  const ownerRole             = VALID_ROLES.has(rawOwnerRole) ? rawOwnerRole : 'parent';
  const customOwnerRole = meta.custom_owner_role                   as string | null | undefined;
  const familyName      = meta.family_name                         as string | null | undefined;
  const membersFromMeta = (meta.family_members ?? [])              as Array<{
    name:              string;
    role:              string;
    custom_role_label: string | null;
    birth_date:        string | null;
  }>;

  // Legacy single-child metadata fields
  const legacyChildName = meta.child_name as string | undefined;
  const legacyChildDob  = meta.child_dob  as string | undefined;

  if (!ownerName) {
    logger.warn('profile metadata missing owner_name, redirecting to setup', { route: 'profile GET' });
    return NextResponse.json({ error: 'Profile incomplete', needsSetup: true }, { status: 422 });
  }

  const { data: newProfile, error: insertError } = await db
    .from('users')
    .insert({
      auth_user_id:      session.user.id,
      name:              ownerName,
      role:              ownerRole,
      custom_role_label: null,
      family_name:       familyName ?? null,
    })
    .select('id, name, family_name, role, custom_role_label, child_name, child_dob')
    .single();

  if (insertError || !newProfile) {
    logger.error('profile creation failed', { route: 'profile GET', code: insertError?.code });
    return NextResponse.json({ error: 'Failed to create profile' }, { status: 500 });
  }

  // Build the family_members rows to insert
  const memberRows: Array<{
    user_id:           string;
    name:              string;
    role:              string;
    custom_role_label: string | null;
    birth_date:        string | null;
  }> = [];

  // New-format members from metadata
  for (const m of membersFromMeta) {
    if (m.name) {
      const memberRole = VALID_ROLES.has(m.role) ? m.role : 'child';
      memberRows.push({
        user_id:           newProfile.id,
        name:              m.name,
        role:              memberRole,
        custom_role_label: null,
        birth_date:        m.birth_date ?? null,
      });
    }
  }

  // Legacy single-child fallback: if no members from metadata, use child_name/child_dob
  if (memberRows.length === 0 && legacyChildName) {
    memberRows.push({
      user_id:           newProfile.id,
      name:              legacyChildName,
      role:              'child',
      custom_role_label: null,
      birth_date:        legacyChildDob ?? null,
    });
  }

  let familyMembers: unknown[] = [];

  if (memberRows.length > 0) {
    const { data: inserted } = await db
      .from('family_members')
      .insert(memberRows)
      .select('id, name, role, custom_role_label, birth_date');
    familyMembers = inserted ?? [];
  }

  logger.info('profile created on first login', { route: 'profile GET' });
  return NextResponse.json({ profile: newProfile, familyMembers });
}

async function fetchMembers(
  db: ReturnType<typeof import('@/lib/supabase').getServiceClient>,
  userId: string
) {
  const { data } = await db
    .from('family_members')
    .select('id, name, role, custom_role_label, birth_date, linked_user_id, app_permission_role, status')
    .eq('user_id', userId)
    .order('created_at', { ascending: true });
  return (data ?? []).filter((member: { status?: string | null }) => member.status !== 'removed');
}
