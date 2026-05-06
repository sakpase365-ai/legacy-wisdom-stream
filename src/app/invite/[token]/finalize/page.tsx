import { redirect } from 'next/navigation';
import { getSessionClient, getServiceClient } from '@/lib/supabase';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

export default async function InviteFinalizePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  const supabase = await getSessionClient();
  const { data: { session } } = await supabase.auth.getSession();

  // No session — send back to join page so they can authenticate
  if (!session) {
    redirect(`/invite/${token}/join`);
  }

  const db = getServiceClient();

  // ── Load and validate the invitation ──────────────────────
  const { data: invite } = await db
    .from('family_invitations')
    .select('id, status, expires_at, invited_email, family_member_id, family_identity_role, family_id')
    .eq('invite_token', token)
    .single();

  if (!invite) {
    return <ErrorPage heading="Invite not found" body="This invite link does not exist or has been removed." />;
  }

  if (invite.status !== 'pending') {
    if (invite.status === 'accepted') {
      redirect('/capture');
    }
    return (
      <ErrorPage
        heading="Invite no longer valid"
        body={`This invite was ${invite.status}. Ask the family admin to send a new one.`}
      />
    );
  }

  if (new Date(invite.expires_at as string) < new Date()) {
    return <ErrorPage heading="Invite expired" body="This invite link is no longer active. Ask the family admin to send a new one." />;
  }

  // ── Enforce email match ───────────────────────────────────
  const sessionEmail = (session.user.email ?? '').toLowerCase();
  if (sessionEmail !== (invite.invited_email as string).toLowerCase()) {
    return (
      <ErrorPage
        heading="Wrong account"
        body={`This invitation was sent to a different email address. Sign in with the email that received the invite.`}
        action={{ label: 'Back to invite', href: `/invite/${token}` }}
      />
    );
  }

  // ── Fetch the family_member record ────────────────────────
  const { data: familyMember } = await db
    .from('family_members')
    .select('id, name, status, linked_user_id')
    .eq('id', invite.family_member_id as string)
    .single();

  if (!familyMember) {
    return <ErrorPage heading="Something went wrong" body="Family member record not found. Please contact the family admin." />;
  }

  // Idempotent: already linked
  if (familyMember.linked_user_id) {
    redirect('/capture');
  }

  // ── Get or create public.users for the invitee ────────────
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
      logger.error('invite finalize page: user creation failed', { code: userError?.code });
      return <ErrorPage heading="Something went wrong" body="Failed to create your profile. Please try again." />;
    }

    userId = newUser.id as string;
  }

  // ── Link the account ──────────────────────────────────────
  const { error: memberError } = await db
    .from('family_members')
    .update({ linked_user_id: userId, status: 'active' })
    .eq('id', familyMember.id);

  if (memberError) {
    logger.error('invite finalize page: member link failed', { code: memberError.code });
    return <ErrorPage heading="Something went wrong" body="Failed to link your account to the family. Please try again." />;
  }

  // Mark invitation accepted (non-fatal if this fails)
  await db
    .from('family_invitations')
    .update({
      status:      'accepted',
      accepted_at: new Date().toISOString(),
      updated_at:  new Date().toISOString(),
    })
    .eq('id', invite.id);

  logger.info('invite finalize page: accepted', {
    inviteId: invite.id,
    userId,
    familyId: invite.family_id,
  });

  redirect('/capture');
}

// ── Shared error UI ───────────────────────────────────────────

function ErrorPage({
  heading,
  body,
  action,
}: {
  heading: string;
  body:    string;
  action?: { label: string; href: string };
}) {
  return (
    <main className="min-h-screen bg-background flex flex-col items-center justify-center px-6">
      <div className="w-full max-w-sm text-center space-y-4">
        <p className="font-serif text-foreground text-2xl">{heading}</p>
        <p className="text-sm text-muted-foreground">{body}</p>
        {action && (
          <a
            href={action.href}
            className="inline-block text-xs text-muted-foreground underline hover:text-foreground transition"
          >
            {action.label}
          </a>
        )}
      </div>
    </main>
  );
}
