'use client';

import { useState, use } from 'react';
import AnimatedWordmark from '@/components/AnimatedWordmark';

export const dynamic = 'force-dynamic';

const INPUT =
  'w-full bg-card border border-border px-4 py-3 text-foreground text-sm placeholder:text-muted-foreground focus:border-foreground/60 transition rounded-sm outline-none';

type Step = 'email' | 'sent';

export default function InviteJoinPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = use(params);

  const [step,  setStep]  = useState<Step>('email');
  const [email, setEmail] = useState('');
  const [busy,  setBusy]  = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    setBusy(true);
    setError('');

    const redirectTo =
      `${window.location.origin}/auth/callback?next=/invite/${token}/finalize`;

    try {
      const res = await fetch('/api/send-magic-link', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ email: email.trim(), redirectTo }),
      });
      let json: { error?: string } = {};
      try {
        json = (await res.json()) as { error?: string };
      } catch {
        setError('Something went wrong. Please try again.');
        return;
      }
      if (!res.ok || json.error) {
        setError(json.error ?? 'Something went wrong. Please try again.');
        return;
      }
      setStep('sent');
    } catch {
      setError('Network error. Check your connection and try again.');
    } finally {
      setBusy(false);
    }
  }

  if (step === 'sent') {
    return (
      <main className="min-h-screen bg-background flex flex-col items-center justify-center px-6">
        <div className="w-full max-w-sm text-center space-y-4">
          <p className="font-serif text-foreground text-2xl">Almost there.</p>
          <p className="text-sm text-muted-foreground">
            Check your email at{' '}
            <span className="text-foreground">{email}</span> to complete
            joining the family.
          </p>
          <p className="text-xs text-muted-foreground/60">
            Use the same email address the invite was sent to.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-background flex flex-col items-center justify-center px-6 py-12">
      <div className="w-full max-w-sm space-y-8">

        <div className="text-center space-y-4">
          <AnimatedWordmark />
          <p className="text-sm text-muted-foreground">Join your family</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <p className="text-xs text-muted-foreground leading-relaxed">
            Enter the email address this invite was sent to. We&apos;ll send
            you a sign-in link — no password needed.
          </p>

          <input
            type="email"
            required
            autoComplete="email"
            placeholder="Your email address"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={INPUT}
          />

          {error && <p className="text-xs text-red-400">{error}</p>}

          <button
            type="submit"
            disabled={busy}
            className="w-full py-3 border border-foreground text-foreground text-sm tracking-wide disabled:opacity-30 hover:bg-foreground hover:text-background transition"
          >
            {busy ? 'Sending link…' : 'Send sign-in link'}
          </button>

          <a
            href={`/invite/${token}`}
            className="block text-center text-xs text-muted-foreground hover:text-foreground transition"
          >
            ← Back to invite
          </a>
        </form>

      </div>
    </main>
  );
}
