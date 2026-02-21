
-- Fix the family_members INSERT policy
DROP POLICY IF EXISTS "Family owners can insert members" ON public.family_members;

CREATE POLICY "Users can insert themselves or owners can insert members"
ON public.family_members FOR INSERT
TO authenticated
WITH CHECK (
  -- Users can add themselves to a family
  (user_id = auth.uid())
  OR
  -- Family owners can add other members
  is_family_owner(auth.uid(), family_id)
);
