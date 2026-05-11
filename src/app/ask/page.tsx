'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { getBrowserSupabase } from '@/lib/supabase-browser';

interface FamilyMember {
  id:   string;
  name: string;
  role: string;
}

export default function AskPage() {
  const router = useRouter();

  const [familyMembers,      setFamilyMembers]      = useState<FamilyMember[]>([]);
  const [selectedRecipient,  setSelectedRecipient]  = useState<string>('');
  const [question,           setQuestion]           = useState('');
  const [answer,             setAnswer]             = useState<string | null>(null);
  const [warnings,           setWarnings]           = useState<string[]>([]);
  const [contextSources,     setContextSources]     = useState<{ source: string; id: string }[]>([]);
  const [error,              setError]              = useState<string | null>(null);
  const [loading,            setLoading]            = useState(false);
  const [profileLoading,     setProfileLoading]     = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const supabase = getBrowserSupabase();
        if (!supabase) {
          router.push('/login?next=/ask');
          return;
        }
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) { router.push('/login?next=/ask'); return; }

        const res = await fetch('/api/profile');
        if (res.status === 401) { router.push('/login?next=/ask'); return; }
        if (res.ok) {
          const data = await res.json();
          setFamilyMembers((data.familyMembers ?? []) as FamilyMember[]);
        }
      } finally {
        setProfileLoading(false);
      }
    })();
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!question.trim() || loading) return;

    setLoading(true);
    setAnswer(null);
    setWarnings([]);
    setContextSources([]);
    setError(null);

    try {
      const res = await fetch('/api/family-agent', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          question:    question.trim(),
          recipientId: selectedRecipient || null,
        }),
      });

      if (res.status === 401) { router.push('/login?next=/ask'); return; }
      if (res.status === 429) {
        setError('You have asked too many questions recently. Please wait a moment before asking again.');
        return;
      }
      if (!res.ok) {
        setError('Something went wrong. Please try again.');
        return;
      }

      const data = await res.json();
      setAnswer(data.answer as string);
      setWarnings((data.warnings ?? []) as string[]);
      setContextSources((data.contextSources ?? []) as { source: string; id: string }[]);
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  if (profileLoading) {
    return (
      <main className="min-h-screen bg-background text-foreground flex items-center justify-center">
        <p className="text-sm text-muted-foreground">Loading…</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-background text-foreground px-4 py-10 sm:py-16">
      <div className="max-w-2xl mx-auto space-y-8">

        {/* Header */}
        <div className="space-y-1">
          <h1 className="text-2xl font-serif font-light tracking-tight">
            Ask the Family Agent
          </h1>
          <p className="text-sm text-muted-foreground">
            Answers draw from your saved Family Foundation and Breadcrumbs.
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <textarea
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="What do you believe about handling failure?"
            rows={4}
            maxLength={1000}
            disabled={loading}
            className="w-full bg-transparent border border-border text-sm text-foreground placeholder:text-muted-foreground/50 px-4 py-3 resize-none focus:outline-none focus:border-foreground/40 transition"
          />

          {familyMembers.length > 0 && (
            <div className="space-y-1">
              <label className="block text-xs text-muted-foreground">
                About (optional)
              </label>
              <select
                value={selectedRecipient}
                onChange={(e) => setSelectedRecipient(e.target.value)}
                disabled={loading}
                className="bg-background border border-border text-sm text-foreground px-3 py-2 focus:outline-none focus:border-foreground/40 transition"
              >
                <option value="">The whole family</option>
                {familyMembers.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          <button
            type="submit"
            disabled={loading || !question.trim()}
            className="w-full py-4 px-8 border border-foreground text-foreground text-sm font-normal tracking-wide hover:bg-foreground hover:text-background transition disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {loading ? 'Asking…' : 'Ask'}
          </button>
        </form>

        {/* Error state */}
        {error && (
          <p className="text-sm text-red-400">{error}</p>
        )}

        {/* Answer */}
        {answer && (
          <div className="space-y-3">
            <div className="border border-border px-6 py-5">
              <p className="text-sm font-light leading-relaxed whitespace-pre-wrap">{answer}</p>
            </div>

            {warnings.length > 0 && (
              <div className="space-y-1">
                {warnings.map((w, i) => (
                  <p key={i} className="text-xs text-muted-foreground/70">{w}</p>
                ))}
              </div>
            )}

            {(() => {
              const breadcrumbCount = contextSources.filter((s) => s.source === 'breadcrumbs').length;
              return breadcrumbCount > 0 ? (
                <p className="text-xs text-muted-foreground/50">
                  Answered using {breadcrumbCount} saved{' '}
                  {breadcrumbCount === 1 ? 'breadcrumb' : 'breadcrumbs'} from your{' '}
                  <Link href="/archive" className="underline underline-offset-2 hover:text-muted-foreground transition">
                    Family Library
                  </Link>
                  .
                </p>
              ) : (
                <p className="text-xs text-muted-foreground/50">
                  Answers are based on your saved Family Foundation and Breadcrumbs.
                </p>
              );
            })()}
          </div>
        )}

      </div>
    </main>
  );
}
