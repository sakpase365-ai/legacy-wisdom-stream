import { NextRequest, NextResponse } from 'next/server';
import { getSessionClient, getServiceClient } from '@/lib/supabase';
import { logger } from '@/lib/logger';
import { assertEnv } from '@/lib/env';
import { VALID_IDENTITY_ROLE_VALUES, VALID_PERMISSION_ROLE_VALUES } from '@/lib/roles';
import { resolveFamilyAccess } from '@/lib/family-access';
import { generateInviteToken } from '@/lib/invite-token';
import { sendInviteEmail } from '@/lib/email';

export async function POST(request: NextRequest) {
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
    return NextResponse.json({ error: 'Not authorized to send invitations' }, { status: 403 });
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const { fullName, email, familyIdentityRole, appPermissionRole } = body;

  if (
    typeof fullName !== 'string' || !fullName.trim() ||
    typeof email !== 'string' || !email.trim() ||
    typeof familyIdentityRole !== 'string' || !VALID_IDENTITY_ROLE_VALUES.has(familyIdentityRole) ||
    typeof appPermissionRole !== 'string' || !VALID_PERMISSION_ROLE_VALUES.has(appPermissionRole) ||
    appPermissionRole === 'owner'
  ) {
    return NextResponse.json({ error: 'Invalid fields' }, { status: 400 });
  }

  const normalizedEmail = email.trim().toLowerCase();
  const familyId = access.familyId;

  // Block duplicate pending invitations for the same email + family
  const { data: existingInvite } = await db
    .from('family_invitations')
    .select('id')
    .eq('family_id', familyId)
    .eq('invited_email', normalizedEmail)
    .eq('status', 'pending')
    .maybeSingle();

  if (existingInvite) {
    return NextResponse.json(
      { error: 'An active invitation already exists for this email address.' },
      { status: 409 }
    );
  }

  // Create the family_member record in invited state
  const { data: familyMember, error: memberError } = await db
    .from('family_members')
    .insert({
      user_id:             familyId,
      family_id:           familyId,
      name:                fullName.trim(),
      role:                familyIdentityRole,
      app_permission_role: appPermissionRole,
      status:              'invited',
    })
    .select('id')
    .single();

  if (memberError || !familyMember) {
    logger.error('invite: family_member insert failed', {
      route: 'invite POST',
      code:  memberError?.code,
      msg:   memberError?.message,
    });
    return NextResponse.json({ error: 'Failed to create family member record' }, { status: 500 });
  }

  // Generate a raw token (goes in the URL) and store only its SHA-256 hash
  const { raw: rawToken, hash: tokenHash } = generateInviteToken();

  const { data: invitation, error: inviteError } = await db
    .from('family_invitations')
    .insert({
      family_id:            familyId,
      family_member_id:     familyMember.id,
      invited_email:        normalizedEmail,
      invited_by:           access.viewerUserId,
      family_identity_role: familyIdentityRole,
      app_permission_role:  appPermissionRole,
      invite_token:         tokenHash,
    })
    .select('id')
    .single();

  if (inviteError || !invitation) {
    await db.from('family_members').delete().eq('id', familyMember.id);
    logger.error('invite: invitation insert failed', {
      route: 'invite POST',
      code:  inviteError?.code,
    });
    return NextResponse.json({ error: 'Failed to create invitation' }, { status: 500 });
  }

  const origin    = request.nextUrl.origin;
  const inviteUrl = `${origin}/invite/${rawToken}`;

  const familyName =
    access.familyProfile.family_name ??
    (access.familyProfile.name ? `${access.familyProfile.name}'s Family` : 'your family');

  // Non-blocking: email failure doesn't prevent returning the invite URL
  await sendInviteEmail({
    inviteeName:        (fullName as string).trim(),
    inviteeEmail:       normalizedEmail,
    familyName,
    familyIdentityRole: familyIdentityRole as string,
    appPermissionRole:  appPermissionRole as string,
    inviteUrl,
    expiresAt:          new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
  });

  logger.info('invite created', { route: 'invite POST', familyId, email: normalizedEmail });

  return NextResponse.json({ inviteUrl, token: rawToken });
}
