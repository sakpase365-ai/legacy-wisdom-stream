'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { motion } from 'framer-motion';
import AnimatedWordmark from '@/components/AnimatedWordmark';

function LoginForm() {
  const searchParams = useSearchParams();
  const next = searchParams.get('next') ?? '/capture';
  const [email, setEmail]     = useState('');
  const [sent,  setSent]      = useState(false);
  const [error, setError]     = useState('');
  const [busy,  setBusy]      = useState(false);

  useEffect(() => {
    const err     = searchParams.get('error');
    const msgParam = searchParams.get('msg');

    if (err === 'link_error') {
      let body = 'That link has expired or was already used. Request a new one.';
      if (msgParam) {
        try {
          const decoded = decodeURIComponent(msgParam);
          if (decoded.length > 0 && decoded.length < 240 && !/[<>]/.test(decoded)) {
            body = decoded;
          }
        } catch { /* ignore malformed msg */ }
      }
      setError(body);
      return;
    }

    if (err === 'missing_code') {
      setError(
        'The sign-in link did not include a valid code. Request a new link. If it keeps happening, open the link in the same browser where you requested the email.',
      );
      return;
    }

    if (err === 'auth_failed') {
      setError(
        'We could not finish sign-in. The link may have expired, already been used, or been opened on another device or browser than where you requested it. Request a new link and open it in the same browser when possible.',
      );
      return;
    }

    if (err) {
      setError('Sign-in failed. Please try again.');
    }
  }, [searchParams]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim() || busy) return;
    setBusy(true);
    setError('');
    try {
      const res = await fetch('/api/send-magic-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email.trim(),
          redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
        }),
      });
      let json: { error?: string } = {};
      try {
        json = (await res.json()) as { error?: string };
      } catch {
        setError(
          res.ok
            ? 'Something went wrong. Please try again.'
            : `Sign-in request failed (${res.status}). Please try again.`,
        );
        return;
      }
      if (!res.ok || json.error) {
        setError(json.error ?? `Request failed (${res.status}). Please try again.`);
        return;
      }
      setSent(true);
    } catch {
      setError('Network error. Check your connection and try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="min-h-screen bg-background flex flex-col items-center justify-center px-6">
      <div className="w-full max-w-xs space-y-6">
        <div className="text-center space-y-3">
          <AnimatedWordmark className="text-5xl font-serif font-light tracking-tight text-foreground sm:text-6xl md:text-7xl" />
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.75, duration: 0.45 }}
            className="text-xs text-muted-foreground sm:text-sm"
          >
            Sign in to continue
          </motion.p>
        </div>

        {sent ? (
          <div className="text-center space-y-2 py-6">
            <p className="font-serif text-foreground text-base">Check your email.</p>
            <p className="text-xs text-muted-foreground sm:text-sm">
              A sign-in link was sent to <span className="text-foreground">{email}</span>.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-3">
            <input
              type="email"
              required
              placeholder="Your email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-card border border-border px-3 py-2.5 text-foreground text-sm placeholder:text-muted-foreground focus:border-foreground/60 transition rounded-sm"
            />
            {error && <p className="text-xs text-red-400 sm:text-sm">{error}</p>}
            <button
              type="submit"
              disabled={busy}
              className="w-full py-2.5 border border-foreground text-foreground text-xs tracking-wide disabled:opacity-30 hover:bg-foreground hover:text-background transition sm:text-sm"
            >
              {busy ? 'Sending…' : 'Send sign-in link'}
            </button>
          </form>
        )}

        <p className="text-center text-[11px] text-muted-foreground sm:text-xs">
          First time?{' '}
          <a href="/signup" className="underline hover:text-foreground transition">
            Create an account
          </a>
        </p>
      </div>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}
