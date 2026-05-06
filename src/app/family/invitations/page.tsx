'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';

export const dynamic = 'force-dynamic';

interface Invitation {
  id:                   string;
  name:                 string | null;
  invited_email:        string;
  family_identity_role: string;
  app_permission_role:  string;
  status:               string;
  correction_note:      string | null;
  expires_at:           string;
  accepted_at:          string | null;
  created_at:           string;
}

const STATUS_STYLES: Record<string, string> = {
  pending:              'border-amber-700  text-amber-400',
  accepted:             'border-emerald-800 text-emerald-400',
  declined:             'border-border      text-muted-foreground',
  expired:              'border-border      text-muted-foreground',
  revoked:              'border-border      text-muted-foreground',
  correction_requested: 'border-orange-700  text-orange-400',
};

const STATUS_LABEL: Record<string, string> = {
  pending:              'Pending',
  accepted:             'Accepted',
  declined:             'Declined',
  expired:              'Expired',
  revoked:              'Revoked',
  correction_requested: 'Correction requested',
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  });
}

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1).replace('_', ' ');
}

export default function InvitationsPage() {
  const router = useRouter();

  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [error,       setError]       = useState('');
  const [revoking,    setRevoking]    = useState<string | null>(null);
  const [confirmId,   setConfirmId]   = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/invitations');
      if (res.status === 401) { router.push('/login?next=/family/invitations'); return; }
      if (res.status === 403) { router.push('/capture'); return; }
      if (!res.ok) { setError('Failed to load invitations.'); return; }
      const data = await res.json();
      setInvitations(data.invitations ?? []);
    } catch {
      setError('Failed to load invitations.');
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => { load(); }, [load]);

  async function handleRevoke(id: string) {
    setRevoking(id);
    setConfirmId(null);
    try {
      const res  = await fetch(`/api/invitations/${id}/revoke`, { method: 'POST' });
      const json = await res.json();
      if (json.error) {
        setError(json.error);
      } else {
        setInvitations((prev) =>
          prev.map((inv) => inv.id === id ? { ...inv, status: 'revoked' } : inv)
        );
      }
    } catch {
      setError('Failed to revoke invitation.');
    } finally {
      setRevoking(null);
    }
  }

  const pendingCount = invitations.filter((i) => i.status === 'pending').length;

  return (
    <main className="min-h-screen bg-background px-6 py-14">
      <div className="max-w-xl mx-auto space-y-8">

        {/* Header */}
        <div className="flex items-center justify-between">
          <button
            onClick={() => router.push('/capture')}
            className="text-sm text-muted-foreground hover:text-foreground transition"
          >
            ← Back
          </button>
          <h1 className="font-serif text-lg text-foreground tracking-tight">Invitations</h1>
          <a
            href="/family/invite"
            className="text-sm text-muted-foreground hover:text-foreground transition"
          >
            + New
          </a>
        </div>

        <div className="w-full h-px bg-border" />

        {loading && (
          <p className="text-muted-foreground text-sm text-center animate-pulse py-12">
            Loading…
          </p>
        )}

        {error && (
          <p className="text-xs text-red-400 text-center py-4">{error}</p>
        )}

        {!loading && !error && invitations.length === 0 && (
          <div className="text-center py-20 space-y-4">
            <p className="font-serif text-foreground text-2xl">No invitations yet.</p>
            <p className="text-muted-foreground text-sm">
              Invite a family member to join with their own account.
            </p>
            <a
              href="/family/invite"
              className="mt-4 inline-block py-3 px-8 border border-foreground text-foreground text-sm tracking-wide hover:bg-foreground hover:text-background transition"
            >
              Send an invitation
            </a>
          </div>
        )}

        {!loading && invitations.length > 0 && (
          <div className="space-y-4">
            <p className="text-xs text-muted-foreground uppercase tracking-widest">
              {pendingCount > 0
                ? `${pendingCount} pending · ${invitations.length} total`
                : `${invitations.length} total`}
            </p>

            {invitations.map((inv) => {
              const isPending    = inv.status === 'pending';
              const isExpired    = isPending && new Date(inv.expires_at) < new Date();
              const displayStatus = isExpired ? 'expired' : inv.status;
              const isConfirming = confirmId === inv.id;

              return (
                <div key={inv.id} className="glass-card px-5 py-4 space-y-3">

                  {/* Name + status */}
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-foreground text-sm font-medium">
                        {inv.name ?? inv.invited_email}
                      </p>
                      {inv.name && (
                        <p className="text-xs text-muted-foreground">{inv.invited_email}</p>
                      )}
                    </div>
                    <span className={`shrink-0 text-xs px-2 py-0.5 border rounded-sm ${STATUS_STYLES[displayStatus] ?? STATUS_STYLES.expired}`}>
                      {STATUS_LABEL[displayStatus] ?? displayStatus}
                    </span>
                  </div>

                  {/* Role + access */}
                  <div className="flex flex-wrap gap-2">
                    <span className="text-xs px-2 py-0.5 border border-border text-muted-foreground rounded-sm">
                      {capitalize(inv.family_identity_role)}
                    </span>
                    <span className="text-xs px-2 py-0.5 border border-border text-muted-foreground rounded-sm">
                      {capitalize(inv.app_permission_role)}
                    </span>
                  </div>

                  {/* Correction note */}
                  {inv.correction_note && (
                    <div className="border-l-2 border-orange-700 pl-3">
                      <p className="text-xs text-muted-foreground leading-relaxed">
                        <span className="text-orange-400">Note:</span> {inv.correction_note}
                      </p>
                    </div>
                  )}

                  {/* Footer */}
                  <div className="flex items-center justify-between">
                    <p className="text-xs text-muted-foreground">
                      {inv.accepted_at
                        ? `Accepted ${formatDate(inv.accepted_at)}`
                        : isPending && !isExpired
                          ? `Expires ${formatDate(inv.expires_at)}`
                          : `Sent ${formatDate(inv.created_at)}`}
                    </p>

                    {isPending && !isExpired && (
                      isConfirming ? (
                        <div className="flex items-center gap-3">
                          <span className="text-xs text-muted-foreground">Revoke?</span>
                          <button
                            onClick={() => handleRevoke(inv.id)}
                            disabled={revoking === inv.id}
                            className="text-xs text-red-400 hover:text-red-300 transition disabled:opacity-40"
                          >
                            {revoking === inv.id ? 'Revoking…' : 'Yes, revoke'}
                          </button>
                          <button
                            onClick={() => setConfirmId(null)}
                            className="text-xs text-muted-foreground hover:text-foreground transition"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setConfirmId(inv.id)}
                          className="text-xs text-muted-foreground hover:text-red-400 transition"
                        >
                          Revoke
                        </button>
                      )
                    )}
                  </div>

                </div>
              );
            })}
          </div>
        )}

      </div>
    </main>
  );
}
