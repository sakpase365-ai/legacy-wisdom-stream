'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import ProductAttribution from '@/components/ProductAttribution';

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
    const res = await fetch('/api/send-magic-link', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: email.trim(),
        redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
      }),
    });
    const json = await res.json();
    if (json.error) {
      setError(json.error);
      setBusy(false);
    } else {
      setSent(true);
    }
  }

  return (
    <main className="min-h-screen bg-background flex flex-col items-center justify-center px-6">
      <div className="w-full max-w-sm space-y-8">
        <div className="text-center space-y-2">
          <h1 className="font-serif text-3xl text-foreground">Breadcrumbs</h1>
          <p className="text-sm text-muted-foreground">Sign in to continue</p>
        </div>

        {sent ? (
          <div className="text-center space-y-3 py-8">
            <p className="font-serif text-foreground text-lg">Check your email.</p>
            <p className="text-sm text-muted-foreground">
              A sign-in link was sent to <span className="text-foreground">{email}</span>.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <input
              type="email"
              required
              placeholder="Your email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-card border border-border px-4 py-3 text-foreground text-sm placeholder:text-muted-foreground focus:border-foreground/60 transition rounded-sm"
            />
            {error && <p className="text-sm text-red-400">{error}</p>}
            <button
              type="submit"
              disabled={busy}
              className="w-full py-3 border border-foreground text-foreground text-sm tracking-wide disabled:opacity-30 hover:bg-foreground hover:text-background transition"
            >
              {busy ? 'Sending…' : 'Send sign-in link'}
            </button>
          </form>
        )}

        <p className="text-center text-xs text-muted-foreground">
          First time?{' '}
          <a href="/signup" className="underline hover:text-foreground transition">
            Create an account
          </a>
        </p>

        <div className="pt-6">
          <ProductAttribution />
        </div>
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
