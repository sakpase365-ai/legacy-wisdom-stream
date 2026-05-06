'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

const BUTTON_PRIMARY =
  'w-full py-3 border border-foreground text-foreground text-sm tracking-wide hover:bg-foreground hover:text-background transition disabled:opacity-30';

const BUTTON_SECONDARY =
  'w-full py-3 border border-border text-muted-foreground text-sm tracking-wide hover:border-foreground/40 hover:text-foreground transition disabled:opacity-30';

const INPUT =
  'w-full bg-card border border-border px-4 py-3 text-foreground text-sm placeholder:text-muted-foreground focus:border-foreground/60 transition rounded-sm outline-none';

type View = 'actions' | 'correction' | 'declined' | 'correction_sent';

export default function InviteActions({
  token,
  familyName,
}: {
  token:      string;
  familyName: string;
}) {
  const router = useRouter();
  const [view,  setView]  = useState<View>('actions');
  const [note,  setNote]  = useState('');
  const [busy,  setBusy]  = useState(false);
  const [error, setError] = useState('');

  async function handleDecline() {
    if (!confirm('Are you sure you want to decline this invitation?')) return;
    setBusy(true);
    setError('');
    try {
      const res  = await fetch(`/api/invite/${token}/decline`, { method: 'POST' });
      const json = await res.json();
      if (json.error) {
        setError(json.error);
      } else {
        setView('declined');
      }
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  async function handleCorrectionSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const res  = await fetch(`/api/invite/${token}/correction`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ note }),
      });
      const json = await res.json();
      if (json.error) {
        setError(json.error);
      } else {
        setView('correction_sent');
      }
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  // ── Declined ──────────────────────────────────────────────
  if (view === 'declined') {
    return (
      <div className="text-center space-y-3">
        <p className="text-sm text-foreground">Invitation declined.</p>
        <p className="text-xs text-muted-foreground">
          You have not been added to {familyName}. You can close this page.
        </p>
      </div>
    );
  }

  // ── Correction sent ───────────────────────────────────────
  if (view === 'correction_sent') {
    return (
      <div className="text-center space-y-3">
        <p className="text-sm text-foreground">Correction request sent.</p>
        <p className="text-xs text-muted-foreground">
          The family admin will be notified and can update your invite.
        </p>
      </div>
    );
  }

  // ── Correction form ───────────────────────────────────────
  if (view === 'correction') {
    return (
      <form onSubmit={handleCorrectionSubmit} className="space-y-4">
        <div className="space-y-1">
          <p className="text-sm text-foreground">Something not right?</p>
          <p className="text-xs text-muted-foreground">
            Tell the family admin what should be corrected.
          </p>
        </div>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder='e.g. "I should be listed as Mother, not Contributor."'
          rows={4}
          maxLength={1000}
          className={`${INPUT} resize-none`}
        />
        {error && <p className="text-xs text-red-400">{error}</p>}
        <button type="submit" disabled={busy} className={BUTTON_PRIMARY}>
          {busy ? 'Sending…' : 'Send correction request'}
        </button>
        <button
          type="button"
          onClick={() => { setView('actions'); setError(''); }}
          className="w-full text-xs text-muted-foreground hover:text-foreground transition"
        >
          ← Back
        </button>
      </form>
    );
  }

  // ── Main actions ──────────────────────────────────────────
  return (
    <div className="space-y-3">
      {error && <p className="text-xs text-red-400">{error}</p>}

      <button
        disabled={busy}
        onClick={() => router.push(`/invite/${token}/join`)}
        className={BUTTON_PRIMARY}
      >
        Confirm and Join
      </button>

      <button
        disabled={busy}
        onClick={() => setView('correction')}
        className={BUTTON_SECONDARY}
      >
        Request Correction
      </button>

      <button
        disabled={busy}
        onClick={handleDecline}
        className="w-full text-xs text-muted-foreground hover:text-foreground transition py-2"
      >
        Decline invite
      </button>
    </div>
  );
}
