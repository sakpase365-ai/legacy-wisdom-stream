import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';

type Stage = 'loading' | 'prompted' | 'writing' | 'follow-up' | 'done' | 'error';

// ── Demo profile — replace with Supabase auth session in production ──
const DEMO_PROFILE = {
  parentId:   'demo-parent-001',
  parentName: 'Sak',
  childName:  'Cairo',
  childDob:   '2014-01-01',
};

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;

export default function Capture() {
  const navigate = useNavigate();
  const [stage,     setStage]     = useState<Stage>('loading');
  const [prompt,    setPrompt]    = useState('');
  const [entry,     setEntry]     = useState('');
  const [followUp,  setFollowUp]  = useState('');
  const [saving,    setSaving]    = useState(false);
  const [charCount, setCharCount] = useState(0);

  // ── Load daily prompt on mount ──────────────────────────────
  useEffect(() => {
    (async () => {
      try {
        const { data, error } = await supabase.functions.invoke('generate-prompt', {
          body: DEMO_PROFILE,
        });
        if (error) throw error;
        setPrompt(data.prompt);
        setStage('prompted');
      } catch {
        setStage('error');
      }
    })();
  }, []);

  // ── Save entry → receive follow-up ──────────────────────────
  async function handleSave() {
    if (!entry.trim() || saving) return;
    setSaving(true);
    try {
      const { data, error } = await supabase.functions.invoke('save-entry', {
        body: {
          parentId:  DEMO_PROFILE.parentId,
          childName: DEMO_PROFILE.childName,
          childDob:  DEMO_PROFILE.childDob,
          content:   entry,
        },
      });
      if (error) throw error;
      setFollowUp(data.followUp);
      setStage('follow-up');
    } catch {
      setStage('error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="min-h-screen bg-warm flex flex-col items-center justify-start px-6 py-16">
      <div className="max-w-xl w-full space-y-8">

        {/* Header */}
        <div className="flex items-center justify-between">
          <button
            onClick={() => navigate('/')}
            className="text-sm text-muted hover:text-navy transition-colors"
          >
            ← Back
          </button>
          <span className="text-xs text-muted uppercase tracking-widest">
            {new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
          </span>
        </div>

        {/* Loading */}
        {stage === 'loading' && (
          <div className="py-24 text-center">
            <p className="text-muted text-sm animate-pulse">Preparing today's prompt…</p>
          </div>
        )}

        {/* Prompt + Writing area */}
        {(stage === 'prompted' || stage === 'writing') && (
          <div className="space-y-6">
            <div className="border-l-4 border-gold pl-5 py-1">
              <p className="text-navy text-xl font-serif leading-relaxed">{prompt}</p>
            </div>

            <textarea
              className="w-full h-64 bg-white border border-gray-200 rounded-sm px-5 py-4 text-navy text-base leading-relaxed placeholder:text-gray-300 focus:border-gold focus:outline-none transition-colors"
              placeholder={`Write to ${DEMO_PROFILE.childName}…`}
              value={entry}
              onChange={(e) => {
                setEntry(e.target.value);
                setCharCount(e.target.value.length);
                if (stage === 'prompted') setStage('writing');
              }}
            />

            <div className="flex items-center justify-between">
              <span className="text-xs text-muted">{charCount} characters</span>
              <button
                onClick={handleSave}
                disabled={!entry.trim() || saving}
                className="py-3 px-8 bg-navy text-warm text-sm font-semibold rounded-sm disabled:opacity-40 hover:opacity-90 transition-opacity"
              >
                {saving ? 'Saving…' : 'Save this letter'}
              </button>
            </div>
          </div>
        )}

        {/* Follow-up stage */}
        {stage === 'follow-up' && (
          <div className="space-y-6">
            <div className="bg-white border border-gray-200 rounded-sm px-6 py-5">
              <p className="text-xs text-muted uppercase tracking-widest mb-3">One more thought</p>
              <p className="text-navy text-lg font-serif leading-relaxed">{followUp}</p>
            </div>

            <textarea
              className="w-full h-40 bg-white border border-gray-200 rounded-sm px-5 py-4 text-navy text-base leading-relaxed placeholder:text-gray-300 focus:border-gold focus:outline-none transition-colors"
              placeholder="Add to your entry (optional)…"
            />

            <div className="flex gap-3">
              <button
                onClick={() => setStage('done')}
                className="flex-1 py-3 px-6 border border-navy text-navy text-sm font-semibold rounded-sm hover:bg-navy hover:text-warm transition-colors"
              >
                Skip — I'm done
              </button>
              <button
                onClick={() => setStage('done')}
                className="flex-1 py-3 px-6 bg-navy text-warm text-sm font-semibold rounded-sm hover:opacity-90 transition-opacity"
              >
                Add and finish
              </button>
            </div>
          </div>
        )}

        {/* Done state */}
        {stage === 'done' && (
          <div className="py-16 text-center space-y-6">
            <div className="w-12 h-0.5 bg-gold mx-auto" />
            <p className="text-navy text-2xl font-serif">
              {DEMO_PROFILE.childName} will have this when the time is right.
            </p>
            <p className="text-muted text-sm">Your entry has been saved and filed.</p>
            <div className="flex gap-4 justify-center pt-4">
              <button
                onClick={() => navigate('/archive')}
                className="py-3 px-6 border border-navy text-navy text-sm font-semibold rounded-sm hover:bg-navy hover:text-warm transition-colors"
              >
                View archive
              </button>
              <button
                onClick={() => navigate('/')}
                className="py-3 px-6 bg-navy text-warm text-sm font-semibold rounded-sm"
              >
                Done
              </button>
            </div>
          </div>
        )}

        {/* Error state */}
        {stage === 'error' && (
          <div className="py-16 text-center space-y-4">
            <p className="text-navy text-lg">Something went wrong.</p>
            <p className="text-muted text-sm">Check your API keys and Supabase connection.</p>
            <button
              onClick={() => { setStage('loading'); setEntry(''); }}
              className="mt-4 py-3 px-6 bg-navy text-warm text-sm font-semibold rounded-sm"
            >
              Try again
            </button>
          </div>
        )}

      </div>
    </main>
  );
}
