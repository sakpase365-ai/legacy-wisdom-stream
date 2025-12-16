-- Create families table
CREATE TABLE public.families (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on families
ALTER TABLE public.families ENABLE ROW LEVEL SECURITY;

-- Create family_members table
CREATE TABLE public.family_members (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  family_id UUID NOT NULL REFERENCES public.families(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'member')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(family_id, user_id)
);

-- Enable RLS on family_members
ALTER TABLE public.family_members ENABLE ROW LEVEL SECURITY;

-- Add family_id and visibility to breadcrumbs
ALTER TABLE public.breadcrumbs 
ADD COLUMN family_id UUID REFERENCES public.families(id),
ADD COLUMN visibility TEXT NOT NULL DEFAULT 'family' CHECK (visibility IN ('family', 'recipient_only'));

-- RLS policies for families
CREATE POLICY "Users can view families they belong to"
ON public.families
FOR SELECT
USING (id IN (SELECT family_id FROM public.family_members WHERE user_id = auth.uid()));

CREATE POLICY "Users can create families"
ON public.families
FOR INSERT
WITH CHECK (true);

-- RLS policies for family_members
CREATE POLICY "Users can view family members in their families"
ON public.family_members
FOR SELECT
USING (family_id IN (SELECT family_id FROM public.family_members WHERE user_id = auth.uid()));

CREATE POLICY "Family owners can insert members"
ON public.family_members
FOR INSERT
WITH CHECK (
  family_id IN (SELECT family_id FROM public.family_members WHERE user_id = auth.uid() AND role = 'owner')
  OR NOT EXISTS (SELECT 1 FROM public.family_members WHERE family_id = family_members.family_id)
);

CREATE POLICY "Family owners can delete members"
ON public.family_members
FOR DELETE
USING (family_id IN (SELECT family_id FROM public.family_members WHERE user_id = auth.uid() AND role = 'owner'));

-- Update breadcrumbs RLS to allow family-based access for recipients
DROP POLICY IF EXISTS "Recipients can view breadcrumbs for them" ON public.breadcrumbs;

CREATE POLICY "Recipients can view family breadcrumbs"
ON public.breadcrumbs
FOR SELECT
USING (
  (recipient_id IN (SELECT id FROM recipients WHERE user_id = auth.uid()))
  OR (
    family_id IN (SELECT family_id FROM public.family_members WHERE user_id = auth.uid())
    AND visibility = 'family'
  )
);