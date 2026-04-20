import { NextRequest, NextResponse } from 'next/server';
import { getSessionClient, getServiceClient } from '@/lib/supabase';

export async function POST(req: NextRequest) {
  const supabase = await getSessionClient();
  const { data: { session } } = await supabase.auth.getSession();

  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { parentName, childName, childDob } = await req.json();

  if (
    !parentName || typeof parentName !== 'string' || !parentName.trim() ||
    !childName  || typeof childName  !== 'string' || !childName.trim()  ||
    !childDob   || typeof childDob   !== 'string'
  ) {
    return NextResponse.json({ error: 'parentName, childName, and childDob are required' }, { status: 400 });
  }

  // Validate childDob is a real date not in the future
  const dob = new Date(childDob);
  if (isNaN(dob.getTime()) || dob > new Date()) {
    return NextResponse.json({ error: 'childDob must be a valid past date' }, { status: 400 });
  }

  const db = getServiceClient();

  // Guard: don't allow creating a second profile for the same user
  const { data: existing } = await db
    .from('users')
    .select('id')
    .eq('auth_user_id', session.user.id)
    .single();

  if (existing) {
    return NextResponse.json({ error: 'Profile already exists' }, { status: 409 });
  }

  const { data: profile, error } = await db
    .from('users')
    .insert({
      auth_user_id: session.user.id,
      name:         parentName.trim(),
      child_name:   childName.trim(),
      child_dob:    childDob,
    })
    .select('id, name, child_name, child_dob')
    .single();

  if (error) {
    console.error('[setup POST]', error);
    return NextResponse.json({ error: 'Failed to create profile' }, { status: 500 });
  }

  return NextResponse.json({ profile });
}
