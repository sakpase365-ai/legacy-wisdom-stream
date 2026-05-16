'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { getBrowserSupabase } from '@/lib/supabase-browser';
import AnimatedWordmark from '@/components/AnimatedWordmark';
import TypewriterText from '@/components/TypewriterText';

type AuthState = 'loading' | 'unauthenticated' | 'authenticated';

export default function Home() {
  const [authState, setAuthState] = useState<AuthState>('loading');
  const [foundationComplete, setFoundationComplete] = useState(false);

  useEffect(() => {
    const supabase = getBrowserSupabase();
    if (!supabase) {
      setAuthState('unauthenticated');
      return;
    }

    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setAuthState('unauthenticated');
        return;
      }

      try {
        const res = await fetch('/api/foundation');
        if (res.ok) {
          const { answers } = await res.json() as {
            answers: Record<string, { content: string } | null>;
          };
          const answeredCount = Object.values(answers).filter(
            (v) => v?.content?.trim()
          ).length;
          setFoundationComplete(answeredCount >= 6);
        }
      } catch {
        // non-fatal — show setup prompt by default
      }
      setAuthState('authenticated');
    })();
  }, []);

  return (
    <main className="min-h-screen w-full bg-background flex flex-col items-center justify-center px-4 py-8">
      <div className="flex flex-col items-center text-center space-y-8">

        {/* Wordmark */}
        <AnimatedWordmark className="text-5xl font-serif font-light tracking-tight text-foreground sm:text-6xl md:text-7xl" />

        {/* Tagline */}
        <p className="max-w-md text-base font-light text-muted-foreground sm:text-lg">
          <TypewriterText
            text="Leave something that lasts."
            delay={0.8}
            speed={0.04}
          />
        </p>

        {/* CTAs */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 2.4, duration: 0.5 }}
          className="flex flex-col gap-3 w-full max-w-xs pt-2"
        >
          {/* Primary — capture layer */}
          <Link
            href="/capture"
            className="w-full py-4 px-8 border border-foreground text-foreground text-sm font-normal tracking-wide text-center hover:bg-foreground hover:text-background transition"
          >
            Leave A Breadcrumb
          </Link>

          {/* Primary — guidance layer */}
          <Link
            href="/ask"
            className="w-full py-4 px-8 border border-border text-muted-foreground text-sm font-normal tracking-wide text-center hover:border-foreground/40 hover:text-foreground transition"
          >
            Ask the Family Agent
          </Link>

          {/* Identity layer — only shown when setup is incomplete */}
          {authState === 'authenticated' && !foundationComplete && (
            <Link
              href="/foundation"
              className="w-full py-3 px-8 text-xs text-muted-foreground/70 tracking-wide text-center border border-dashed border-border/60 hover:text-foreground hover:border-border transition"
            >
              Complete your Family Foundation →
            </Link>
          )}

          {/* Memory layer — secondary, never dominant */}
          <Link
            href="/archive"
            className="w-full py-2 text-muted-foreground/60 text-xs tracking-wide text-center hover:text-muted-foreground transition"
          >
            Family Library
          </Link>

          {/* Auth — only when not signed in */}
          {authState !== 'authenticated' && (
            <Link
              href="/login"
              className="w-full py-2 text-muted-foreground/60 text-xs tracking-wide text-center hover:text-muted-foreground transition"
            >
              Sign in · Create account
            </Link>
          )}
        </motion.div>

      </div>
    </main>
  );
}
