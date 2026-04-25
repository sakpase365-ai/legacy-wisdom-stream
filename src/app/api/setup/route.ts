import { NextRequest, NextResponse } from 'next/server';
import { getSessionClient, getServiceClient } from '@/lib/supabase';

const VALID_ROLES = new Set([
  'parent', 'mother', 'father', 'child', 'son', 'daughter', 'sibling', 'brother', 'sister',
  'wife', 'husband', 'grandparent', 'grandmother', 'grandfather',
]);

interface MemberInput {
  name:            string;
  role:            string;
  customRoleLabel: string | null;
  birthDate:       string | null;
}

export async function POST(req: NextRequest) {
  const supabase = await getSessionClient();
  const { data: { session } } = await supabase.auth.getSession();

  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json();
  const {
    ownerName,
    ownerRole,
    customOwnerRole,
    familyName,
    members,
  }: {
    ownerName:       string;
    ownerRole:       string;
    customOwnerRole: string | null;
    familyName:      string | null;
    members:         MemberInput[];
  } = body;

  if (!ownerName || typeof ownerName !== 'string' || !ownerName.trim()) {
    return NextResponse.json({ error: 'ownerName is required' }, { status: 400 });
  }
  if (!ownerRole || typeof ownerRole !== 'string' || !VALID_ROLES.has(ownerRole)) {
    return NextResponse.json({ error: 'ownerRole is invalid' }, { status: 400 });
  }
  if (Array.isArray(members)) {
    for (const m of members) {
      if (!m.name || !m.name.trim()) {
        return NextResponse.json({ error: 'Each family member requires a name' }, { status: 400 });
      }
      if (!m.role || !VALID_ROLES.has(m.role)) {
        return NextResponse.json({ error: 'Each family member requires a valid role' }, { status: 400 });
      }
      if (m.birthDate) {
        const d = new Date(m.birthDate);
        if (isNaN(d.getTime()) || d > new Date()) {
          return NextResponse.json({ error: 'Invalid birth date for a family member' }, { status: 400 });
        }
      }
    }
  }

  const db = getServiceClient();

  const { data: existing } = await db
    .from('users')
    .select('id')
    .eq('auth_user_id', session.user.id)
    .single();

  if (existing) {
    return NextResponse.json({ error: 'Profile already exists' }, { status: 409 });
  }

  const { data: profile, error: profileError } = await db
    .from('users')
    .insert({
      auth_user_id:      session.user.id,
      name:              ownerName.trim(),
      role:              ownerRole,
      custom_role_label: null,
      family_name:       familyName?.trim() || null,
    })
    .select('id, name, role, family_name')
    .single();

  if (profileError || !profile) {
    console.error('[setup POST] profile insert failed', profileError);
    return NextResponse.json({ error: 'Failed to create profile' }, { status: 500 });
  }

  let familyMembers: unknown[] = [];

  if (Array.isArray(members) && members.length > 0) {
    const { data: insertedMembers, error: memberError } = await db
      .from('family_members')
      .insert(
        members.map((m) => ({
          user_id:           profile.id,
          name:              m.name.trim(),
          role:              m.role,
          custom_role_label: null,
          birth_date:        m.birthDate || null,
        }))
      )
      .select('id, name, role, custom_role_label, birth_date');

    if (memberError) {
      console.error('[setup POST] family_members insert failed', memberError);
    } else {
      familyMembers = insertedMembers ?? [];
    }
  }

  return NextResponse.json({ profile, familyMembers });
}
