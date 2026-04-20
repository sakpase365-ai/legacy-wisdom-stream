-- ============================================================
-- BREADCRUMBS v2 — Phase 2 Table Hardening
-- Run AFTER supabase_schema_v2.sql has been applied.
-- Safe to run on empty Phase 2 tables only.
-- ============================================================

-- ── RATIONALE ────────────────────────────────────────────────
-- milestones and delivery_queue were scaffolded for Phase 2 with
-- weak ownership (parent_id as text, no FK, no RLS). These tables
-- hold sensitive future delivery intent and must be hardened now,
-- before any real data lands in them.
--
-- prompts is platform-owned content. No user writes are intended.
-- RLS stays disabled. Service role is the only writer.
-- ─────────────────────────────────────────────────────────────


-- ── 1. milestones: fix parent_id type and add FK ─────────────
-- parent_id was text (legacy demo). Cast to uuid and add FK.
-- Assumes table is empty (Phase 2, no production data yet).

alter table public.milestones
  alter column parent_id type uuid using parent_id::uuid;

alter table public.milestones
  add constraint milestones_parent_id_fkey
    foreign key (parent_id) references public.users(id) on delete cascade;

-- ── 2. milestones: enable RLS ────────────────────────────────

alter table public.milestones enable row level security;

create policy "milestones: owner select"
  on public.milestones for select
  using (
    parent_id in (
      select id from public.users where auth_user_id = auth.uid()
    )
  );

create policy "milestones: owner insert"
  on public.milestones for insert
  with check (
    parent_id in (
      select id from public.users where auth_user_id = auth.uid()
    )
  );

create policy "milestones: owner update"
  on public.milestones for update
  using (
    parent_id in (
      select id from public.users where auth_user_id = auth.uid()
    )
  );

-- ── 3. delivery_queue: enable RLS ────────────────────────────
-- delivery_queue has no direct owner column.
-- Ownership is enforced by joining through entries → users.
-- Only the parent who owns the entry may see or modify its queue row.

alter table public.delivery_queue enable row level security;

create policy "delivery_queue: owner select"
  on public.delivery_queue for select
  using (
    entry_id in (
      select e.id from public.entries e
      join public.users u on u.id = e.parent_id
      where u.auth_user_id = auth.uid()
    )
  );

create policy "delivery_queue: owner insert"
  on public.delivery_queue for insert
  with check (
    entry_id in (
      select e.id from public.entries e
      join public.users u on u.id = e.parent_id
      where u.auth_user_id = auth.uid()
    )
  );

create policy "delivery_queue: owner update"
  on public.delivery_queue for update
  using (
    entry_id in (
      select e.id from public.entries e
      join public.users u on u.id = e.parent_id
      where u.auth_user_id = auth.uid()
    )
  );

-- ── 4. prompts: leave RLS disabled (platform data) ───────────
-- prompts contains platform-curated writing prompts.
-- No user creates or edits rows. Only the service role writes here.
-- Reads are platform-internal (via service role in API routes).
-- RLS-off is intentional and appropriate for this table.
-- If user-facing prompt browsing is added in future, enable RLS then.

-- ── 5. Indexes for new FK ─────────────────────────────────────
create index if not exists idx_milestones_parent_id
  on public.milestones(parent_id);
