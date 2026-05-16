import { NextRequest, NextResponse } from 'next/server';
import { tagEntry, generateFollowUp, generateContextualTags, CONTEXTUAL_TAG_MODEL } from '@/lib/ai';
import { getSessionClient, getServiceClient } from '@/lib/supabase';
import { checkRateLimit } from '@/lib/rate-limit';
import { logger } from '@/lib/logger';
import { assertEnv } from '@/lib/env';
import { differenceInYears, parseISO } from 'date-fns';
import { ALL_WRITABLE_BREADCRUMB_TYPES, type BreadcrumbTypeValue } from '@/lib/breadcrumbs';
import { resolveFamilyAccess, canWriteFamilyContent } from '@/lib/family-access';
import { dedupeTags, mergeBreadcrumbTags } from '@/lib/breadcrumb-tags';

const CONTENT_MAX    = 8_000;
const APPEND_MAX     = 4_000;
const SAVE_LIMIT     = 20;
const SAVE_WINDOW_MS = 60 * 60 * 1000;

const DEFAULT_BREADCRUMB_TYPE: BreadcrumbTypeValue = 'message';

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
          'Retry-After':           String(Math.ceil((resetAt - Date.now()) / 1000)),
          'X-RateLimit-Remaining': '0',
        },
      }
    );
  }

  const body = await req.json();
  const {
    content: rawContent,
    recipientId,
    breadcrumb_type: rawType,
    tags: rawTags,
    title: rawTitle,
    contentType: rawContentType,
    mediaUrl: rawMediaUrl,
  } = body as {
    content:          unknown;
    recipientId?:     string | null;
    breadcrumb_type?: unknown;
    tags?:            unknown;
    title?:           unknown;
    contentType?:     unknown;
    mediaUrl?:        unknown;
  };

  const isAudioPayload =
    rawContentType === 'audio'
    && typeof rawMediaUrl === 'string'
    && /^https?:\/\//i.test(rawMediaUrl.trim());

  const mediaUrl = isAudioPayload ? rawMediaUrl.trim() : null;

  if (typeof rawContent !== 'string') {
    return NextResponse.json({ error: 'content required' }, { status: 400 });
  }
  let trimmedContent = rawContent.trim();
  if (!trimmedContent && !mediaUrl) {
    return NextResponse.json({ error: 'content required' }, { status: 400 });
  }
  if (!trimmedContent && mediaUrl) {
    trimmedContent = 'Voice note — something I want them to hear.';
  }
  if (trimmedContent.length > CONTENT_MAX) {
    return NextResponse.json(
      { error: `content too long (max ${CONTENT_MAX} characters)` },
      { status: 400 }
    );
  }

  const breadcrumbType: BreadcrumbTypeValue =
    typeof rawType === 'string' && ALL_WRITABLE_BREADCRUMB_TYPES.has(rawType)
      ? rawType
      : DEFAULT_BREADCRUMB_TYPE;

  const userKebab = Array.isArray(rawTags)
    ? dedupeTags(rawTags.filter((t): t is string => typeof t === 'string')).slice(0, 8)
    : [];

  const title =
    typeof rawTitle === 'string' && rawTitle.trim()
      ? rawTitle.trim().slice(0, 200)
      : null;

  const db = getServiceClient();

  const access = await resolveFamilyAccess(db, session.user.id);
  if (!access) {
    logger.error('profile lookup failed', { route: 'save-entry POST' });
    return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
  }
  if (!canWriteFamilyContent(access)) {
    return NextResponse.json({ error: 'Not allowed to create breadcrumbs for this family' }, { status: 403 });
  }

  const profile = access.familyProfile;

  let recipientName:    string | null = null;
  let recipientAge                    = 10;
  let validRecipientId: string | null = null;

  if (recipientId && typeof recipientId === 'string') {
    const { data: member } = await db
      .from('family_members')
      .select('name, birth_date')
      .eq('id', recipientId)
      .eq('user_id', access.familyId)
      .single();

    if (member) {
      validRecipientId = recipientId;
      recipientName    = member.name;
      if (member.birth_date) {
        recipientAge = differenceInYears(new Date(), parseISO(member.birth_date));
      }
    }
  } else {
    if (profile.child_name) {
      recipientName = profile.child_name;
      if (profile.child_dob) {
        recipientAge = differenceInYears(new Date(), parseISO(profile.child_dob));
      }
    }
  }

  let aiTags: {
    domain: string;
    relevantAge: number;
    deliveryType: 'age-locked' | 'milestone' | 'evergreen';
    summary: string;
  } = {
    domain:         'identity',
    relevantAge:    Math.max(0, Math.min(100, recipientAge || 18)),
    deliveryType:   'evergreen',
    summary:        '',
  };
  let followUp = '';

  try {
    const [tagsResult, followResult] = await Promise.all([
      tagEntry(trimmedContent, recipientAge),
      generateFollowUp(trimmedContent),
    ]);
    aiTags = tagsResult;
    followUp = followResult;
  } catch (err) {
    logger.warn('save-entry AI summary/follow-up failed; saving with defaults', {
      route: 'save-entry POST',
      parentId: access.familyId,
      error: err instanceof Error ? err.message : String(err),
    });
  }

  try {
    const contextual = await generateContextualTags({
      content: trimmedContent,
      breadcrumbType,
      userSuggestedTags: userKebab.length ? userKebab : undefined,
      recipientRelationHint: recipientName ?? undefined,
    });

    const { tags: finalTags, tagSource } = mergeBreadcrumbTags({
      userTags:       userKebab,
      aiTags:         contextual?.tags ?? null,
      breadcrumbType: breadcrumbType,
    });

    const nowIso = new Date().toISOString();

    // PRIMARY: write to breadcrumbs
    const { data: bcData, error: bcError } = await db
      .from('breadcrumbs')
      .insert({
        parent_id:               access.familyId,
        family_member_id:        validRecipientId,
        author_family_member_id: access.familyMemberId,
        breadcrumb_type:         breadcrumbType,
        content:                 trimmedContent,
        title,
        tags:                    finalTags,
        tag_source:              tagSource,
        ai_tagged_at:            contextual ? nowIso : null,
        ai_tagging_model:        contextual ? CONTEXTUAL_TAG_MODEL : null,
        ai_tagging_confidence:   contextual?.confidence && Object.keys(contextual.confidence).length > 0
          ? contextual.confidence
          : null,
        ai_tagging_reasoning:    contextual?.reasoning_summary?.slice(0, 500) ?? null,
        summary:                 aiTags.summary,
        follow_up:               followUp,
        domain:                  aiTags.domain,
        relevant_age:            aiTags.relevantAge,
        delivery_type:           aiTags.deliveryType,
        ...(mediaUrl
          ? { content_type: 'audio' as const, media_url: mediaUrl }
          : { content_type: 'text' as const, media_url: null }),
      })
      .select('id, created_at, breadcrumb_type, tags, title, tag_source')
      .single();

    if (bcError || !bcData) {
      const detail = bcError?.message ?? 'breadcrumbs insert returned no data';
      const d = detail.toLowerCase();
      const titleMissing = d.includes('title') && (d.includes('column') || d.includes('schema'));
      const mediaMissing =
        (d.includes('content_type') || d.includes('media_url'))
        && (d.includes('column') || d.includes('schema'));
      logger.error('breadcrumbs insert failed', {
        route:    'save-entry POST',
        parentId: access.familyId,
        detail,
        code:     bcError && 'code' in bcError ? String((bcError as { code?: string }).code) : undefined,
      });
      return NextResponse.json(
        {
          error: titleMissing
              ? 'Database is missing the title column. Run supabase_breadcrumbs_add_title.sql in the Supabase SQL editor, then try again.'
              : mediaMissing
                ? 'Database is missing media columns. Run supabase_breadcrumbs_add_media.sql in the Supabase SQL editor, then try again.'
                : 'Failed to save entry',
          detail: process.env.NODE_ENV !== 'production' ? detail : undefined,
        },
        { status: 500 },
      );
    }

    // SECONDARY: legacy entries bridge (non-fatal)
    const { data: legacyEntry } = await db
      .from('entries')
      .insert({
        parent_id:     access.familyId,
        child_name:    recipientName,
        content:       trimmedContent,
        follow_up:     followUp,
        domain:        aiTags.domain,
        relevant_age:  aiTags.relevantAge,
        delivery_type: aiTags.deliveryType,
        summary:       aiTags.summary,
      })
      .select('id')
      .single();

    if (legacyEntry) {
      await db
        .from('breadcrumbs')
        .update({ legacy_entry_id: legacyEntry.id })
        .eq('id', bcData.id);
    }

    logger.info('breadcrumb saved', { route: 'save-entry POST', parentId: access.familyId, remaining });
    return NextResponse.json({ breadcrumb: bcData, followUp });
  } catch (err) {
    logger.error('failed to save breadcrumb', {
      route:    'save-entry POST',
      parentId: access.familyId,
      error:    err instanceof Error ? err.message : String(err),
    });
    return NextResponse.json(
      {
        error:  'Failed to save entry',
        detail: process.env.NODE_ENV !== 'production' && err instanceof Error ? err.message : undefined,
      },
      { status: 500 },
    );
  }
}

