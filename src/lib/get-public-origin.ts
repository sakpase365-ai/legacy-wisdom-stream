import type { NextRequest } from 'next/server';

/**
 * Origin for post-auth redirects. Use NEXT_PUBLIC_SITE_URL in production so callbacks
 * match your Supabase Site URL and redirect allow-list (avoids broken PKCE cookies when
 * the request URL origin differs from the public URL behind a proxy).
 */
export function getPublicOrigin(request: NextRequest): string {
  const configured = process.env.NEXT_PUBLIC_SITE_URL?.trim().replace(/\/+$/, '');
  if (configured) return configured;

  const forwardedHost = request.headers.get('x-forwarded-host')?.split(',')[0]?.trim();
  const forwardedProto =
    request.headers.get('x-forwarded-proto')?.split(',')[0]?.trim() ?? 'https';
  if (forwardedHost) return `${forwardedProto}://${forwardedHost}`;

  return new URL(request.url).origin;
}

/** Internal navigation only — prevents open redirects. */
export function safeNextPath(next: string | null, fallback = '/capture'): string {
  if (!next || !next.startsWith('/') || next.startsWith('//')) return fallback;
  return next;
}
