'use client';

import { useState } from 'react';
import { INVITE_IDENTITY_ROLES, APP_PERMISSION_ROLES } from '@/lib/roles';

export const dynamic = 'force-dynamic';

const INPUT =
  'w-full bg-card border border-border px-4 py-3 text-foreground text-sm placeholder:text-muted-foreground focus:border-foreground/60 transition rounded-sm outline-none';

const SELECT =
  'w-full bg-card border border-border px-4 py-3 text-foreground text-sm focus:border-foreground/60 transition rounded-sm outline-none';

type Step = 'form' | 'sent';

export default function InviteFamilyMemberPage() {
  const [step,               setStep]               = useState<Step>('form');
  const [fullName,           setFullName]           = useState('');
  const [email,              setEmail]              = useState('');
  const [familyIdentityRole, setFamilyIdentityRole] = useState('');
  const [appPermissionRole,  setAppPermissionRole]  = useState('contributor');
  const [inviteUrl,          setInviteUrl]          = useState('');
  const [copied,             setCopied]             = useState(false);
  const [busy,               setBusy]               = useState(false);
  const [error,              setError]              = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    if (!fullName.trim() || !email.trim() || !familyIdentityRole || !appPermissionRole) {
      setError('Please fill in all fields.');
      return;
    }

    setBusy(true);

    const res  = await fetch('/api/invite', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ fullName, email, familyIdentityRole, appPermissionRole }),
    });
    const json = await res.json();

    if (json.error) {
      setError(json.error);
      setBusy(false);
    } else {
      setInviteUrl(json.inviteUrl);
      setStep('sent');
    }
  }

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(inviteUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback: select the text
    }
  }

  // ── Success: show invite link ─────────────────────────────
  if (step === 'sent') {
    return (
      <main className="min-h-screen bg-background flex flex-col items-center justify-center px-6 py-12">
        <div className="w-full max-w-sm space-y-8">

          <div className="text-center space-y-2">
            <h1 className="font-serif text-3xl text-foreground">Invite sent</h1>
            <p className="text-sm text-muted-foreground">
              An invitation email has been sent to {email.trim()}.
            </p>
          </div>

          <div className="space-y-3">
            <p className="text-xs text-muted-foreground/60 uppercase tracking-widest text-center">
              Backup link
            </p>
            <div className="bg-card border border-border rounded-sm px-4 py-3 break-all text-xs text-muted-foreground font-mono">
              {inviteUrl}
            </div>

            <button
              onClick={handleCopy}
              className="w-full py-3 border border-foreground text-foreground text-sm tracking-wide hover:bg-foreground hover:text-background transition"
            >
              {copied ? 'Copied!' : 'Copy invite link'}
            </button>
          </div>

          <div className="space-y-2 text-xs text-muted-foreground/60 leading-relaxed">
            <p>The invite link expires in 7 days.</p>
            <p>
              {fullName.trim()} will be asked to sign in using the email address
              this invite was sent to.
            </p>
          </div>

          <div className="flex flex-col gap-2 items-center">
            <button
              onClick={() => {
                setStep('form');
                setFullName('');
                setEmail('');
                setFamilyIdentityRole('');
                setAppPermissionRole('contributor');
                setInviteUrl('');
                setError('');
              }}
              className="w-full text-xs text-muted-foreground hover:text-foreground transition"
            >
              Invite another family member →
            </button>
            <a
              href="/family/invitations"
              className="text-xs text-muted-foreground/60 hover:text-muted-foreground transition"
            >
              View all invitations
            </a>
          </div>

        </div>
      </main>
    );
  }

  // ── Form ──────────────────────────────────────────────────
  return (
    <main className="min-h-screen bg-background flex flex-col items-center justify-center px-6 py-12">
      <div className="w-full max-w-sm space-y-8">

        <div className="text-center space-y-2">
          <h1 className="font-serif text-3xl text-foreground">Invite Family Member</h1>
          <p className="text-sm text-muted-foreground">
            They will join with their own account.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">

          <div className="space-y-1">
            <label className="text-xs text-muted-foreground/60 uppercase tracking-widest">
              Full Name
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Sarah Joseph"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className={INPUT}
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs text-muted-foreground/60 uppercase tracking-widest">
              Email Address
            </label>
            <input
              type="email"
              required
              placeholder="their@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={INPUT}
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs text-muted-foreground/60 uppercase tracking-widest">
              Family Role
            </label>
            <select
              required
              value={familyIdentityRole}
              onChange={(e) => setFamilyIdentityRole(e.target.value)}
              className={SELECT}
            >
              <option value="" disabled>
                Who are they in your family?
              </option>
              {INVITE_IDENTITY_ROLES.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-xs text-muted-foreground/60 uppercase tracking-widest">
              Access Level
            </label>
            <select
              required
              value={appPermissionRole}
              onChange={(e) => setAppPermissionRole(e.target.value)}
              className={SELECT}
            >
              {APP_PERMISSION_ROLES.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label} — {r.description}
                </option>
              ))}
            </select>
          </div>

          <p className="text-xs text-muted-foreground/60 leading-relaxed">
            Family Role describes who they are in your family. Access Level
            controls what they can do in Breadcrumbs.
          </p>

          {error && <p className="text-xs text-red-400">{error}</p>}

          <button
            type="submit"
            disabled={busy}
            className="w-full py-3 border border-foreground text-foreground text-sm tracking-wide disabled:opacity-30 hover:bg-foreground hover:text-background transition"
          >
            {busy ? 'Creating invite…' : 'Create invite link'}
          </button>

          <a
            href="/capture"
            className="block text-center text-xs text-muted-foreground hover:text-foreground transition"
          >
            ← Back
          </a>
        </form>

      </div>
    </main>
  );
}
