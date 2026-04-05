import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import type { Entry, Domain } from '@/types/entries';

const DEMO_PARENT_ID = 'demo-parent-001';

const DOMAIN_COLORS: Record<Domain, string> = {
  relationships: 'bg-rose-50 text-rose-700 border-rose-200',
  finances:      'bg-emerald-50 text-emerald-700 border-emerald-200',
  resilience:    'bg-amber-50 text-amber-700 border-amber-200',
  career:        'bg-blue-50 text-blue-700 border-blue-200',
  identity:      'bg-purple-50 text-purple-700 border-purple-200',
  faith:         'bg-sky-50 text-sky-700 border-sky-200',
  health:        'bg-teal-50 text-teal-700 border-teal-200',
};

const DELIVERY_LABELS: Record<string, string> = {
  'age-locked': 'Age-locked',
  'milestone':  'Milestone',
  'evergreen':  'Evergreen',
};

type EntryCard = Pick<Entry, 'id' | 'summary' | 'domain' | 'relevant_age' | 'delivery_type' | 'created_at' | 'delivered_at'>;

export default function Archive() {
  const navigate = useNavigate();
  const [entries, setEntries] = useState<EntryCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const { data, error } = await supabase
          .from('entries')
          .select('id, summary, domain, relevant_age, delivery_type, created_at, delivered_at')
          .eq('parent_id', DEMO_PARENT_ID)
          .order('created_at', { ascending: false });

        if (error) throw error;
        setEntries((data ?? []) as EntryCard[]);
      } catch {
        setError(true);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <main className="min-h-screen bg-warm px-6 py-16">
      <div className="max-w-xl mx-auto space-y-8">

        {/* Header */}
        <div className="flex items-center justify-between">
          <button
            onClick={() => navigate('/')}
            className="text-sm text-muted hover:text-navy transition-colors"
          >
            ← Back
          </button>
          <h1 className="text-lg font-semibold text-navy tracking-tight">Your Archive</h1>
          <button
            onClick={() => navigate('/capture')}
            className="text-sm font-semibold text-gold hover:opacity-80 transition-opacity"
          >
            + New entry
          </button>
        </div>

        <div className="w-full h-px bg-gold opacity-40" />

        {/* States */}
        {loading && (
          <p className="text-muted text-sm text-center animate-pulse py-12">Loading your letters…</p>
        )}

        {error && (
          <p className="text-muted text-sm text-center py-12">Failed to load. Check your connection.</p>
        )}

        {!loading && !error && entries.length === 0 && (
          <div className="text-center py-20 space-y-4">
            <p className="text-navy text-xl font-serif">No letters yet.</p>
            <p className="text-muted text-sm">Your first entry is one prompt away.</p>
            <button
              onClick={() => navigate('/capture')}
              className="mt-4 inline-block py-3 px-8 bg-navy text-warm text-sm font-semibold rounded-sm"
            >
              Write today's letter
            </button>
          </div>
        )}

        {/* Entry cards */}
        {!loading && entries.length > 0 && (
          <div className="space-y-4">
            <p className="text-xs text-muted uppercase tracking-widest">
              {entries.length} {entries.length === 1 ? 'letter' : 'letters'} saved
            </p>
            {entries.map((e) => (
              <div
                key={e.id}
                className="bg-white border border-gray-200 rounded-sm px-5 py-4 space-y-3"
              >
                <p className="text-navy text-base leading-relaxed">{e.summary}</p>

                <div className="flex flex-wrap gap-2 items-center">
                  <span className={`text-xs px-2 py-0.5 rounded-sm border font-medium ${DOMAIN_COLORS[e.domain as Domain] ?? 'bg-gray-50 text-gray-600 border-gray-200'}`}>
                    {e.domain}
                  </span>
                  <span className="text-xs px-2 py-0.5 rounded-sm border border-gray-200 text-muted bg-gray-50">
                    {DELIVERY_LABELS[e.delivery_type] ?? e.delivery_type} · Age {e.relevant_age}
                  </span>
                  {e.delivered_at && (
                    <span className="text-xs px-2 py-0.5 rounded-sm border border-emerald-200 text-emerald-700 bg-emerald-50">
                      Delivered
                    </span>
                  )}
                </div>

                <p className="text-xs text-muted">
                  {new Date(e.created_at).toLocaleDateString('en-US', {
                    month: 'long', day: 'numeric', year: 'numeric',
                  })}
                </p>
              </div>
            ))}
          </div>
        )}

      </div>
    </main>
  );
}
