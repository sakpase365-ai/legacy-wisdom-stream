-- ============================================================
-- BREADCRUMBS v2 — Foundation Migration (Phase 1 Auth)
-- Run this AFTER supabase_schema.sql in Supabase SQL Editor.
-- This migration links the users table to auth.users,
-- migrates entries.parent_id to uuid, and enables RLS.
-- ============================================================

-- ── 1. Link users table to auth.users ────────────────────────
-- Add auth_user_id as the primary identity anchor.
-- Existing rows (demo data) will have NULL auth_user_id
-- and will be effectively orphaned — this is intentional.

alter table public.users
  add column if not exists auth_user_id uuid
    references auth.users(id) on delete cascade;

create unique index if not exists idx_users_auth_user_id
  on public.users(auth_user_id);

-- ── 2. Migrate entries.parent_id from text → uuid ─────────────
-- entries.parent_id must reference a real user uuid going forward.
-- Delete orphaned demo rows first, then cast to uuid.

delete from public.entries
  where parent_id not in (
    select id::text from public.users where auth_user_id is not null
  );

alter table public.entries
  alter column parent_id type uuid using parent_id::uuid;

alter table public.entries
  add constraint entries_parent_id_fkey
    foreign key (parent_id) references public.users(id) on delete cascade;

-- ── 3. Enable RLS on core tables ─────────────────────────────
alter table public.users    enable row level security;
alter table public.entries  enable row level security;

-- ── 4. RLS policies: users ────────────────────────────────────

create policy "users: owner select"
  on public.users for select
  using (auth_user_id = auth.uid());

create policy "users: owner insert"
  on public.users for insert
  with check (auth_user_id = auth.uid());

create policy "users: owner update"
  on public.users for update
  using (auth_user_id = auth.uid())
  with check (auth_user_id = auth.uid());

-- ── 5. RLS policies: entries ──────────────────────────────────
-- Join through users to confirm the calling user owns the parent profile.

create policy "entries: owner select"
  on public.entries for select
  using (
    parent_id in (
      select id from public.users where auth_user_id = auth.uid()
    )
  );

create policy "entries: owner insert"
  on public.entries for insert
  with check (
    parent_id in (
      select id from public.users where auth_user_id = auth.uid()
    )
  );

create policy "entries: owner update"
  on public.entries for update
  using (
    parent_id in (
      select id from public.users where auth_user_id = auth.uid()
    )
  );

-- ── 6. prompts: service-role only ────────────────────────────
-- Platform data; no user-facing writes. RLS stays off.

-- ── 7. Phase 2 tables: leave RLS disabled ────────────────────
-- milestones and delivery_queue are Phase 2. Leave as-is.
