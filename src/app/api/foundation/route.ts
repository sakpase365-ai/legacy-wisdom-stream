import { NextRequest, NextResponse } from 'next/server';
import { getSessionClient, getServiceClient } from '@/lib/supabase';
import { logger } from '@/lib/logger';
import { assertEnv } from '@/lib/env';
import { resolveFamilyAccess, canWriteFamilyContent } from '@/lib/family-access';
import { VALID_FOUNDATION_KEYS } from '@/lib/breadcrumbs';

const CONTENT_MAX = 4_000;

export async function GET() {
  assertEnv();

  const supabase = await getSessionClient();
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const db = getServiceClient();

  const access = await resolveFamilyAccess(db, session.user.id);

  if (!access) {
    return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
  }

  const { data, error } = await db
    .from('family_foundations')
    .select('category, content, updated_at')
    .eq('user_id', access.familyId);

  if (error) {
    logger.error('failed to fetch foundation', { route: 'foundation GET', code: error.code });
    return NextResponse.json({ error: 'Failed to load foundation' }, { status: 500 });
  }

  const answers: Record<string, { content: string; updated_at: string }> = {};
  for (const row of data ?? []) {
    answers[row.category] = { content: row.content, updated_at: row.updated_at };
  }

  return NextResponse.json({ answers });
}

export async function POST(req: NextRequest) {
  assertEnv();

  const supabase = await getSessionClient();
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const { category, content } = body as { category: unknown; content: unknown };

  if (!category || typeof category !== 'string' || !VALID_FOUNDATION_KEYS.has(category)) {
    return NextResponse.json({ error: 'Invalid category' }, { status: 400 });
  }
  if (typeof content !== 'string') {
    return NextResponse.json({ error: 'content required' }, { status: 400 });
  }
  if (content.length > CONTENT_MAX) {
    return NextResponse.json(
      { error: `content too long (max ${CONTENT_MAX} characters)` },
      { status: 400 }
    );
  }

  const db = getServiceClient();

  const access = await resolveFamilyAccess(db, session.user.id);

  if (!access) {
    return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
  }
  if (!canWriteFamilyContent(access)) {
    return NextResponse.json({ error: 'Not allowed to edit foundation for this family' }, { status: 403 });
  }

  const { error } = await db
    .from('family_foundations')
    .upsert(
      {
        user_id:    access.familyId,
        category,
        content,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,category' }
    );

  if (error) {
    logger.error('failed to save foundation answer', { route: 'foundation POST', code: error.code });
    return NextResponse.json({ error: 'Failed to save answer' }, { status: 500 });
  }

  logger.info('foundation answer saved', { route: 'foundation POST', category });
  return NextResponse.json({ ok: true });
}
