import { NextResponse } from 'next/server';
import { getSessionClient, getServiceClient } from '@/lib/supabase';
import { logger } from '@/lib/logger';
import { assertEnv } from '@/lib/env';
import { resolveFamilyAccess } from '@/lib/family-access';

export async function GET() {
  assertEnv();

  const supabase = await getSessionClient();
  const { data: { session } } = await supabase.auth.getSession();

  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const db = getServiceClient();

  const access = await resolveFamilyAccess(db, session.user.id);

  if (!access) {
    logger.error('profile lookup failed', { route: 'entries GET' });
    return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
  }

  const { data, error } = await db
    .from('breadcrumbs')
    .select(
      'id, title, summary, domain, relevant_age, delivery_type, breadcrumb_type, tags, content, content_type, media_url, created_at, delivered_at, author_family_member_id, recipient:family_members!family_member_id(name), author:family_members!author_family_member_id(name)'
    )
    .eq('parent_id', access.familyId)
    .order('created_at', { ascending: false });

  if (error) {
    logger.error('failed to fetch breadcrumbs', { route: 'entries GET', parentId: access.familyId, code: error.code });
    return NextResponse.json({ error: 'Failed to fetch entries' }, { status: 500 });
  }

  const ownerName = access.familyProfile.name;

  const entries = (data ?? []).map((row) => {
    const recipientRaw = row.recipient as { name: string } | { name: string }[] | null;
    const authorRaw    = row.author    as { name: string } | { name: string }[] | null;

    const recipientName = Array.isArray(recipientRaw)
      ? (recipientRaw[0]?.name ?? null)
      : (recipientRaw?.name ?? null);

    const authorName = row.author_family_member_id
      ? (Array.isArray(authorRaw) ? (authorRaw[0]?.name ?? null) : (authorRaw?.name ?? null))
      : ownerName;

    return {
      id:                      row.id,
      title:                   row.title ?? null,
      summary:                 row.summary,
      domain:                  row.domain,
      relevant_age:            row.relevant_age,
      delivery_type:           row.delivery_type,
      breadcrumb_type:         row.breadcrumb_type,
      tags:                    row.tags ?? [],
      content:                 row.content,
      content_type:            (row as { content_type?: string | null }).content_type ?? 'text',
      media_url:               (row as { media_url?: string | null }).media_url ?? null,
      created_at:              row.created_at,
      delivered_at:            row.delivered_at,
      recipient_name:          recipientName,
      author_name:             authorName,
      author_family_member_id: row.author_family_member_id ?? null,
    };
  });

  return NextResponse.json({ entries });
}
