import { NextResponse } from 'next/server';
import { generateDailyPrompt, FALLBACK_PROMPTS } from '@/lib/ai';
import { getSessionClient, getServiceClient } from '@/lib/supabase';
import { checkRateLimit } from '@/lib/rate-limit';
import { logger } from '@/lib/logger';
import { assertEnv } from '@/lib/env';
import { differenceInYears, parseISO } from 'date-fns';
import { DESCENDENT_ROLES } from '@/lib/roles';
import { firstName } from '@/lib/utils';

const RATE_LIMIT     = 30;
const RATE_WINDOW_MS = 60 * 60 * 1000;

export async function POST() {
  assertEnv();

  const supabase = await getSessionClient();
  const { data: { session } } = await supabase.auth.getSession();

  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { allowed, remaining, resetAt } = checkRateLimit(
    `generate-prompt:${session.user.id}`,
    RATE_LIMIT,
    RATE_WINDOW_MS
  );

  if (!allowed) {
    logger.warn('rate limit exceeded', { route: 'generate-prompt', userId: session.user.id });
    return NextResponse.json(
      { error: 'Too many requests. Please wait before generating another prompt.' },
      {
        status: 429,
        headers: {
          'Retry-After':           String(Math.ceil((resetAt - Date.now()) / 1000)),
          'X-RateLimit-Remaining': '0',
        },
      }
    );
  }

  const db = getServiceClient();

  const { data: profile, error: profileError } = await db
    .from('users')
    .select('id, name, role, child_name, child_dob')
    .eq('auth_user_id', session.user.id)
    .single();

  if (profileError || !profile) {
    logger.error('profile lookup failed', { route: 'generate-prompt', code: profileError?.code });
    return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
  }

  // Resolve primary recipient from family_members (descendent roles first, then any member)
  const { data: familyMembers } = await db
    .from('family_members')
    .select('name, role, birth_date')
    .eq('user_id', profile.id)
    .order('created_at', { ascending: true });

  const primary =
    familyMembers?.find((m) => DESCENDENT_ROLES.has(m.role)) ??
    familyMembers?.[0] ??
    null;

  // Fall back to legacy child_name/child_dob if no family members exist yet
  const recipientName = firstName(primary?.name ?? profile.child_name);
  const birthDateStr  = primary?.birth_date ?? profile.child_dob ?? null;
  const recipientAge  = birthDateStr
    ? differenceInYears(new Date(), parseISO(birthDateStr))
    : undefined;

  const { data: recentEntries } = await db
    .from('entries')
    .select('domain')
    .eq('parent_id', profile.id)
    .order('created_at', { ascending: false })
    .limit(5);

  const recentTopics = recentEntries?.map((e: { domain: string }) => e.domain) ?? [];

  try {
    const prompt = await generateDailyPrompt({
      ownerName:      profile.name,
      ownerRole:      profile.role ?? undefined,
      recipientName,
      recipientAge,
      recentTopics,
    });
    logger.info('prompt generated', { route: 'generate-prompt', parentId: profile.id, remaining });
    return NextResponse.json({ prompt });
  } catch (err) {
    const fallback = FALLBACK_PROMPTS[Math.floor(Math.random() * FALLBACK_PROMPTS.length)];
    logger.warn('AI failed, serving fallback prompt', {
      route: 'generate-prompt',
      parentId: profile.id,
      error: err instanceof Error ? err.message : String(err),
    });
    return NextResponse.json({ prompt: fallback });
  }
}