export async function PATCH(req: NextRequest) {
  assertEnv();

  const supabase = await getSessionClient();
  const { data: { session } } = await supabase.auth.getSession();

  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json() as {
    breadcrumbId?:   unknown;
    appendContent?:  unknown;
    tags?:           unknown;
  };

  const breadcrumbId =
    typeof body.breadcrumbId === 'string' ? body.breadcrumbId : null;

  if (!breadcrumbId) {
    return NextResponse.json({ error: 'breadcrumbId required' }, { status: 400 });
  }

  const tagPatch   = Array.isArray(body.tags) ? body.tags : undefined;
  const appendRaw  = body.appendContent;

  if (tagPatch !== undefined && appendRaw !== undefined) {
    return NextResponse.json(
      { error: 'Provide either tags or appendContent, not both' },
      { status: 400 }
    );
  }

  const db = getServiceClient();

  const access = await resolveFamilyAccess(db, session.user.id);
  if (!access) {
    return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
  }
  if (!canWriteFamilyContent(access)) {
    return NextResponse.json({ error: 'Not allowed to edit breadcrumbs for this family' }, { status: 403 });
  }

  if (tagPatch !== undefined) {
    const tags = dedupeTags(
      tagPatch.filter((t): t is string => typeof t === 'string'),
    ).slice(0, 8);

    const { error, data } = await db
      .from('breadcrumbs')
      .update({
        tags,
        tag_source: 'user',
        updated_at: new Date().toISOString(),
      })
      .eq('id', breadcrumbId)
      .eq('parent_id', access.familyId)
      .select('id, tags')
      .single();

    if (error || !data) {
      logger.warn('breadcrumb tag update failed', { route: 'save-entry PATCH', parentId: access.familyId });
      return NextResponse.json({ error: 'Breadcrumb not found' }, { status: 404 });
    }

    logger.info('breadcrumb tags updated', { route: 'save-entry PATCH', parentId: access.familyId });
    return NextResponse.json({ ok: true, tags: data.tags ?? tags });
  }

  if (typeof appendRaw !== 'string') {
    return NextResponse.json({ error: 'appendContent or tags required' }, { status: 400 });
  }
  const appendContent = appendRaw;

  if (appendContent.length > APPEND_MAX) {
    return NextResponse.json(
      { error: `appendContent too long (max ${APPEND_MAX} characters)` },
      { status: 400 }
    );
  }

  const { data: bc, error: fetchError } = await db
    .from('breadcrumbs')
    .select('id, content, breadcrumb_type, tags')
    .eq('id', breadcrumbId)
    .eq('parent_id', access.familyId)
    .single();

  if (fetchError || !bc) {
    logger.warn('breadcrumb not found or not owned', { route: 'save-entry PATCH', parentId: access.familyId });
    return NextResponse.json({ error: 'Breadcrumb not found' }, { status: 404 });
  }

  const newContent = `${bc.content}\n\n${appendContent}`;
  const breadcrumbType = typeof bc.breadcrumb_type === 'string' ? bc.breadcrumb_type : DEFAULT_BREADCRUMB_TYPE;
  const priorTags = Array.isArray(bc.tags) ? dedupeTags(bc.tags as string[]) : [];

  let updateRow: Record<string, unknown> = {
    content:    newContent,
    updated_at: new Date().toISOString(),
  };

  try {
    const contextual = await generateContextualTags({
      content:             newContent,
      breadcrumbType,
      userSuggestedTags:   priorTags.length ? priorTags : undefined,
    });
    if (contextual) {
      const { tags: finalTags, tagSource } = mergeBreadcrumbTags({
        userTags:       priorTags,
        aiTags:         contextual.tags,
        breadcrumbType: breadcrumbType,
      });
      const nowIso = new Date().toISOString();
      updateRow = {
        ...updateRow,
        tags:                  finalTags,
        tag_source:            tagSource,
        ai_tagged_at:          nowIso,
        ai_tagging_model:      CONTEXTUAL_TAG_MODEL,
        ai_tagging_confidence: Object.keys(contextual.confidence).length ? contextual.confidence : null,
        ai_tagging_reasoning:  contextual.reasoning_summary.slice(0, 500),
      };
    }
  } catch {
    /* non-fatal; keep text update only */
  }

  const { error } = await db
    .from('breadcrumbs')
    .update(updateRow)
    .eq('id', breadcrumbId);

  if (error) {
    logger.error('failed to append follow-up', {
      route:    'save-entry PATCH',
      parentId: access.familyId,
      error:    error.message,
    });
    return NextResponse.json({ error: 'Failed to update breadcrumb' }, { status: 500 });
  }

  logger.info('follow-up appended', { route: 'save-entry PATCH', parentId: access.familyId });
  return NextResponse.json({ ok: true });
}
