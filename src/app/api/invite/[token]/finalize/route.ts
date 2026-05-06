import { NextRequest, NextResponse } from 'next/server';
import { getSessionClient, getServiceClient } from '@/lib/supabase';
import { logger } from '@/lib/logger';
import { assertEnv } from '@/lib/env';
import { hashInviteToken } from '@/lib/invite-token';

export async function POST(
  _request: NextRequest,
  context: { params: Promise<{ token: string }> }
) {
  assertEnv();

  const { token } = await context.params;

  const supabase = await getSessionClient();
  const { data: { session } } = await supabase.auth.getSession();

  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const db = getServiceClient();

  const { data: invite } = await db
    .from('family_invitations')
    .select('id, status, expires_at, invited_email, family_member_id, family_identity_role, family_id')
    .eq('invite_token', hashInviteToken(token))
    .single();

  if (!invite) {
    return NextResponse.json({ error: 'Invite not found' }, { status: 404 });
  }

  if (invite.status !== 'pending') {
    return NextResponse.json(
      { error: 'This invitation is no longer valid.', status: invite.status },
      { status: 410 }
    );
  }

  if (new Date(invite.expires_at as string) < new Date()) {
    return NextResponse.json({ error: 'This invitation has expired.' }, { status: 410 });
  }

  // Enforce strict email match — invitations are not transferable
  const sessionEmail = (session.user.email ?? '').toLowerCase();
  if (sessionEmail !== (invite.invited_email as string).toLowerCase()) {
    return NextResponse.json(
      { error: 'The email address on your account does not match this invitation.' },
      { status: 403 }
    );
  }

  // Fetch the family_member record this invite is for
  const { data: familyMember } = await db
    .from('family_members')
    .select('id, name, status, linked_user_id')
    .eq('id', invite.family_member_id as string)
    .single();

  if (!familyMember) {
    return NextResponse.json({ error: 'Family member record not found' }, { status: 404 });
  }

  // Prevent double-acceptance: if already linked, return success idempotently
  if (familyMember.linked_user_id) {
    return NextResponse.json({ success: true, alreadyAccepted: true });
  }

  // Get or create the public.users record for the invitee
  const { data: existingUser } = await db
    .from('users')
    .select('id')
    .eq('auth_user_id', session.user.id)
    .maybeSingle();

  let userId: string;

  if (existingUser) {
    userId = existingUser.id as string;
  } else {
    const { data: newUser, error: userError } = await db
      .from('users')
      .insert({
        auth_user_id: session.user.id,
        name:         familyMember.name,
        role:         invite.family_identity_role,
      })
      .select('id')
      .single();

    if (userError || !newUser) {
      logger.error('invite finalize: user profile creation failed', {
        route: 'invite/[token]/finalize',
        code:  userError?.code,
      });
      return NextResponse.json({ error: 'Failed to create user profile' }, { status: 500 });
    }

    userId = newUser.id as string;
  }

  // Link the invitee's account to their family_member record
  const { error: memberError } = await db
    .from('family_members')
    .update({ linked_user_id: userId, status: 'active' })
    .eq('id', familyMember.id);

  if (memberError) {
    logger.error('invite finalize: family_member update failed', {
      route: 'invite/[token]/finalize',
      code:  memberError.code,
    });
    return NextResponse.json({ error: 'Failed to link account to family' }, { status: 500 });
  }

  // Mark the invitation accepted
  const { error: inviteError } = await db
    .from('family_invitations')
    .update({
      status:      'accepted',
      accepted_at: new Date().toISOString(),
      updated_at:  new Date().toISOString(),
    })
    .eq('id', invite.id);

  if (inviteError) {
    // Non-fatal: member is already linked. Log and continue.
    logger.warn('invite finalize: failed to mark invitation accepted', {
      route:    'invite/[token]/finalize',
      inviteId: invite.id,
      code:     inviteError.code,
    });
  }

  logger.info('invite accepted', {
    route:    'invite/[token]/finalize',
    inviteId: invite.id,
    userId,
    familyId: invite.family_id,
  });

  return NextResponse.json({ success: true });
}
