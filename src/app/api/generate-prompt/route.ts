import { NextRequest, NextResponse } from 'next/server';
import { generateDailyPrompt, FALLBACK_PROMPTS } from '@/lib/ai';
import { getSessionClient, getServiceClient } from '@/lib/supabase';
import { checkRateLimit } from '@/lib/rate-limit';
import { logger } from '@/lib/logger';
import { assertEnv } from '@/lib/env';
import { differenceInYears, parseISO } from 'date-fns';
import { DESCENDENT_ROLES } from '@/lib/roles';
import { firstName } from '@/lib/nameUtils';
import { resolveFamilyAccess, canWriteFamilyContent } from '@/lib/family-access';

const RATE_LIMIT     = 30;
const RATE_WINDOW_MS = 60 * 60 * 1000;

export async function POST(req: NextRequest) {
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

  // Read optional recipientId from request body
  let recipientId: string | null = null;
  try {
    const body = await req.json();
    if (typeof body?.recipientId === 'string') recipientId = body.recipientId;
  } catch {
    // no body — all-descendants mode
  }

  const db = getServiceClient();

  const access = await resolveFamilyAccess(db, session.user.id);

  if (!access) {
    logger.error('profile lookup failed', { route: 'generate-prompt' });
    return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
  }
  if (!canWriteFamilyContent(access)) {
    return NextResponse.json({ error: 'Not allowed to generate writing prompts for this family' }, { status: 403 });
  }

  const profile = access.familyProfile;

  let recipientName: string | undefined;
  let recipientAge:  number | undefined;

  if (recipientId) {
    // Explicit recipient — verify it belongs to this user before trusting it
    const { data: member } = await db
      .from('family_members')
      .select('name, birth_date')
      .eq('id', recipientId)
      .eq('user_id', profile.id)
      .single();

    if (member) {
      recipientName = firstName(member.name);
      if (member.birth_date) {
        recipientAge = differenceInYears(new Date(), parseISO(member.birth_date));
      }
    }
  } else {
    // All-descendants mode: use collective language
    const { data: descendants } = await db
      .from('family_members')
      .select('role')
      .eq('user_id', profile.id);

    const hasDescendants = descendants?.some((m) => DESCENDENT_ROLES.has(m.role)) ?? false;
    recipientName = hasDescendants ? 'their children' : undefined;
    // no recipientAge in collective mode
  }

  // Legacy fallback: if no family_members at all, use child_name/child_dob from profile
  if (!recipientId && recipientName === undefined && profile.child_name) {
    recipientName = firstName(profile.child_name);
    if (profile.child_dob) {
      recipientAge = differenceInYears(new Date(), parseISO(profile.child_dob));
    }
  }

  const { data: recentEntries } = await db
    .from('breadcrumbs')
    .select('domain')
    .eq('parent_id', profile.id)
    .order('created_at', { ascending: false })
    .limit(5);

  const recentTopics = recentEntries?.map((e: { domain: string }) => e.domain).filter(Boolean) ?? [];

  try {
    const prompt = await generateDailyPrompt({
      ownerName:     profile.name,
      ownerRole:     profile.role ?? undefined,
      recipientName,
      recipientAge,
      recentTopics,
    });
    logger.info('prompt generated', { route: 'generate-prompt', parentId: profile.id, remaining });
    return NextResponse.json({ prompt });
  } catch (err) {
    const fallback = FALLBACK_PROMPTS[Math.floor(Math.random() * FALLBACK_PROMPTS.length)];
    logger.warn('AI failed, serving fallback prompt', {
      route:    'generate-prompt',
      parentId: profile.id,
      error:    err instanceof Error ? err.message : String(err),
    });
    return NextResponse.json({ prompt: fallback });
  }
}
