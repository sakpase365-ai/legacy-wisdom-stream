'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

// This page is shown to authenticated users who have no profile row yet.
// This happens when a user signs in via magic link without going through /signup
// (e.g. they received a shared link, or signed in directly via /login).

export default function SetupPage() {
  const router = useRouter();
  const [parentName, setParentName] = useState('');
  const [childName,  setChildName]  = useState('');
  const [childDob,   setChildDob]   = useState('');
  const [error,      setError]      = useState('');
  const [busy,       setBusy]       = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!parentName.trim() || !childName.trim() || !childDob || busy) return;
    setBusy(true);
    setError('');

    try {
      const res = await fetch('/api/setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          parentName: parentName.trim(),
          childName:  childName.trim(),
          childDob,
        }),
      });

      if (res.status === 401) {
        router.push('/login');
        return;
      }

      if (!res.ok) {
        const data = await res.json();
        setError(data.error ?? 'Something went wrong. Please try again.');
        setBusy(false);
        return;
      }

      router.push('/capture');
    } catch {
      setError('Could not save your profile. Check your connection.');
      setBusy(false);
    }
  }

  return (
    <main className="min-h-screen bg-background flex flex-col items-center justify-center px-6">
      <div className="w-full max-w-sm space-y-8">
        <div className="text-center space-y-2">
          <h1 className="font-serif text-3xl text-foreground">One last step.</h1>
          <p className="text-sm text-muted-foreground">Tell us about your family to get started.</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            type="text"
            required
            placeholder="Your first name"
            value={parentName}
            onChange={(e) => setParentName(e.target.value)}
            className="w-full bg-card border border-border px-4 py-3 text-foreground text-sm placeholder:text-muted-foreground focus:border-foreground/60 transition rounded-sm"
          />
          <input
            type="text"
            required
            placeholder="Your child's first name"
            value={childName}
            onChange={(e) => setChildName(e.target.value)}
            className="w-full bg-card border border-border px-4 py-3 text-foreground text-sm placeholder:text-muted-foreground focus:border-foreground/60 transition rounded-sm"
          />
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground uppercase tracking-widest">
              Child's date of birth
            </label>
            <input
              type="date"
              required
              value={childDob}
              onChange={(e) => setChildDob(e.target.value)}
              max={new Date().toISOString().split('T')[0]}
              className="w-full bg-card border border-border px-4 py-3 text-foreground text-sm focus:border-foreground/60 transition rounded-sm"
            />
          </div>

          {error && <p className="text-sm text-red-400">{error}</p>}

          <button
            type="submit"
            disabled={busy}
            className="w-full py-3 border border-foreground text-foreground text-sm tracking-wide disabled:opacity-30 hover:bg-foreground hover:text-background transition"
          >
            {busy ? 'Saving…' : 'Continue'}
          </button>
        </form>
      </div>
    </main>
  );
}
