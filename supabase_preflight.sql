-- ============================================================
-- BREADCRUMBS v2 — Migration Preflight Check
-- Run this BEFORE supabase_hardening.sql.
-- Read the results. Follow the decision rules at the bottom.
-- ============================================================


-- ── CHECK 1: Row counts ───────────────────────────────────────
-- If either table has rows, STOP before running hardening.sql.
-- The ALTER COLUMN TYPE cast will fail on non-uuid parent_id values.

select
  'milestones'     as table_name,
  count(*)         as row_count
from public.milestones
union all
select
  'delivery_queue' as table_name,
  count(*)         as row_count
from public.delivery_queue;


-- ── CHECK 2: UUID format validity in milestones.parent_id ─────
-- Returns any rows where parent_id exists but is NOT a valid UUID string.
-- If this returns 0 rows: the cast is safe (table is empty or all values
-- are already valid UUIDs). If it returns rows: DO NOT proceed.

select
  id,
  parent_id,
  'invalid uuid format' as issue
from public.milestones
where
  parent_id is not null
  and parent_id !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';


-- ── DECISION RULES ───────────────────────────────────────────
--
-- SAFE TO PROCEED (run supabase_hardening.sql) when ALL of:
--   ✓  Check 1: milestones row_count = 0
--   ✓  Check 1: delivery_queue row_count = 0
--   ✓  Check 2: returns 0 rows
--
-- DO NOT PROCEED if ANY of:
--   ✗  milestones has rows  → clear or back up rows first
--   ✗  delivery_queue has rows  → clear or back up rows first
--   ✗  Check 2 returns rows  → those parent_id values cannot cast to uuid;
--                              delete or fix those rows before running hardening.sql
--
-- If tables are non-empty with valid-looking data you want to keep,
-- export them first (CSV download in Supabase Table Editor), truncate,
-- run hardening.sql, then re-import with correct uuid parent_id values.
-- ─────────────────────────────────────────────────────────────
