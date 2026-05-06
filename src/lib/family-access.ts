import type { getServiceClient } from '@/lib/supabase';

type DbClient = ReturnType<typeof getServiceClient>;

export interface FamilyProfile {
  id: string;
  name: string;
  family_name: string | null;
  role: string | null;
  custom_role_label: string | null;
  child_name: string | null;
  child_dob: string | null;
}

export interface FamilyAccess {
  familyId: string;
  viewerUserId: string;
  familyMemberId: string | null;
  familyRole: string | null;
  appPermissionRole: 'owner' | 'admin' | 'contributor' | 'recipient';
  isOwner: boolean;
  canInvite: boolean;
  familyProfile: FamilyProfile;
  viewerProfile: FamilyProfile;
}

interface LinkedFamilyMember {
  id: string;
  user_id: string;
  name: string;
  role: string | null;
  app_permission_role: 'owner' | 'admin' | 'contributor' | 'recipient' | null;
  status: string | null;
}

const PROFILE_SELECT = 'id, name, family_name, role, custom_role_label, child_name, child_dob';

function canInvite(permissionRole: FamilyAccess['appPermissionRole']) {
  return permissionRole === 'owner' || permissionRole === 'admin';
}

/** Contributors and above may create breadcrumbs, foundation answers, and parent writing prompts. */
export function canWriteFamilyContent(access: FamilyAccess): boolean {
  return access.appPermissionRole !== 'recipient';
}

export async function resolveFamilyAccess(
  db: DbClient,
  authUserId: string
): Promise<FamilyAccess | null> {
  const { data: viewerProfile } = await db
    .from('users')
    .select(PROFILE_SELECT)
    .eq('auth_user_id', authUserId)
    .maybeSingle();

  if (!viewerProfile) return null;

  const typedViewer = viewerProfile as FamilyProfile;

  const { data: linkedMember } = await db
    .from('family_members')
    .select('id, user_id, name, role, app_permission_role, status')
    .eq('linked_user_id', typedViewer.id)
    .eq('status', 'active')
    .maybeSingle();

  if (linkedMember) {
    const member = linkedMember as LinkedFamilyMember;
    const permissionRole = member.app_permission_role ?? 'contributor';

    const { data: familyProfile } = await db
      .from('users')
      .select(PROFILE_SELECT)
      .eq('id', member.user_id)
      .single();

    if (!familyProfile) return null;

    return {
      familyId:          member.user_id,
      viewerUserId:      typedViewer.id,
      familyMemberId:    member.id,
      familyRole:        member.role,
      appPermissionRole: permissionRole,
      isOwner:           false,
      canInvite:         canInvite(permissionRole),
      familyProfile:     familyProfile as FamilyProfile,
      viewerProfile:     typedViewer,
    };
  }

  return {
    familyId:          typedViewer.id,
    viewerUserId:      typedViewer.id,
    familyMemberId:    null,
    familyRole:        typedViewer.role,
    appPermissionRole: 'owner',
    isOwner:           true,
    canInvite:         true,
    familyProfile:     typedViewer,
    viewerProfile:     typedViewer,
  };
}
