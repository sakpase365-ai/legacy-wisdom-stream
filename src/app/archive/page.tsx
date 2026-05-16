'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getBrowserSupabase } from '@/lib/supabase-browser';
import { BREADCRUMB_TYPE_LABEL } from '@/lib/breadcrumbs';
import { formatTagForDisplay } from '@/lib/breadcrumb-tags';

const DOMAIN_COLORS: Record<string, string> = {
  relationships: 'border-rose-800 text-rose-400',
  finances:      'border-emerald-800 text-emerald-400',
  resilience:    'border-amber-800 text-amber-400',
  career:        'border-blue-800 text-blue-400',
  identity:      'border-purple-800 text-purple-400',
  faith:         'border-sky-800 text-sky-400',
  health:        'border-teal-800 text-teal-400',
};

const DELIVERY_LABELS: Record<string, string> = {
  'age-locked': 'Age-locked',
  'milestone':  'Milestone',
  'evergreen':  'Evergreen',
};

interface EntryCard {
  id:              string;
  title:           string | null;
  summary:         string;
  content:         string;
  content_type:    string;
  media_url:       string | null;
  domain:          string;
  relevant_age:    number;
  delivery_type:   string;
  breadcrumb_type: string;
  tags:            string[];
  created_at:      string;
  delivered_at?:   string;
  recipient_name:  string | null;
}

export default function ArchivePage() {
  const router = useRouter();
  const [entries,    setEntries]    = useState<EntryCard[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [error,      setError]      = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/entries');
        if (res.status === 401) { router.push('/login?next=/archive'); return; }
        if (!res.ok) { setError(true); return; }
        const data = await res.json();
        setEntries(data.entries ?? []);
      } catch {
        setError(true);
      } finally {
        setLoading(false);
      }
    })();
  }, [router]);

  function toggleExpand(id: string) {
    setExpandedId((prev) => (prev === id ? null : id));
  }

  return (
    <main className="min-h-screen bg-background px-6 py-14">
      <div className="max-w-xl mx-auto space-y-8">

        {/* Header */}
        <div className="flex items-center justify-between">
          <button onClick={() => router.push('/')} className="text-sm text-muted-foreground hover:text-foreground transition">
            ← Back
          </button>
          <h1 className="font-serif text-lg text-foreground tracking-tight">Family Library</h1>
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.push('/capture')}
              className="text-sm text-muted-foreground hover:text-foreground transition"
            >
              + New
            </button>
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
        </div>

        <div className="w-full h-px bg-border" />

        {loading && (
          <p className="text-muted-foreground text-sm text-center animate-pulse py-12">Loading your letters…</p>
        )}

        {error && (
          <p className="text-muted-foreground text-sm text-center py-12">Failed to load. Check your connection.</p>
        )}

        {!loading && !error && entries.length === 0 && (
          <div className="text-center py-20 space-y-4">
            <p className="font-serif text-foreground text-2xl">No letters yet.</p>
            <p className="text-muted-foreground text-sm">Your first entry is one prompt away.</p>
            <button
              onClick={() => router.push('/capture')}
              className="mt-4 inline-block py-3 px-8 border border-foreground text-foreground text-sm tracking-wide hover:bg-foreground hover:text-background transition"
            >
              Leave A Breadcrumb
            </button>
          </div>
        )}

        {!loading && entries.length > 0 && (
          <div className="space-y-4">
            <p className="text-xs text-muted-foreground uppercase tracking-widest">
              {entries.length} {entries.length === 1 ? 'breadcrumb' : 'breadcrumbs'} saved
            </p>
            {entries.map((e) => {
              const isExpanded = expandedId === e.id;
              const typeLabel  = BREADCRUMB_TYPE_LABEL[e.breadcrumb_type] ?? e.breadcrumb_type;
              const isAudio    = e.content_type === 'audio' && e.media_url;
              const hasBody    = !!(e.content?.trim()) || isAudio;
              return (
                <div key={e.id} className="glass-card px-5 py-4 space-y-3">

                  {/* Title or summary */}
                  {e.title && (
                    <p className="text-foreground text-sm font-medium tracking-wide">{e.title}</p>
                  )}
                  <p className="text-foreground text-base leading-relaxed">{e.summary}</p>

                  {/* Full letter */}
                  {isExpanded && hasBody && (
                    <div className="border-t border-border pt-4 mt-1 space-y-4">
                      {isAudio && e.media_url ? (
                        <audio src={e.media_url} controls className="w-full" preload="metadata" />
                      ) : null}
                      {e.content?.trim() ? (
                        <p className="text-foreground text-sm leading-loose whitespace-pre-wrap">{e.content}</p>
                      ) : null}
                    </div>
                  )}

                  {/* Badges row */}
                  <div className="flex flex-wrap gap-2 items-center">
                    {e.recipient_name && (
                      <span className="text-xs px-2 py-0.5 border border-border text-muted-foreground rounded-sm">
                        For {e.recipient_name.split(' ')[0]}
                      </span>
                    )}
                    <span className="text-xs px-2 py-0.5 border border-border text-muted-foreground rounded-sm">
                      {typeLabel}
                    </span>
                    <span className={`text-xs px-2 py-0.5 border rounded-sm font-medium ${DOMAIN_COLORS[e.domain] ?? 'border-border text-muted-foreground'}`}>
                      {e.domain}
                    </span>
                    <span className="text-xs px-2 py-0.5 border border-border text-muted-foreground rounded-sm">
                      {DELIVERY_LABELS[e.delivery_type]} · Age {e.relevant_age}
                    </span>
                    {e.delivered_at && (
                      <span className="text-xs px-2 py-0.5 border border-emerald-800 text-emerald-400 rounded-sm">
                        Delivered
                      </span>
                    )}
                  </div>

                  {/* Context tags */}
                  {e.tags && e.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {e.tags.map((tag) => (
                        <span key={tag} className="text-xs px-2 py-0.5 border border-border/50 text-muted-foreground/60 rounded-sm">
                          {formatTagForDisplay(tag)}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Footer */}
                  <div className="flex items-center justify-between">
                    <p className="text-xs text-muted-foreground">
                      {new Date(e.created_at).toLocaleDateString('en-US', {
                        month: 'long', day: 'numeric', year: 'numeric',
                      })}
                    </p>
                    {hasBody && (
                      <button
                        onClick={() => toggleExpand(e.id)}
                        className="text-xs text-muted-foreground hover:text-foreground transition"
                      >
                        {isExpanded
                          ? 'Hide ↑'
                          : isAudio
                            ? 'Listen ↓'
                            : 'Read letter ↓'}
                      </button>
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
