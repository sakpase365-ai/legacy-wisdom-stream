import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { logger } from '@/lib/logger';
import { getPublicOrigin, safeNextPath } from '@/lib/get-public-origin';
import type { EmailOtpType } from '@supabase/auth-js';
import type { ResponseCookie } from 'next/dist/compiled/@edge-runtime/cookies';

const EMAIL_OTP_TYPES = new Set<string>([
  'signup',
  'invite',
  'magiclink',
  'recovery',
  'email_change',
  'email',
]);

function parseEmailOtpType(raw: string | null): EmailOtpType | null {
  if (!raw || !EMAIL_OTP_TYPES.has(raw)) return null;
  return raw as EmailOtpType;
}

function makeSupabase(
  cookieStore: Awaited<ReturnType<typeof cookies>>,
  pendingCookies: Array<{ name: string; value: string; options: Partial<ResponseCookie> }>,
) {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          pendingCookies.push(...cookiesToSet);
        },
      },
    },
  );
}

function redirectWithSessionCookies(
  location: string,
  pendingCookies: Array<{ name: string; value: string; options: Partial<ResponseCookie> }>,
) {
  const response = NextResponse.redirect(location);
  pendingCookies.forEach(({ name, value, options }) => {
    response.cookies.set(name, value, options);
  });
  return response;
}

export async function GET(request: NextRequest) {
  const origin = getPublicOrigin(request);
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const tokenHash = searchParams.get('token_hash');
  const typeRaw = searchParams.get('type');
  const next = safeNextPath(searchParams.get('next'));
  const supabaseError = searchParams.get('error');
  const supabaseErrorDesc = searchParams.get('error_description');

  if (supabaseError) {
    logger.warn('auth callback supabase error', {
      route: 'auth/callback',
      supabaseError,
      supabaseErrorDesc,
    });
    const msg = encodeURIComponent(supabaseErrorDesc ?? supabaseError);
    return NextResponse.redirect(`${origin}/login?error=link_error&msg=${msg}`);
  }

  const cookieStore = await cookies();
  const pendingCookies: Array<{ name: string; value: string; options: Partial<ResponseCookie> }> = [];
  const supabase = makeSupabase(cookieStore, pendingCookies);

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (error) {
      logger.error('auth code exchange failed', {
        route: 'auth/callback',
        errorName: error.name,
        errorMessage: error.message,
        status: error.status,
      });
      return NextResponse.redirect(`${origin}/login?error=auth_failed`);
    }

    logger.info('auth callback success (pkce)', { route: 'auth/callback', next });
    return redirectWithSessionCookies(`${origin}${next}`, pendingCookies);
  }

  const otpType = parseEmailOtpType(typeRaw);
  if (tokenHash && otpType) {
    const { error } = await supabase.auth.verifyOtp({
      type: otpType,
      token_hash: tokenHash,
    });

    if (error) {
      logger.error('auth verifyOtp failed', {
        route: 'auth/callback',
        errorName: error.name,
        errorMessage: error.message,
        status: error.status,
      });
      return NextResponse.redirect(`${origin}/login?error=auth_failed`);
    }

    logger.info('auth callback success (token_hash)', { route: 'auth/callback', next, otpType });
    return redirectWithSessionCookies(`${origin}${next}`, pendingCookies);
  }

  logger.warn('auth callback missing code and token_hash', { route: 'auth/callback' });
  return NextResponse.redirect(`${origin}/login?error=missing_code`);
}
