import { NextRequest, NextResponse } from 'next/server';
import { getSessionClient, getServiceClient } from '@/lib/supabase';
import { assertEnv } from '@/lib/env';
import { logger } from '@/lib/logger';
import { randomUUID } from 'crypto';

const BUCKET   = 'breadcrumb-voice';
const MAX_BYTES = 6 * 1024 * 1024; // ~6 MB

export async function POST(req: NextRequest) {
  assertEnv();

  const supabase = await getSessionClient();
  const { data: { session } } = await supabase.auth.getSession();

  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: { audioBase64?: unknown; mimeType?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const b64 = typeof body.audioBase64 === 'string' ? body.audioBase64 : '';
  const mime = typeof body.mimeType === 'string' && body.mimeType.startsWith('audio/')
    ? body.mimeType
    : 'audio/webm';

  if (!b64.trim()) {
    return NextResponse.json({ error: 'audioBase64 required' }, { status: 400 });
  }

  let buffer: Buffer;
  try {
    buffer = Buffer.from(b64, 'base64');
  } catch {
    return NextResponse.json({ error: 'Invalid base64' }, { status: 400 });
  }

  if (buffer.length === 0 || buffer.length > MAX_BYTES) {
    return NextResponse.json({ error: 'Recording too large or empty' }, { status: 413 });
  }

  const ext =
    mime.includes('webm') ? 'webm'
    : mime.includes('mp4') || mime.includes('m4a') ? 'm4a'
    : mime.includes('mpeg') || mime.includes('mp3') ? 'mp3'
    : mime.includes('wav') ? 'wav'
    : 'webm';

  const path = `${session.user.id}/${randomUUID()}.${ext}`;
  const admin = getServiceClient();

  const { error: upError } = await admin.storage
    .from(BUCKET)
    .upload(path, buffer, { contentType: mime, upsert: false });

  if (upError) {
    logger.error('voice upload failed', {
      route: 'upload-voice',
      message: upError.message,
    });
    return NextResponse.json(
      {
        error:
          'Could not store recording. Create the `breadcrumb-voice` storage bucket in Supabase (see supabase_storage_breadcrumb_voice.sql) or try again.',
      },
      { status: 502 },
    );
  }

  const { data: pub } = admin.storage.from(BUCKET).getPublicUrl(path);
  const url = pub?.publicUrl;
  if (!url) {
    return NextResponse.json({ error: 'Upload succeeded but public URL missing' }, { status: 500 });
  }

  return NextResponse.json({ url });
}
