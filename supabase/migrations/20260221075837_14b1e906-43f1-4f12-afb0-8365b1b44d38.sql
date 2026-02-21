
-- Drop the restrictive policies and recreate as permissive
DROP POLICY IF EXISTS "Users can create families if not in one" ON public.families;
DROP POLICY IF EXISTS "Users can view families they belong to" ON public.families;

CREATE POLICY "Users can create families if not in one"
ON public.families FOR INSERT
TO authenticated
WITH CHECK (
  (auth.uid() IS NOT NULL) AND 
  (NOT EXISTS (
    SELECT 1 FROM family_members WHERE family_members.user_id = auth.uid()
  ))
);

CREATE POLICY "Users can view families they belong to"
ON public.families FOR SELECT
TO authenticated
USING (
  id IN (SELECT family_id FROM family_members WHERE user_id = auth.uid())
);
