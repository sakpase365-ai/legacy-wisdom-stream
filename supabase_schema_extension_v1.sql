-- supabase_schema_extension_v1.sql
-- Canonical breadcrumbs table, family_foundations, extended tables, RLS hardening.
-- Safe to apply: all dropped tables are confirmed 0 rows and unreferenced by live app.

BEGIN;

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. DROP dead legacy schema (all 0 rows, not used by live app)
--    CASCADE cleans up dependent FK constraints and policies automatically.
-- ─────────────────────────────────────────────────────────────────────────────
DROP TABLE IF EXISTS public.breadcrumb_recipients  CASCADE;
DROP TABLE IF EXISTS public.breadcrumb_scriptures  CASCADE;
DROP TABLE IF EXISTS public.breadcrumbs            CASCADE;
DROP TABLE IF EXISTS public.recipients             CASCADE;
DROP TABLE IF EXISTS public.families               CASCADE;
DROP TABLE IF EXISTS public.profiles               CASCADE;
DROP TABLE IF EXISTS public.creator_achievements   CASCADE;
DROP TABLE IF EXISTS public.creator_streaks        CASCADE;
DROP TABLE IF EXISTS public.weekly_challenges      CASCADE;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. ENUM: breadcrumb_type
-- ─────────────────────────────────────────────────────────────────────────────
DO $$ BEGIN
  CREATE TYPE public.breadcrumb_type AS ENUM (
    'letter', 'wisdom', 'answer', 'memory', 'lesson', 'story', 'reflection', 'guidance'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. CANONICAL TABLE: breadcrumbs
--    parent_id  → users.id   (the author)
--    family_member_id → family_members.id   (the intended recipient)
--    legacy_entry_id  → entries.id   (bridge for Shama's existing entry)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE public.breadcrumbs (
  id                       uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_id                uuid        NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  family_member_id         uuid        REFERENCES public.family_members(id) ON DELETE SET NULL,
  breadcrumb_type          public.breadcrumb_type NOT NULL DEFAULT 'letter',

  -- Content
  content                  text        NOT NULL,
  summary                  text,
  follow_up                text,
  transcript               text,

  -- AI classification
  domain                   text,
  relevant_age             integer,
  delivery_type            text,
  is_agent_approved        boolean     NOT NULL DEFAULT false,
  is_foundation_breadcrumb boolean     NOT NULL DEFAULT false,
  foundation_category      text,

  -- Delivery linkage
  prompt_id                uuid        REFERENCES public.prompts(id) ON DELETE SET NULL,
  delivered_at             timestamptz,

  -- Legacy bridge (entries row from before breadcrumbs table existed)
  legacy_entry_id          uuid        REFERENCES public.entries(id) ON DELETE SET NULL,

  created_at               timestamptz NOT NULL DEFAULT now(),
  updated_at               timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_breadcrumbs_parent_id     ON public.breadcrumbs(parent_id);
CREATE INDEX idx_breadcrumbs_family_member ON public.breadcrumbs(family_member_id)
  WHERE family_member_id IS NOT NULL;

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. TABLE: family_foundations
--    One row per (user, category) — the family's operating system.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE public.family_foundations (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid        NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  category    text        NOT NULL,
  content     text        NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, category)
);

CREATE INDEX idx_family_foundations_user ON public.family_foundations(user_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. EXTEND: prompts
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.prompts
  ADD COLUMN IF NOT EXISTS is_foundation_prompt boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS foundation_category  text,
  ADD COLUMN IF NOT EXISTS prompt_type          text    NOT NULL DEFAULT 'capture';

-- Enable RLS (was disabled)
ALTER TABLE public.prompts ENABLE ROW LEVEL SECURITY;

-- Prompts are read-only for all authenticated users (seeded by platform, not user-created)
CREATE POLICY "prompts_authenticated_select" ON public.prompts
  FOR SELECT USING (auth.role() = 'authenticated');

-- ─────────────────────────────────────────────────────────────────────────────
-- 6. EXTEND: delivery_queue
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.delivery_queue
  ADD COLUMN IF NOT EXISTS breadcrumb_id uuid REFERENCES public.breadcrumbs(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS prompt_id     uuid REFERENCES public.prompts(id)     ON DELETE SET NULL;

COMMENT ON COLUMN public.delivery_queue.entry_id IS
  'Legacy: references entries table. Use breadcrumb_id for all new rows.';

-- ─────────────────────────────────────────────────────────────────────────────
-- 7. EXTEND: questions
--    recipient_id FK to recipients was dropped with CASCADE above.
--    Add family_id and creator_id so questions belong to a family context.
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.questions
  ADD COLUMN IF NOT EXISTS family_id   uuid REFERENCES public.users(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS creator_id  uuid REFERENCES public.users(id) ON DELETE SET NULL;

-- ─────────────────────────────────────────────────────────────────────────────
-- 8. RLS: New tables
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.breadcrumbs        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.family_foundations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "breadcrumbs_owner_all" ON public.breadcrumbs
  FOR ALL USING (
    parent_id IN (SELECT id FROM public.users WHERE auth_user_id = auth.uid())
  );

CREATE POLICY "family_foundations_owner_all" ON public.family_foundations
  FOR ALL USING (
    user_id IN (SELECT id FROM public.users WHERE auth_user_id = auth.uid())
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- 9. RLS GAPS: Missing DELETE policies on existing live tables
-- ─────────────────────────────────────────────────────────────────────────────
CREATE POLICY "entries_owner_delete" ON public.entries
  FOR DELETE USING (
    parent_id IN (SELECT id FROM public.users WHERE auth_user_id = auth.uid())
  );

CREATE POLICY "delivery_queue_owner_delete" ON public.delivery_queue
  FOR DELETE USING (
    entry_id IN (
      SELECT e.id FROM public.entries e
      JOIN public.users u ON u.id = e.parent_id
      WHERE u.auth_user_id = auth.uid()
    )
  );

CREATE POLICY "users_self_delete" ON public.users
  FOR DELETE USING (auth_user_id = auth.uid());

CREATE POLICY "milestones_owner_delete" ON public.milestones
  FOR DELETE USING (
    parent_id IN (SELECT id FROM public.users WHERE auth_user_id = auth.uid())
  );

-- questions: owner can SELECT via creator_id
CREATE POLICY "questions_owner_select" ON public.questions
  FOR SELECT USING (
    creator_id IN (SELECT id FROM public.users WHERE auth_user_id = auth.uid())
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- 10. CLEANUP: Remove duplicate family_members policies from onboarding_v3
--     The hardening migration already wrote the canonical versions.
-- ─────────────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Family owners can delete members"                      ON public.family_members;
DROP POLICY IF EXISTS "Users can insert themselves or owners can insert members" ON public.family_members;
DROP POLICY IF EXISTS "Users can view family members in their families"        ON public.family_members;

COMMIT;
