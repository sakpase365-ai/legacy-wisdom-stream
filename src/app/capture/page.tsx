'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { createBrowserClient } from '@supabase/ssr';
import ErrorBoundary from '@/components/ErrorBoundary';
import { DESCENDENT_ROLES } from '@/lib/roles';
import { firstName } from '@/lib/utils';

const DRAFT_KEY = 'breadcrumbs_draft';

interface Profile {
  id:                string;
  name:              string;
  family_name:       string | null;
  role:              string;
  custom_role_label: string | null;
}

interface FamilyMember {
  id:                string;
  name:              string;
  role:              string;
  custom_role_label: string | null;
  birth_date:        string | null;
}

type Stage = 'loading' | 'prompted' | 'writing' | 'follow-up' | 'done' | 'error';

function primaryRecipient(members: FamilyMember[]): FamilyMember | null {
  return members.find((m) => DESCENDENT_ROLES.has(m.role)) ?? members[0] ?? null;
}

function CaptureFlow() {
  const router = useRouter();
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
  const [profile,          setProfile]          = useState<Profile | null>(null);
  const [familyMembers,    setFamilyMembers]    = useState<FamilyMember[]>([]);
  const [stage,            setStage]            = useState<Stage>('loading');
  const [prompt,           setPrompt]           = useState('');
  const [entry,            setEntry]            = useState('');
  const [followUp,         setFollowUp]         = useState('');
  const [followUpAddition, setFollowUpAddition] = useState('');
  const [savedEntryId,     setSavedEntryId]     = useState<string | null>(null);
  const [savedAt,          setSavedAt]          = useState<string | null>(null);
  const [saving,           setSaving]           = useState(false);
  const [charCount,        setCharCount]        = useState(0);
  const [draftRestored,    setDraftRestored]    = useState(false);
  const autosaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const saved = localStorage.getItem(DRAFT_KEY);
    if (saved) {
      setEntry(saved);
      setCharCount(saved.length);
      setDraftRestored(true);
    }
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const profileRes = await fetch('/api/profile');
        if (profileRes.status === 401) { router.push('/login?next=/capture'); return; }
        if (profileRes.status === 422) { router.push('/setup'); return; }
        if (!profileRes.ok) { setStage('error'); return; }
        const { profile: p, familyMembers: fm } = await profileRes.json();
        setProfile(p);
        setFamilyMembers(fm ?? []);

        const promptRes = await fetch('/api/generate-prompt', { method: 'POST' });
        if (!promptRes.ok) { setStage('error'); return; }
        const { prompt: dailyPrompt } = await promptRes.json();
        setPrompt(dailyPrompt);

        setStage(localStorage.getItem(DRAFT_KEY) ? 'writing' : 'prompted');
      } catch {
        setStage('error');
      }
    })();
  }, [router]);

  function handleEntryChange(value: string) {
    setEntry(value);
    setCharCount(value.length);
    if (stage === 'prompted') setStage('writing');

    if (autosaveTimer.current) clearTimeout(autosaveTimer.current);
    autosaveTimer.current = setTimeout(() => {
      if (value.trim()) {
        localStorage.setItem(DRAFT_KEY, value);
      } else {
        localStorage.removeItem(DRAFT_KEY);
      }
    }, 500);
  }

  async function handleSave() {
    if (!entry.trim() || saving) return;
    setSaving(true);
    try {
      const res = await fetch('/api/save-entry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: entry }),
      });
      if (!res.ok) { setStage('error'); return; }
      const data = await res.json();
      setFollowUp(data.followUp);
      setSavedEntryId(data.entry.id);
      setSavedAt(data.entry.created_at ?? new Date().toISOString());
      localStorage.removeItem(DRAFT_KEY);
      setStage('follow-up');
    } catch {
      setStage('error');
    } finally {
      setSaving(false);
    }
  }

  const recipient = primaryRecipient(familyMembers);
  const recipientLabel = firstName(recipient?.name) ?? 'your family';

  return (
    <main className="min-h-screen bg-background flex flex-col items-center justify-start px-6 py-14">
      <div className="max-w-xl w-full space-y-8">

        {/* Header */}
        <div className="flex items-center justify-between">
          <button
            onClick={() => router.push('/')}
            className="text-sm text-muted-foreground hover:text-foreground transition"
          >
            ← Back
          </button>
          <span className="text-xs text-muted-foreground uppercase tracking-widest">
            {new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
          </span>
          <button
            onClick={async () => {
              await supabase.auth.signOut();
              router.push('/login');
            }}
            className="text-xs text-muted-foreground/60 hover:text-muted-foreground transition"
          >
            Sign out
          </button>
        </div>

        {/* Loading */}
        {stage === 'loading' && (
          <div className="py-24 text-center">
            <p className="text-muted-foreground text-sm animate-pulse">Preparing today&apos;s prompt…</p>
          </div>
        )}

        {/* Prompt + Writing */}
        {(stage === 'prompted' || stage === 'writing') && profile && (
          <div className="space-y-6">
            <div className="border-l-2 border-foreground/30 pl-5 py-1">
              <p className="font-serif text-foreground text-xl leading-relaxed">{prompt}</p>
            </div>

            {draftRestored && (
              <p className="text-xs text-muted-foreground/60">Draft restored.</p>
            )}

            <textarea
              className="w-full h-64 bg-card border border-border rounded-sm px-5 py-4 text-foreground text-base leading-relaxed placeholder:text-muted-foreground focus:border-foreground/60 transition"
              placeholder={`Write to ${recipientLabel}…`}
              value={entry}
              onChange={(e) => handleEntryChange(e.target.value)}
            />

            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">{charCount} characters</span>
              <button
                onClick={handleSave}
                disabled={!entry.trim() || saving}
                className="py-3 px-8 border border-foreground text-foreground text-sm tracking-wide disabled:opacity-30 hover:bg-foreground hover:text-background transition"
              >
                {saving ? 'Saving…' : 'Save this letter'}
              </button>
            </div>
          </div>
        )}

        {/* Follow-up */}
        {stage === 'follow-up' && (
          <div className="space-y-6">
            <div className="glass-card px-6 py-5">
              <p className="text-xs text-muted-foreground uppercase tracking-widest mb-3">One more thought</p>
              <p className="font-serif text-foreground text-lg leading-relaxed">{followUp}</p>
            </div>

            <textarea
              className="w-full h-40 bg-card border border-border rounded-sm px-5 py-4 text-foreground text-base leading-relaxed placeholder:text-muted-foreground focus:border-foreground/60 transition"
              placeholder="Add to your entry (optional)…"
              value={followUpAddition}
              onChange={(e) => setFollowUpAddition(e.target.value)}
            />

            <div className="flex gap-3">
              <button
                onClick={() => setStage('done')}
                disabled={saving}
                className="flex-1 py-3 px-6 border border-border text-muted-foreground text-sm tracking-wide hover:border-foreground hover:text-foreground disabled:opacity-30 transition"
              >
                Skip — I&apos;m done
              </button>
              <button
                onClick={async () => {
                  if (!followUpAddition.trim() || !savedEntryId) { setStage('done'); return; }
                  setSaving(true);
                  try {
                    await fetch('/api/save-entry', {
                      method: 'PATCH',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ entryId: savedEntryId, appendContent: followUpAddition }),
                    });
                  } finally {
                    setSaving(false);
                    setStage('done');
                  }
                }}
                disabled={saving}
                className="flex-1 py-3 px-6 border border-foreground text-foreground text-sm tracking-wide disabled:opacity-30 hover:bg-foreground hover:text-background transition"
              >
                {saving ? 'Saving…' : 'Add and finish'}
              </button>
            </div>
          </div>
        )}

        {/* Done */}
        {stage === 'done' && profile && (
          <div className="py-20 text-center space-y-6">
            <div className="w-12 h-px bg-foreground/30 mx-auto" />
            <p className="font-serif text-foreground text-2xl">
              {recipientLabel === 'your family'
                ? 'Your family will have this when the time is right.'
                : `${recipientLabel} will have this when the time is right.`}
            </p>
            {savedAt && (
              <p className="text-xs text-muted-foreground">
                Saved {new Date(savedAt).toLocaleDateString('en-US', {
                  month: 'long', day: 'numeric', year: 'numeric',
                })} at {new Date(savedAt).toLocaleTimeString('en-US', {
                  hour: 'numeric', minute: '2-digit',
                })}
              </p>
            )}
            <div className="flex gap-4 justify-center pt-4">
              <button
                onClick={() => router.push('/archive')}
                className="py-3 px-6 border border-border text-muted-foreground text-sm tracking-wide hover:border-foreground hover:text-foreground transition"
              >
                View archive
              </button>
              <button
                onClick={() => router.push('/')}
                className="py-3 px-6 border border-foreground text-foreground text-sm tracking-wide hover:bg-foreground hover:text-background transition"
              >
                Done
              </button>
            </div>
          </div>
        )}

        {/* Error */}
        {stage === 'error' && (
          <div className="py-20 text-center space-y-4">
            <p className="font-serif text-foreground text-xl">Something went wrong.</p>
            <p className="text-muted-foreground text-sm">Check your connection and try again.</p>
            <button
              onClick={() => { setStage('loading'); setEntry(''); }}
              className="mt-4 py-3 px-6 border border-foreground text-foreground text-sm tracking-wide hover:bg-foreground hover:text-background transition"
            >
              Try again
            </button>
          </div>
        )}

      </div>
    </main>
  );
}

export default function CapturePage() {
  return (
    <ErrorBoundary>
      <CaptureFlow />
    </ErrorBoundary>
  );
}
