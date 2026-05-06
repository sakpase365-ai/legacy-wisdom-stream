import { NextRequest, NextResponse } from 'next/server';
import { getServiceClient } from '@/lib/supabase';
import { hashInviteToken } from '@/lib/invite-token';

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ token: string }> }
) {
  const { token } = await context.params;
  const db = getServiceClient();

  const { data: invite } = await db
    .from('family_invitations')
    .select(`
      status,
      expires_at,
      family_identity_role,
      app_permission_role,
      invited_email,
      family:family_id (
        family_name,
        name
      )
    `)
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
    return NextResponse.json(
      { error: 'This invitation has expired.', status: 'expired' },
      { status: 410 }
    );
  }

  type FamilyRow = { family_name: string | null; name: string };
  const familyRaw = invite.family as FamilyRow | FamilyRow[] | null;
  const family    = Array.isArray(familyRaw) ? (familyRaw[0] ?? null) : familyRaw;
  const familyName =
    family?.family_name ??
    (family?.name ? `${family.name}'s Family` : 'this family');

  // Mask the email: show only enough to confirm identity
  const email    = invite.invited_email as string;
  const atIndex  = email.indexOf('@');
  const maskedEmail =
    atIndex > 1
      ? `${email[0]}${'*'.repeat(atIndex - 1)}${email.slice(atIndex)}`
      : email;

  return NextResponse.json({
    familyName:          familyName,
    familyIdentityRole:  invite.family_identity_role,
    appPermissionRole:   invite.app_permission_role,
    maskedEmail,
    expiresAt:           invite.expires_at,
  });
}
