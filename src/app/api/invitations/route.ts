import { NextResponse } from 'next/server';
import { getSessionClient, getServiceClient } from '@/lib/supabase';
import { logger } from '@/lib/logger';
import { assertEnv } from '@/lib/env';
import { resolveFamilyAccess } from '@/lib/family-access';

export async function GET() {
  assertEnv();

  const supabase = await getSessionClient();
  const { data: { session } } = await supabase.auth.getSession();

  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const db = getServiceClient();

  const access = await resolveFamilyAccess(db, session.user.id);
  if (!access) {
    return NextResponse.json({ error: 'Profile not found' }, { status: 403 });
  }
  if (!access.canInvite) {
    return NextResponse.json({ error: 'Not authorized' }, { status: 403 });
  }

  const { data, error } = await db
    .from('family_invitations')
    .select(`
      id,
      invited_email,
      family_identity_role,
      app_permission_role,
      status,
      correction_note,
      expires_at,
      accepted_at,
      created_at,
      member:family_member_id (name)
    `)
    .eq('family_id', access.familyId)
    .order('created_at', { ascending: false });

  if (error) {
    logger.error('failed to fetch invitations', {
      route:    'invitations GET',
      familyId: access.familyId,
      code:     error.code,
    });
    return NextResponse.json({ error: 'Failed to fetch invitations' }, { status: 500 });
  }

  const invitations = (data ?? []).map((row) => {
    const memberRaw = row.member as { name: string } | { name: string }[] | null;
    const name = Array.isArray(memberRaw)
      ? (memberRaw[0]?.name ?? null)
      : (memberRaw?.name ?? null);

    return {
      id:                  row.id,
      name,
      invited_email:       row.invited_email,
      family_identity_role: row.family_identity_role,
      app_permission_role:  row.app_permission_role,
      status:              row.status,
      correction_note:     row.correction_note ?? null,
      expires_at:          row.expires_at,
      accepted_at:         row.accepted_at ?? null,
      created_at:          row.created_at,
    };
  });

  return NextResponse.json({ invitations });
}
