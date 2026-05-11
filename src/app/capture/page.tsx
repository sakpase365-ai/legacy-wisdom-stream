'use client';

import { useState, useEffect, useRef, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { motion } from 'framer-motion';
import { getBrowserSupabase } from '@/lib/supabase-browser';
import ErrorBoundary from '@/components/ErrorBoundary';
import { DESCENDENT_ROLES } from '@/lib/roles';
import { firstName } from '@/lib/nameUtils';
import { BREADCRUMB_TYPES, VALUE_TAGS } from '@/lib/breadcrumbs';
import { formatTagForDisplay } from '@/lib/breadcrumb-tags';

const DRAFT_KEY    = 'breadcrumbs_draft';
const PREFILL_KEY  = 'breadcrumbs_prefill';

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

function collectiveLabel(members: FamilyMember[]): string {
  const descendants = members.filter((m) => DESCENDENT_ROLES.has(m.role));
  if (descendants.length === 0) return 'your family';
  return 'your children';
}

async function fetchPrompt(recipientId: string | null, excludePriorPrompts?: string[]): Promise<string> {
  const body: Record<string, unknown> = { recipientId };
  if (excludePriorPrompts?.length) body.excludePriorPrompts = excludePriorPrompts;

  const res = await fetch('/api/generate-prompt', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error('prompt fetch failed');
  const { prompt } = await res.json();
  return prompt as string;
}

function CaptureFlow() {
  const router = useRouter();

  const [profile,             setProfile]            = useState<Profile | null>(null);
  const [familyMembers,       setFamilyMembers]      = useState<FamilyMember[]>([]);
  const [selectedRecipient,   setSelectedRecipient]  = useState<FamilyMember | null>(null);
  const [breadcrumbType,      setBreadcrumbType]     = useState<string>('letter');
  const [selectedTags,        setSelectedTags]       = useState<string[]>([]);
  const [showTags,            setShowTags]           = useState(false);
  const [promptLoading,       setPromptLoading]      = useState(false);
  const [stage,               setStage]              = useState<Stage>('loading');
  const [prompt,              setPrompt]             = useState('');
  const [entry,               setEntry]              = useState('');
  const [followUp,            setFollowUp]           = useState('');
  const [followUpAddition,    setFollowUpAddition]   = useState('');
  const [savedBreadcrumbId,   setSavedBreadcrumbId]  = useState<string | null>(null);
  const [savedAt,             setSavedAt]            = useState<string | null>(null);
  const [savedTags,          setSavedTags]         = useState<string[]>([]);
  const [tagEditorOpen,       setTagEditorOpen]      = useState(false);
  const [tagDraft,            setTagDraft]           = useState('');
  const [tagSaving,           setTagSaving]          = useState(false);
  const [saving,              setSaving]             = useState(false);
  const [charCount,           setCharCount]          = useState(0);
  const [draftRestored,       setDraftRestored]      = useState(false);
  const [prefillRestored,     setPrefillRestored]    = useState(false);
  const autosaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const recentPromptsRef = useRef<string[]>([]);

  function excludePriorPromptsForFetch(currentPrompt: string): string[] | undefined {
    const seen  = new Set<string>();
    const out: string[] = [];
    for (const t of recentPromptsRef.current) {
      const s = t.trim();
      if (s && !seen.has(s)) {
        seen.add(s);
        out.push(s);
      }
    }
    const cur = currentPrompt.trim();
    if (cur && !seen.has(cur)) out.push(cur);
    const slice = out.slice(-5);
    return slice.length ? slice : undefined;
  }

  // Restore draft or prefill from Foundation
  useEffect(() => {
    const prefillRaw = localStorage.getItem(PREFILL_KEY);
    if (prefillRaw) {
      try {
        const prefill = JSON.parse(prefillRaw) as {
          content?: string;
          breadcrumbType?: string;
        };
        if (prefill.content) {
          setEntry(prefill.content);
          setCharCount(prefill.content.length);
          setPrefillRestored(true);
        }
        if (prefill.breadcrumbType) setBreadcrumbType(prefill.breadcrumbType);
        localStorage.removeItem(PREFILL_KEY);
        localStorage.removeItem(DRAFT_KEY);
        return;
      } catch { /* ignore */ }
    }

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

        const dailyPrompt = await fetchPrompt(null);
        setPrompt(dailyPrompt);
        recentPromptsRef.current = [dailyPrompt];

        setStage(localStorage.getItem(DRAFT_KEY) || localStorage.getItem(PREFILL_KEY) ? 'writing' : 'prompted');
      } catch {
        setStage('error');
      }
    })();
  }, [router]);

  async function handleRecipientSelect(member: FamilyMember | null) {
    setSelectedRecipient(member);
    if (stage === 'prompted') {
      setPromptLoading(true);
      try {
        const newPrompt = await fetchPrompt(member?.id ?? null, excludePriorPromptsForFetch(prompt));
        setPrompt(newPrompt);
        recentPromptsRef.current = [...recentPromptsRef.current, newPrompt].slice(-8);
      } catch { /* keep existing prompt */ }
      finally { setPromptLoading(false); }
    }
  }

  async function handleNewPrompt() {
    if (promptLoading) return;
    setPromptLoading(true);
    try {
      const next = await fetchPrompt(selectedRecipient?.id ?? null, excludePriorPromptsForFetch(prompt));
      setPrompt(next);
      recentPromptsRef.current = [...recentPromptsRef.current, next].slice(-8);
    } catch { /* keep existing prompt */ }
    finally {
      setPromptLoading(false);
    }
  }

  function toggleTag(tag: string) {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  }

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
        body: JSON.stringify({
          content:         entry,
          recipientId:     selectedRecipient?.id ?? null,
          breadcrumb_type: breadcrumbType,
          tags:            selectedTags,
        }),
      });
      if (!res.ok) { setStage('error'); return; }
      const data = await res.json();
      setFollowUp(data.followUp);
      setSavedBreadcrumbId(data.breadcrumb.id);
      setSavedAt(data.breadcrumb.created_at ?? new Date().toISOString());
      setSavedTags(Array.isArray(data.breadcrumb.tags) ? data.breadcrumb.tags : []);
      setTagEditorOpen(false);
      localStorage.removeItem(DRAFT_KEY);
      setStage('follow-up');
    } catch {
      setStage('error');
    } finally {
      setSaving(false);
    }
  }

  const recipientLabel = selectedRecipient
    ? firstName(selectedRecipient.name)
    : collectiveLabel(familyMembers);

  async function saveTagsEdit() {
    if (!savedBreadcrumbId || tagSaving) return;
    const parts = tagDraft
      .split(/[,\n]+/)
      .map((s) => s.trim())
      .filter(Boolean);
    setTagSaving(true);
    try {
      const res = await fetch('/api/save-entry', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ breadcrumbId: savedBreadcrumbId, tags: parts }),
      });
      if (!res.ok) return;
      const data = (await res.json()) as { tags?: string[] };
      setSavedTags(Array.isArray(data.tags) ? data.tags : parts);
      setTagEditorOpen(false);
    } finally {
      setTagSaving(false);
    }
  }

  const doneLine = selectedRecipient
    ? `${firstName(selectedRecipient.name)} will have this when the time is right.`
    : `${collectiveLabel(familyMembers) === 'your family' ? 'Your family' : 'Your children'} will have this when the time is right.`;

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
              const supabase = getBrowserSupabase();
              if (supabase) await supabase.auth.signOut();
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
            <p className="text-muted-foreground text-sm">
              Preparing today&apos;s prompt
              <span className="inline-flex">
                {[0, 1, 2].map((i) => (
                  <motion.span
                    key={i}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: [0, 1, 1, 0.4, 1] }}
                    transition={{
                      delay: i * 0.3,
                      duration: 1.5,
                      times: [0, 0.1, 0.5, 0.75, 1],
                      repeat: Infinity,
                      repeatDelay: 0.5,
                    }}
                  >
                    .
                  </motion.span>
                ))}
              </span>
            </p>
          </div>
        )}

        {/* Prompt + Writing */}
        {(stage === 'prompted' || stage === 'writing') && profile && (
          <div className="space-y-6">

            {/* Recipient selector */}
            {familyMembers.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground uppercase tracking-widest">Writing for</p>
                <div className="flex gap-2 flex-wrap">
                  <button
                    onClick={() => handleRecipientSelect(null)}
                    disabled={promptLoading}
                    className={`px-4 py-1.5 text-sm border rounded-sm transition disabled:opacity-50 ${
                      !selectedRecipient
                        ? 'border-foreground bg-foreground text-background'
                        : 'border-border text-muted-foreground hover:border-foreground hover:text-foreground'
                    }`}
                  >
                    Everyone
                  </button>
                  {familyMembers.map((m) => (
                    <button
                      key={m.id}
                      onClick={() => handleRecipientSelect(m)}
                      disabled={promptLoading}
                      className={`px-4 py-1.5 text-sm border rounded-sm transition disabled:opacity-50 ${
                        selectedRecipient?.id === m.id
                          ? 'border-foreground bg-foreground text-background'
                          : 'border-border text-muted-foreground hover:border-foreground hover:text-foreground'
                      }`}
                    >
                      {firstName(m.name)}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Type selector */}
            <div className="flex items-center gap-3">
              <span className="text-xs text-muted-foreground uppercase tracking-widest shrink-0">Type</span>
              <select
                value={breadcrumbType}
                onChange={(e) => setBreadcrumbType(e.target.value)}
                className="bg-transparent border border-border px-3 py-1.5 text-foreground text-xs focus:border-foreground/60 transition rounded-sm outline-none cursor-pointer"
              >
                {BREADCRUMB_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>

            {/* Prompt */}
            <div className="border-l-2 border-foreground/30 pl-5 py-1 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
              <div className="min-w-0 flex-1">
                {promptLoading
                  ? <p className="text-muted-foreground text-sm">
                      Refreshing prompt
                      <span className="inline-flex">
                        {[0, 1, 2].map((i) => (
                          <motion.span
                            key={i}
                            initial={{ opacity: 0 }}
                            animate={{ opacity: [0, 1, 1, 0.4, 1] }}
                            transition={{
                              delay: i * 0.3,
                              duration: 1.5,
                              times: [0, 0.1, 0.5, 0.75, 1],
                              repeat: Infinity,
                              repeatDelay: 0.5,
                            }}
                          >
                            .
                          </motion.span>
                        ))}
                      </span>
                    </p>
                  : <p className="font-serif text-foreground text-xl leading-relaxed">{prompt}</p>
                }
              </div>
              <button
                type="button"
                onClick={() => void handleNewPrompt()}
                disabled={promptLoading}
                className="shrink-0 text-xs uppercase tracking-widest px-3 py-2 border border-border rounded-sm text-muted-foreground hover:text-foreground hover:border-foreground/40 transition disabled:opacity-50 disabled:pointer-events-none"
              >
                New prompt
              </button>
            </div>

            {draftRestored && (
              <p className="text-xs text-muted-foreground/60">Draft restored.</p>
            )}
            {prefillRestored && (
              <p className="text-xs text-muted-foreground/60">From your Family Foundation.</p>
            )}

            <textarea
              className="w-full h-64 bg-card border border-border rounded-sm px-5 py-4 text-foreground text-base leading-relaxed placeholder:text-muted-foreground focus:border-foreground/60 transition"
              placeholder={`Write to ${recipientLabel}…`}
              value={entry}
              onChange={(e) => handleEntryChange(e.target.value)}
            />

            {/* Tags */}
            <div className="space-y-3">
              <p className="text-xs text-muted-foreground/70">
                Tags are organized automatically when you save. Optional hints below can guide the AI.
              </p>
              <button
                type="button"
                onClick={() => setShowTags(!showTags)}
                className="text-xs text-muted-foreground hover:text-foreground transition"
              >
                {showTags ? '− Hide optional tag hints' : '+ Optional tag hints before save'}
              </button>
              {showTags && (
                <div className="flex flex-wrap gap-2">
                  {VALUE_TAGS.map((tag) => (
                    <button
                      key={tag}
                      onClick={() => toggleTag(tag)}
                      className={`px-3 py-1 text-xs border rounded-sm transition ${
                        selectedTags.includes(tag)
                          ? 'border-foreground text-foreground bg-foreground/5'
                          : 'border-border text-muted-foreground hover:border-foreground/40 hover:text-foreground'
                      }`}
                    >
                      {tag}
                    </button>
                  ))}
                </div>
              )}
            </div>

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
            {savedTags.length > 0 && (
              <div className="space-y-3 rounded-sm border border-border/60 bg-card/30 px-4 py-3">
                <p className="text-sm text-foreground">
                  <span className="text-muted-foreground">Saved with tags: </span>
                  {savedTags.map((t, i) => (
                    <span key={t}>
                      {i > 0 ? ', ' : ''}
                      {formatTagForDisplay(t)}
                    </span>
                  ))}
                </p>
                {!tagEditorOpen ? (
                  <button
                    type="button"
                    onClick={() => {
                      setTagDraft(savedTags.join(', '));
                      setTagEditorOpen(true);
                    }}
                    className="text-xs uppercase tracking-widest text-muted-foreground hover:text-foreground transition"
                  >
                    Edit tags
                  </button>
                ) : (
                  <div className="space-y-2">
                    <label htmlFor="tag-draft" className="sr-only">Edit tags</label>
                    <input
                      id="tag-draft"
                      value={tagDraft}
                      onChange={(e) => setTagDraft(e.target.value)}
                      className="w-full bg-card border border-border rounded-sm px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-foreground/60 outline-none"
                      placeholder="parenting, gratitude, life-lesson"
                    />
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => void saveTagsEdit()}
                        disabled={tagSaving}
                        className="text-xs px-3 py-1.5 border border-foreground text-foreground rounded-sm disabled:opacity-40"
                      >
                        {tagSaving ? 'Saving…' : 'Save tags'}
                      </button>
                      <button
                        type="button"
                        onClick={() => { setTagEditorOpen(false); }}
                        className="text-xs px-3 py-1.5 border border-border text-muted-foreground rounded-sm"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

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
                  if (!followUpAddition.trim() || !savedBreadcrumbId) { setStage('done'); return; }
                  setSaving(true);
                  try {
                    await fetch('/api/save-entry', {
                      method: 'PATCH',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ breadcrumbId: savedBreadcrumbId, appendContent: followUpAddition }),
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
            <p className="font-serif text-foreground text-2xl">{doneLine}</p>
            {savedTags.length > 0 && (
              <div className="space-y-3 max-w-md mx-auto text-left rounded-sm border border-border/60 bg-card/30 px-4 py-3">
                <p className="text-sm text-foreground">
                  <span className="text-muted-foreground">Tags: </span>
                  {savedTags.map((t, i) => (
                    <span key={t}>
                      {i > 0 ? ', ' : ''}
                      {formatTagForDisplay(t)}
                    </span>
                  ))}
                </p>
                {!tagEditorOpen ? (
                  <button
                    type="button"
                    onClick={() => {
                      setTagDraft(savedTags.join(', '));
                      setTagEditorOpen(true);
                    }}
                    className="text-xs uppercase tracking-widest text-muted-foreground hover:text-foreground transition"
                  >
                    Edit tags
                  </button>
                ) : (
                  <div className="space-y-2">
                    <label htmlFor="tag-draft-done" className="sr-only">Edit tags</label>
                    <input
                      id="tag-draft-done"
                      value={tagDraft}
                      onChange={(e) => setTagDraft(e.target.value)}
                      className="w-full bg-card border border-border rounded-sm px-3 py-2 text-sm text-foreground outline-none"
                      placeholder="parenting, gratitude, life-lesson"
                    />
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => void saveTagsEdit()}
                        disabled={tagSaving}
                        className="text-xs px-3 py-1.5 border border-foreground text-foreground rounded-sm disabled:opacity-40"
                      >
                        {tagSaving ? 'Saving…' : 'Save tags'}
                      </button>
                      <button
                        type="button"
                        onClick={() => setTagEditorOpen(false)}
                        className="text-xs px-3 py-1.5 border border-border text-muted-foreground rounded-sm"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
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
                Family Library
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

/**
 * Magic links must hit /auth/callback so exchangeCodeForSession runs.
 * If Supabase Site URL (or a template) sends ?code= to /capture, we forward here.
 */
function CompleteMagicLinkFromCapture({ code }: { code: string }) {
  const router = useRouter();
  useEffect(() => {
    router.replace(
      `/auth/callback?code=${encodeURIComponent(code)}&next=${encodeURIComponent('/capture')}`
    );
  }, [code, router]);
  return (
    <main className="min-h-screen bg-background flex flex-col items-center justify-center px-6">
      <p className="text-muted-foreground text-sm">Completing sign-in…</p>
    </main>
  );
}

function CapturePageGate() {
  const searchParams = useSearchParams();
  const code           = searchParams.get('code');
  if (code) {
    return <CompleteMagicLinkFromCapture code={code} />;
  }
  return <CaptureFlow />;
}

export default function CapturePage() {
  return (
    <ErrorBoundary>
      <Suspense
        fallback={(
          <main className="min-h-screen bg-background flex flex-col items-center justify-center px-6">
            <p className="text-muted-foreground text-sm">Loading…</p>
          </main>
        )}
      >
        <CapturePageGate />
      </Suspense>
    </ErrorBoundary>
  );
}
