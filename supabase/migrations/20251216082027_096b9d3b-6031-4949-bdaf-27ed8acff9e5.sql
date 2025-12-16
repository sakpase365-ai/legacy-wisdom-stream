-- Drop the problematic policies
DROP POLICY IF EXISTS "Users can view family members in their families" ON public.family_members;
DROP POLICY IF EXISTS "Family owners can insert members" ON public.family_members;
DROP POLICY IF EXISTS "Family owners can delete members" ON public.family_members;
DROP POLICY IF EXISTS "Recipients can view family breadcrumbs" ON public.breadcrumbs;

-- Create a security definer function to get user's family_id without recursion
CREATE OR REPLACE FUNCTION public.get_user_family_id(_user_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT family_id FROM public.family_members WHERE user_id = _user_id LIMIT 1
$$;

-- Create a security definer function to check if user is family owner
CREATE OR REPLACE FUNCTION public.is_family_owner(_user_id uuid, _family_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.family_members 
    WHERE user_id = _user_id AND family_id = _family_id AND role = 'owner'
  )
$$;

-- Recreate family_members policies using the functions
CREATE POLICY "Users can view family members in their families"
ON public.family_members
FOR SELECT
USING (family_id = public.get_user_family_id(auth.uid()));

CREATE POLICY "Family owners can insert members"
ON public.family_members
FOR INSERT
WITH CHECK (
  public.is_family_owner(auth.uid(), family_id)
  OR NOT EXISTS (SELECT 1 FROM public.family_members WHERE family_id = family_members.family_id)
);

CREATE POLICY "Family owners can delete members"
ON public.family_members
FOR DELETE
USING (public.is_family_owner(auth.uid(), family_id));

-- Recreate breadcrumbs policy for family viewing
CREATE POLICY "Recipients can view family breadcrumbs"
ON public.breadcrumbs
FOR SELECT
USING (
  (recipient_id IN (SELECT id FROM recipients WHERE user_id = auth.uid()))
  OR (
    family_id = public.get_user_family_id(auth.uid())
    AND visibility = 'family'
  )
);