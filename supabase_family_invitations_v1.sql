-- ============================================================
-- BREADCRUMBS v2 — Family Invitation Flow (v1)
-- Run AFTER supabase_schema_extension_v1.sql
-- Additive-only except for the family_members role CHECK
-- constraint (expanded to include spouse, co_parent) and
-- the family_members SELECT RLS policy (extended for invitees).
-- ============================================================

BEGIN;

-- ─────────────────────────────────────────────────────────────
-- 1. EXTEND: family_members
--    linked_user_id   — invitee's public.users.id (null until accepted)
--    app_permission_role — owner | admin | contributor | recipient
--    status           — active | invited | removed
-- ─────────────────────────────────────────────────────────────

ALTER TABLE public.family_members
  ADD COLUMN IF NOT EXISTS linked_user_id      uuid
    REFERENCES public.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS app_permission_role  text NOT NULL DEFAULT 'contributor'
    CHECK (app_permission_role IN ('owner','admin','contributor','recipient')),
  ADD COLUMN IF NOT EXISTS status              text NOT NULL DEFAULT 'active'
    CHECK (status IN ('active','invited','removed'));

CREATE INDEX IF NOT EXISTS idx_family_members_linked_user_id
  ON public.family_members(linked_user_id)
  WHERE linked_user_id IS NOT NULL;

-- Expand the role CHECK constraint to include spouse and co_parent.
ALTER TABLE public.family_members DROP CONSTRAINT IF EXISTS family_members_role_check;
ALTER TABLE public.family_members
  ADD CONSTRAINT family_members_role_check
    CHECK (role IN (
      'parent','mother','father','child','son','daughter',
      'sibling','brother','sister','wife','husband',
      'grandparent','grandmother','grandfather',
      'spouse','co_parent'
    ));

-- ─────────────────────────────────────────────────────────────
-- 2. CREATE: family_invitations
-- ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.family_invitations (
  id                   uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  -- family_id references the owner's users.id (no separate families table)
  family_id            uuid        NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  family_member_id     uuid        REFERENCES public.family_members(id) ON DELETE SET NULL,
  invited_email        text        NOT NULL,
  invited_by           uuid        NOT NULL REFERENCES public.users(id),
  -- 256-bit random token; unique, not guessable
  invite_token         text        NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(32), 'hex'),
  family_identity_role text        NOT NULL,
  app_permission_role  text        NOT NULL
    CHECK (app_permission_role IN ('owner','admin','contributor','recipient')),
  status               text        NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','accepted','declined','expired','revoked','correction_requested')),
  correction_note      text,
  expires_at           timestamptz NOT NULL DEFAULT (now() + interval '7 days'),
  accepted_at          timestamptz,
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_family_invitations_token
  ON public.family_invitations(invite_token);

CREATE INDEX IF NOT EXISTS idx_family_invitations_family_id
  ON public.family_invitations(family_id);

CREATE INDEX IF NOT EXISTS idx_family_invitations_email
  ON public.family_invitations(invited_email);

-- ─────────────────────────────────────────────────────────────
-- 3. RLS: family_invitations
-- ─────────────────────────────────────────────────────────────

ALTER TABLE public.family_invitations ENABLE ROW LEVEL SECURITY;

-- Idempotent: safe if this script was partially applied before
DROP POLICY IF EXISTS "family_invitations: owner select" ON public.family_invitations;
DROP POLICY IF EXISTS "family_invitations: owner insert" ON public.family_invitations;
DROP POLICY IF EXISTS "family_invitations: owner update" ON public.family_invitations;

-- Family owner can view all invitations for their family
CREATE POLICY "family_invitations: owner select"
  ON public.family_invitations FOR SELECT
  USING (
    family_id IN (SELECT id FROM public.users WHERE auth_user_id = auth.uid())
  );

-- Family owner can create invitations
CREATE POLICY "family_invitations: owner insert"
  ON public.family_invitations FOR INSERT
  WITH CHECK (
    family_id IN (SELECT id FROM public.users WHERE auth_user_id = auth.uid())
  );

-- Family owner can update (revoke, correct, etc.)
CREATE POLICY "family_invitations: owner update"
  ON public.family_invitations FOR UPDATE
  USING (
    family_id IN (SELECT id FROM public.users WHERE auth_user_id = auth.uid())
  );

-- ─────────────────────────────────────────────────────────────
-- 4. UPDATE RLS: family_members SELECT
--    Extend to allow an accepted invitee to see their own record
--    via linked_user_id in addition to the owner path.
-- ─────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "family_members: owner select" ON public.family_members;

CREATE POLICY "family_members: owner select"
  ON public.family_members FOR SELECT
  USING (
    -- Original: family owner sees all members they created
    user_id IN (SELECT id FROM public.users WHERE auth_user_id = auth.uid())
    OR
    -- New: accepted invitee can see their own family_members record
    linked_user_id IN (SELECT id FROM public.users WHERE auth_user_id = auth.uid())
  );

COMMIT;
