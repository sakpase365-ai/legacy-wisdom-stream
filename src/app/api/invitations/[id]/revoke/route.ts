import { NextRequest, NextResponse } from 'next/server';
import { getSessionClient, getServiceClient } from '@/lib/supabase';
import { logger } from '@/lib/logger';
import { assertEnv } from '@/lib/env';
import { resolveFamilyAccess } from '@/lib/family-access';

export async function POST(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  assertEnv();

  const { id } = await context.params;

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

  // Fetch the invite; confirm it belongs to this family and is pending
  const { data: invite } = await db
    .from('family_invitations')
    .select('id, status, family_member_id, family_id')
    .eq('id', id)
    .eq('family_id', access.familyId)
    .maybeSingle();

  if (!invite) {
    return NextResponse.json({ error: 'Invitation not found' }, { status: 404 });
  }

  if (invite.status !== 'pending') {
    return NextResponse.json(
      { error: 'Only pending invitations can be revoked.' },
      { status: 409 }
    );
  }

  const { error } = await db
    .from('family_invitations')
    .update({ status: 'revoked', updated_at: new Date().toISOString() })
    .eq('id', invite.id);

  if (error) {
    logger.error('invite revoke failed', { route: 'invitations/[id]/revoke', id });
    return NextResponse.json({ error: 'Failed to revoke invitation' }, { status: 500 });
  }

  // Mark the pending family_member row removed so it doesn't appear in the family list
  if (invite.family_member_id) {
    await db
      .from('family_members')
      .update({ status: 'removed' })
      .eq('id', invite.family_member_id)
      .eq('status', 'invited');
  }

  logger.info('invite revoked', { route: 'invitations/[id]/revoke', id, familyId: access.familyId });
  return NextResponse.json({ success: true });
}
