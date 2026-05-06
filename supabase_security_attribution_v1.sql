-- ============================================================
-- BREADCRUMBS v2 — Security & Attribution (v1)
-- Run AFTER supabase_family_invitations_v1.sql
--
-- 1. invite_token now stores SHA-256(raw_token).
--    The raw token travels only in the invite URL; the DB
--    never stores it. Existing pending invitations are revoked
--    because their stored values are raw (un-hashed) and can
--    no longer be validated after this migration.
--
-- 2. breadcrumbs.author_family_member_id — nullable FK to the
--    family_members row of whoever wrote the entry. NULL means
--    the family owner wrote it; non-NULL means an invited
--    contributor (admin/contributor role) wrote it.
-- ============================================================

BEGIN;

-- ─────────────────────────────────────────────────────────────
-- 1. DROP Postgres-generated default on invite_token
--    Application now sets token = sha256(raw) before insert.
-- ─────────────────────────────────────────────────────────────

ALTER TABLE public.family_invitations
  ALTER COLUMN invite_token DROP DEFAULT;

-- Revoke any in-flight pending invitations whose tokens are
-- raw (pre-migration) and can no longer be validated.
UPDATE public.family_invitations
  SET status = 'revoked', updated_at = now()
  WHERE status = 'pending';

-- ─────────────────────────────────────────────────────────────
-- 2. ADD author_family_member_id to breadcrumbs
-- ─────────────────────────────────────────────────────────────

ALTER TABLE public.breadcrumbs
  ADD COLUMN IF NOT EXISTS author_family_member_id uuid
    REFERENCES public.family_members(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_breadcrumbs_author_family_member
  ON public.breadcrumbs(author_family_member_id)
  WHERE author_family_member_id IS NOT NULL;

COMMIT;
