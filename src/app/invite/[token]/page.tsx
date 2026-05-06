import { getServiceClient } from '@/lib/supabase';
import { hashInviteToken } from '@/lib/invite-token';
import InviteActions from './InviteActions';

export const dynamic = 'force-dynamic';

interface InviteData {
  familyName:         string;
  familyIdentityRole: string;
  appPermissionRole:  string;
  maskedEmail:        string;
  expiresAt:          string;
}

async function loadInvite(token: string): Promise<
  | { ok: true;  data: InviteData }
  | { ok: false; reason: 'not_found' | 'used' | 'expired'; status?: string }
> {
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

  if (!invite) return { ok: false, reason: 'not_found' };

  if (invite.status !== 'pending') {
    return { ok: false, reason: 'used', status: invite.status as string };
  }

  if (new Date(invite.expires_at as string) < new Date()) {
    return { ok: false, reason: 'expired' };
  }

  type FamilyRow = { family_name: string | null; name: string };
  const familyRaw  = invite.family as FamilyRow | FamilyRow[] | null;
  const family     = Array.isArray(familyRaw) ? (familyRaw[0] ?? null) : familyRaw;
  const familyName =
    family?.family_name ??
    (family?.name ? `${family.name}'s Family` : 'this family');

  const email    = invite.invited_email as string;
  const atIndex  = email.indexOf('@');
  const maskedEmail =
    atIndex > 1
      ? `${email[0]}${'*'.repeat(atIndex - 1)}${email.slice(atIndex)}`
      : email;

  return {
    ok:   true,
    data: {
      familyName,
      familyIdentityRole: invite.family_identity_role as string,
      appPermissionRole:  invite.app_permission_role  as string,
      maskedEmail,
      expiresAt:          invite.expires_at as string,
    },
  };
}

function roleLabel(role: string): string {
  return role
    .replace(/_/g, '-')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function permissionLabel(role: string): string {
  const map: Record<string, string> = {
    owner:       'Owner',
    admin:       'Admin',
    contributor: 'Contributor',
    recipient:   'Recipient',
  };
  return map[role] ?? role;
}

export default async function InvitePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const result    = await loadInvite(token);

  // ── Invalid / expired states ──────────────────────────────
  if (!result.ok) {
    const messages: Record<string, { heading: string; body: string }> = {
      not_found: {
        heading: 'Invite not found',
        body:    'This invite link does not exist or has been removed.',
      },
      expired: {
        heading: 'Invite expired',
        body:    'This invite link is no longer active. Ask the family admin to send a new one.',
      },
      used: {
        heading: 'Invite already used',
        body:
          result.status === 'accepted'
            ? 'This invite has already been accepted.'
            : result.status === 'declined'
            ? 'This invite was declined.'
            : result.status === 'correction_requested'
            ? 'A correction has been requested. The family admin will follow up.'
            : 'This invite is no longer valid.',
      },
    };

    const msg = messages[result.reason] ?? messages['not_found'];

    return (
      <main className="min-h-screen bg-background flex flex-col items-center justify-center px-6">
        <div className="w-full max-w-sm text-center space-y-4">
          <p className="font-serif text-foreground text-2xl">{msg.heading}</p>
          <p className="text-sm text-muted-foreground">{msg.body}</p>
        </div>
      </main>
    );
  }

  const { data } = result;

  // ── Valid invite ──────────────────────────────────────────
  return (
    <main className="min-h-screen bg-background flex flex-col items-center justify-center px-6 py-12">
      <div className="w-full max-w-sm space-y-8">

        <div className="text-center space-y-2">
          <h1 className="font-serif text-3xl text-foreground">Breadcrumbs</h1>
          <p className="text-sm text-muted-foreground">Family invitation</p>
        </div>

        <div className="space-y-6 border border-border rounded-sm px-6 py-6">
          <p className="text-sm text-foreground leading-relaxed">
            You&apos;ve been invited to join{' '}
            <span className="font-medium">{data.familyName}</span>.
          </p>

          <div className="space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Family role</span>
              <span className="text-foreground font-medium">
                {roleLabel(data.familyIdentityRole)}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Access level</span>
              <span className="text-foreground font-medium">
                {permissionLabel(data.appPermissionRole)}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Sent to</span>
              <span className="text-foreground">{data.maskedEmail}</span>
            </div>
          </div>

          <p className="text-xs text-muted-foreground/60 leading-relaxed">
            Family role describes who you are in the family. Access level
            controls what you can do in Breadcrumbs.
          </p>
        </div>

        <InviteActions token={token} familyName={data.familyName} />

      </div>
    </main>
  );
}
