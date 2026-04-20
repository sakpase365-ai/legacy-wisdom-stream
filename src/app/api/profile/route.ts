import { NextResponse } from 'next/server';
import { getSessionClient, getServiceClient } from '@/lib/supabase';
import { logger } from '@/lib/logger';
import { assertEnv } from '@/lib/env';

export async function GET() {
  assertEnv();

  const supabase = await getSessionClient();
  const { data: { session } } = await supabase.auth.getSession();

  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const db = getServiceClient();

  const { data: profile, error } = await db
    .from('users')
    .select('id, name, child_name, child_dob')
    .eq('auth_user_id', session.user.id)
    .single();

  if (error && error.code !== 'PGRST116') {
    // PGRST116 = row not found — anything else is a real DB error
    logger.error('profile fetch failed', { route: 'profile GET', code: error.code });
    return NextResponse.json({ error: 'Failed to load profile' }, { status: 500 });
  }

  if (profile) {
    return NextResponse.json({ profile });
  }

  // First login — attempt to create the profile from user_metadata set during signup
  const meta = session.user.user_metadata ?? {};
  const parentName = meta.parent_name as string | undefined;
  const childName  = meta.child_name  as string | undefined;
  const childDob   = meta.child_dob   as string | undefined;

  if (!parentName || !childName || !childDob) {
    logger.warn('profile metadata missing, redirecting to setup', { route: 'profile GET' });
    return NextResponse.json({ error: 'Profile incomplete', needsSetup: true }, { status: 422 });
  }

  const { data: newProfile, error: insertError } = await db
    .from('users')
    .insert({
      auth_user_id: session.user.id,
      name:         parentName,
      child_name:   childName,
      child_dob:    childDob,
    })
    .select('id, name, child_name, child_dob')
    .single();

  if (insertError) {
    logger.error('profile creation failed', { route: 'profile GET', code: insertError.code });
    return NextResponse.json({ error: 'Failed to create profile' }, { status: 500 });
  }

  logger.info('profile created on first login', { route: 'profile GET' });
  return NextResponse.json({ profile: newProfile });
}
