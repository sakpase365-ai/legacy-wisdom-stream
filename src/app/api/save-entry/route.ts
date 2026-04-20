import { NextRequest, NextResponse } from 'next/server';
import { tagEntry, generateFollowUp } from '@/lib/ai';
import { getSessionClient, getServiceClient } from '@/lib/supabase';
import { checkRateLimit } from '@/lib/rate-limit';
import { logger } from '@/lib/logger';
import { assertEnv } from '@/lib/env';
import { differenceInYears, parseISO } from 'date-fns';

const CONTENT_MAX     = 8_000;   // ~1,500 words — generous for a letter
const APPEND_MAX      = 4_000;
const SAVE_LIMIT      = 20;      // saves per user per hour
const SAVE_WINDOW_MS  = 60 * 60 * 1000;

export async function POST(req: NextRequest) {
  assertEnv();

  const supabase = await getSessionClient();
  const { data: { session } } = await supabase.auth.getSession();

  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { allowed, remaining, resetAt } = checkRateLimit(
    `save-entry:${session.user.id}`,
    SAVE_LIMIT,
    SAVE_WINDOW_MS
  );

  if (!allowed) {
    logger.warn('rate limit exceeded', { route: 'save-entry POST', userId: session.user.id });
    return NextResponse.json(
      { error: 'Too many entries saved recently. Please wait before saving again.' },
      {
        status: 429,
        headers: {
          'Retry-After':          String(Math.ceil((resetAt - Date.now()) / 1000)),
          'X-RateLimit-Remaining': '0',
        },
      }
    );
  }

  const { content } = await req.json();

  if (!content || typeof content !== 'string' || !content.trim()) {
    return NextResponse.json({ error: 'content required' }, { status: 400 });
  }

  if (content.length > CONTENT_MAX) {
    return NextResponse.json(
      { error: `content too long (max ${CONTENT_MAX} characters)` },
      { status: 400 }
    );
  }

  const db = getServiceClient();

  const { data: profile, error: profileError } = await db
    .from('users')
    .select('id, child_name, child_dob')
    .eq('auth_user_id', session.user.id)
    .single();

  if (profileError || !profile) {
    logger.error('profile lookup failed', { route: 'save-entry POST', code: profileError?.code });
    return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
  }

  const childAge = differenceInYears(new Date(), parseISO(profile.child_dob));

  try {
    const [tags, followUp] = await Promise.all([
      tagEntry(content, childAge),
      generateFollowUp(content),
    ]);

    const { data, error } = await db
      .from('entries')
      .insert({
        parent_id:     profile.id,
        child_name:    profile.child_name,
        content,
        follow_up:     followUp,
        domain:        tags.domain,
        relevant_age:  tags.relevantAge,
        delivery_type: tags.deliveryType,
        summary:       tags.summary,
      })
      .select()
      .single();

    if (error) throw error;

    logger.info('entry saved', { route: 'save-entry POST', parentId: profile.id, remaining });
    return NextResponse.json({ entry: data, followUp });
  } catch (err) {
    logger.error('failed to save entry', {
      route: 'save-entry POST',
      parentId: profile.id,
      error: err instanceof Error ? err.message : String(err),
    });
    return NextResponse.json({ error: 'Failed to save entry' }, { status: 500 });
  }
}

// Append follow-up addition to an existing entry.
// Ownership verified: entry must belong to the calling user's profile.
export async function PATCH(req: NextRequest) {
  assertEnv();

  const supabase = await getSessionClient();
  const { data: { session } } = await supabase.auth.getSession();

  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { entryId, appendContent } = await req.json();

  if (!entryId || !appendContent || typeof appendContent !== 'string') {
    return NextResponse.json({ error: 'entryId and appendContent required' }, { status: 400 });
  }

  if (appendContent.length > APPEND_MAX) {
    return NextResponse.json(
      { error: `appendContent too long (max ${APPEND_MAX} characters)` },
      { status: 400 }
    );
  }

  const db = getServiceClient();

  const { data: profile } = await db
    .from('users')
    .select('id')
    .eq('auth_user_id', session.user.id)
    .single();

  if (!profile) {
    return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
  }

  const { data: existing, error: fetchError } = await db
    .from('entries')
    .select('content')
    .eq('id', entryId)
    .eq('parent_id', profile.id)  // ownership check
    .single();

  if (fetchError || !existing) {
    logger.warn('entry not found or not owned', { route: 'save-entry PATCH', parentId: profile.id });
    return NextResponse.json({ error: 'Entry not found' }, { status: 404 });
  }

  const { error } = await db
    .from('entries')
    .update({ content: `${existing.content}\n\n${appendContent}` })
    .eq('id', entryId)
    .eq('parent_id', profile.id);

  if (error) {
    logger.error('failed to append follow-up', {
      route: 'save-entry PATCH',
      parentId: profile.id,
      error: error.message,
    });
    return NextResponse.json({ error: 'Failed to update entry' }, { status: 500 });
  }

  logger.info('follow-up appended', { route: 'save-entry PATCH', parentId: profile.id });
  return NextResponse.json({ ok: true });
}
