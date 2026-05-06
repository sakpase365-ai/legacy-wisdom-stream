import { NextRequest, NextResponse } from 'next/server';
import { getServiceClient } from '@/lib/supabase';
import { logger } from '@/lib/logger';
import { hashInviteToken } from '@/lib/invite-token';

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ token: string }> }
) {
  const { token } = await context.params;
  const db = getServiceClient();

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const { note } = body;

  const { data: invite } = await db
    .from('family_invitations')
    .select('id, status, expires_at')
    .eq('invite_token', hashInviteToken(token))
    .single();

  if (!invite) {
    return NextResponse.json({ error: 'Invite not found' }, { status: 404 });
  }

  if (invite.status !== 'pending') {
    return NextResponse.json({ error: 'This invitation is no longer valid.' }, { status: 410 });
  }

  if (new Date(invite.expires_at as string) < new Date()) {
    return NextResponse.json({ error: 'This invitation has expired.' }, { status: 410 });
  }

  const correctionNote =
    typeof note === 'string' ? note.trim().slice(0, 1000) || null : null;

  const { error } = await db
    .from('family_invitations')
    .update({
      status:          'correction_requested',
      correction_note: correctionNote,
      updated_at:      new Date().toISOString(),
    })
    .eq('id', invite.id);

  if (error) {
    logger.error('invite correction failed', {
      route:    'invite/[token]/correction',
      inviteId: invite.id,
    });
    return NextResponse.json({ error: 'Failed to submit correction request' }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
