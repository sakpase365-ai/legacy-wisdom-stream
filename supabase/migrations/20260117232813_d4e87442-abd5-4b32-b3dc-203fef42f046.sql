-- Fix: Block anonymous SELECT access on profiles table
CREATE POLICY "Block anonymous access to profiles"
ON public.profiles
FOR SELECT
USING (auth.uid() IS NOT NULL);

-- Fix: Block anonymous SELECT access on recipients table  
CREATE POLICY "Block anonymous access to recipients"
ON public.recipients
FOR SELECT
USING (auth.uid() IS NOT NULL);

-- Fix: Block anonymous SELECT access on breadcrumbs table
CREATE POLICY "Block anonymous access to breadcrumbs"
ON public.breadcrumbs
FOR SELECT
USING (auth.uid() IS NOT NULL);

-- Fix: Block anonymous SELECT access on questions table
CREATE POLICY "Block anonymous access to questions"
ON public.questions
FOR SELECT
USING (auth.uid() IS NOT NULL);