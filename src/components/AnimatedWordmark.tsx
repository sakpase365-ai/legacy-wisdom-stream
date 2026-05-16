'use client';

import { useEffect, useLayoutEffect, useState } from 'react';

const WORD = 'Breadcrumbs';

type Props = {
  /** Tailwind classes for visual scale (default matches login / signup). */
  className?: string;
};

/**
 * Typewriter + pulsing dots without Framer Motion so the effect survives
 * production hydration and isn’t collapsed by `prefers-reduced-motion` defaults
 * in some motion libraries.
 */
export default function AnimatedWordmark({
  className = 'text-4xl sm:text-5xl font-serif font-light tracking-tight text-foreground',
}: Props) {
  const [visibleCount, setVisibleCount] = useState(0);
  const [reducedMotion, setReducedMotion] = useState(false);

  useLayoutEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (mq.matches) {
      setReducedMotion(true);
      setVisibleCount(WORD.length);
    }
  }, []);

  useEffect(() => {
    if (reducedMotion) return;
    if (visibleCount >= WORD.length) return;
    const delay = visibleCount === 0 ? 140 : 82;
    const id = window.setTimeout(() => {
      setVisibleCount((c) => Math.min(c + 1, WORD.length));
    }, delay);
    return () => clearTimeout(id);
  }, [reducedMotion, visibleCount]);

  const showDots = visibleCount >= WORD.length;

  return (
    <h1 className={className}>
      <span className="inline-block min-h-[1.15em]">{WORD.slice(0, visibleCount)}</span>
      {showDots ? (
        <span className="inline-flex select-none" aria-hidden>
          {[0, 1, 2].map((d) => (
            <span
              key={d}
              className="wordmark-dot"
              style={{ animationDelay: `${0.28 + d * 0.24}s` }}
            >
              .
            </span>
          ))}
        </span>
      ) : null}
    </h1>
  );
}
