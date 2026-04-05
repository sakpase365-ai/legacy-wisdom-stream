-- ============================================================
-- BREADCRUMBS v2 — Supabase Schema
-- Run this in: Supabase Dashboard → SQL Editor → New Query
-- ============================================================

-- Enable UUID generation
create extension if not exists "pgcrypto";

-- ── USERS (parent profiles) ──────────────────────────────────
create table if not exists public.users (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  child_name  text not null,
  child_dob   date not null,
  created_at  timestamptz default now()
);

-- ── ENTRIES ──────────────────────────────────────────────────
create table if not exists public.entries (
  id            uuid primary key default gen_random_uuid(),
  parent_id     text not null,                          -- references users.id (text for demo mode)
  child_name    text not null,
  content       text not null,
  follow_up     text,
  domain        text not null default 'identity',
  relevant_age  integer not null default 18,
  delivery_type text not null default 'evergreen',      -- age-locked | milestone | evergreen
  summary       text not null default '',
  created_at    timestamptz default now(),
  delivered_at  timestamptz
);

-- ── PROMPTS (library for AI to draw from / avoid repeats) ────
create table if not exists public.prompts (
  id                  uuid primary key default gen_random_uuid(),
  category            text not null,
  text                text not null,
  last_used_at        timestamptz,
  effectiveness_score float default 0.0,
  created_at          timestamptz default now()
);

-- ── MILESTONES (Phase 2 — scaffolded now) ────────────────────
create table if not exists public.milestones (
  id           uuid primary key default gen_random_uuid(),
  child_name   text not null,
  parent_id    text not null,
  type         text not null,   -- birthday | graduation | first-job | custom
  target_age   integer,
  triggered_at timestamptz,
  created_at   timestamptz default now()
);

-- ── DELIVERY QUEUE (Phase 2 — scaffolded now) ─────────────────
create table if not exists public.delivery_queue (
  id           uuid primary key default gen_random_uuid(),
  entry_id     uuid references public.entries(id) on delete cascade,
  scheduled_at timestamptz,
  status       text default 'pending',   -- pending | sent | failed
  created_at   timestamptz default now()
);

-- ── ROW LEVEL SECURITY ────────────────────────────────────────
-- For MVP demo mode, RLS is disabled.
-- Enable and configure per-user policies before production launch.
alter table public.users           disable row level security;
alter table public.entries         disable row level security;
alter table public.prompts         disable row level security;
alter table public.milestones      disable row level security;
alter table public.delivery_queue  disable row level security;

-- ── INDEXES ───────────────────────────────────────────────────
create index if not exists idx_entries_parent_id    on public.entries(parent_id);
create index if not exists idx_entries_created_at   on public.entries(created_at desc);
create index if not exists idx_delivery_status      on public.delivery_queue(status);
