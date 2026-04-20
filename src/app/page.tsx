'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import TypewriterText from '@/components/TypewriterText';

export default function Home() {
  return (
    <main className="min-h-screen w-full bg-background flex flex-col items-center justify-center px-4 py-8">
      <div className="flex flex-col items-center text-center space-y-8">

        {/* Wordmark */}
        <h1 className="text-5xl font-serif font-light tracking-tight text-foreground sm:text-6xl md:text-7xl">
          <TypewriterText text="Breadcrumbs" speed={0.1} showCursor={false} />
          <span className="inline-flex">
            {[0, 1, 2].map((i) => (
              <motion.span
                key={i}
                initial={{ opacity: 0 }}
                animate={{ opacity: [0, 1, 1, 0.4, 1] }}
                transition={{
                  delay: 1.1 + i * 0.3,
                  duration: 2,
                  times: [0, 0.1, 0.5, 0.75, 1],
                  repeat: Infinity,
                  repeatDelay: 0.5,
                }}
              >
                .
              </motion.span>
            ))}
          </span>
        </h1>

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
          <Link
            href="/capture"
            className="w-full py-4 px-8 border border-foreground text-foreground text-sm font-normal tracking-wide text-center hover:bg-foreground hover:text-background transition"
          >
            Write today's letter
          </Link>
          <Link
            href="/archive"
            className="w-full py-4 px-8 text-muted-foreground text-sm font-normal tracking-wide text-center hover:text-foreground transition"
          >
            View your archive
          </Link>
          <Link
            href="/login"
            className="w-full py-2 text-muted-foreground/60 text-xs tracking-wide text-center hover:text-muted-foreground transition"
          >
            Sign in · Create account
          </Link>
        </motion.div>

      </div>
    </main>
  );
}
