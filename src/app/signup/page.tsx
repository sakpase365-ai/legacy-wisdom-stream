'use client';

import { useState } from 'react';
import { createBrowserClient } from '@supabase/ssr';

type Step = 'account' | 'profile' | 'sent';

export default function SignupPage() {
  const [step,       setStep]       = useState<Step>('account');
  const [email,      setEmail]      = useState('');
  const [parentName, setParentName] = useState('');
  const [childName,  setChildName]  = useState('');
  const [childDob,   setChildDob]   = useState('');
  const [error,      setError]      = useState('');
  const [busy,       setBusy]       = useState(false);

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  async function handleAccountSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    setStep('profile');
  }

  async function handleProfileSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!parentName.trim() || !childName.trim() || !childDob || busy) return;
    setBusy(true);
    setError('');

    // Sign up with magic link; store profile fields in user_metadata
    // so the profile API can read them on first login.
    const { error: authError } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback?next=/capture`,
        data: {
          parent_name: parentName.trim(),
          child_name:  childName.trim(),
          child_dob:   childDob,
        },
      },
    });

    if (authError) {
      setError(authError.message);
      setBusy(false);
    } else {
      setStep('sent');
    }
  }

  if (step === 'sent') {
    return (
      <main className="min-h-screen bg-background flex flex-col items-center justify-center px-6">
        <div className="w-full max-w-sm text-center space-y-4">
          <p className="font-serif text-foreground text-2xl">Almost there.</p>
          <p className="text-sm text-muted-foreground">
            Check your email at <span className="text-foreground">{email}</span> to finish setting up your account.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-background flex flex-col items-center justify-center px-6">
      <div className="w-full max-w-sm space-y-8">
        <div className="text-center space-y-2">
          <h1 className="font-serif text-3xl text-foreground">Breadcrumbs</h1>
          <p className="text-sm text-muted-foreground">
            {step === 'account' ? 'Create your account' : 'Tell us about your family'}
          </p>
        </div>

        {step === 'account' && (
          <form onSubmit={handleAccountSubmit} className="space-y-4">
            <input
              type="email"
              required
              placeholder="Your email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-card border border-border px-4 py-3 text-foreground text-sm placeholder:text-muted-foreground focus:border-foreground/60 transition rounded-sm"
            />
            <button
              type="submit"
              className="w-full py-3 border border-foreground text-foreground text-sm tracking-wide hover:bg-foreground hover:text-background transition"
            >
              Continue
            </button>
          </form>
        )}

        {step === 'profile' && (
          <form onSubmit={handleProfileSubmit} className="space-y-4">
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
              {busy ? 'Creating account…' : 'Create account'}
            </button>
            <button
              type="button"
              onClick={() => setStep('account')}
              className="w-full text-xs text-muted-foreground hover:text-foreground transition"
            >
              ← Back
            </button>
          </form>
        )}

        <p className="text-center text-xs text-muted-foreground">
          Already have an account?{' '}
          <a href="/login" className="underline hover:text-foreground transition">
            Sign in
          </a>
        </p>

        <p className="text-center text-xs text-muted-foreground/50 leading-relaxed">
          Your entries are private to you. We do not share or sell your family's data.
        </p>
      </div>
    </main>
  );
}
