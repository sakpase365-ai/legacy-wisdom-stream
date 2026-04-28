-- Fix: family_members.family_id had NOT NULL with no default,
-- causing every onboarding insert to silently fail (service role bypasses RLS but not constraints).
ALTER TABLE public.family_members ALTER COLUMN family_id DROP NOT NULL;
