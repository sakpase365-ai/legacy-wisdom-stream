import { NextRequest, NextResponse } from 'next/server';
import { getServiceClient } from '@/lib/supabase';
import { logger } from '@/lib/logger';
import { hashInviteToken } from '@/lib/invite-token';

export async function POST(
  _request: NextRequest,
  context: { params: Promise<{ token: string }> }
) {
  const { token } = await context.params;
  const db = getServiceClient();

  const { data: invite } = await db
    .from('family_invitations')
    .select('id, status, expires_at, family_member_id')
    .eq('invite_token', hashInviteToken(token))
    .single();

  if (!invite) {
    return NextResponse.json({ error: 'Invite not found' }, { status: 404 });
  }

  if (invite.status !== 'pending') {
    return NextResponse.json({ error: 'This invitation is no longer valid.' }, { status: 410 });
  }

  if (new Date(invite.expires_at as string) < new Date()) {
    return NextResponse.json({ error: 'This invitation has expired.' }, { status: 410 });
  }

  const { error } = await db
    .from('family_invitations')
    .update({ status: 'declined', updated_at: new Date().toISOString() })
    .eq('id', invite.id);

  if (error) {
    logger.error('invite decline failed', { route: 'invite/[token]/decline', inviteId: invite.id });
    return NextResponse.json({ error: 'Failed to decline invite' }, { status: 500 });
  }

  // Mark the pending family_member row as removed so it does not appear in the family list
  if (invite.family_member_id) {
    await db
      .from('family_members')
      .update({ status: 'removed' })
      .eq('id', invite.family_member_id);
  }

  return NextResponse.json({ success: true });
}
