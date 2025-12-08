-- Add date_of_birth to profiles table for Creator's own info
ALTER TABLE public.profiles 
ADD COLUMN date_of_birth DATE;

-- Add date_of_birth to recipients table for family members
ALTER TABLE public.recipients 
ADD COLUMN date_of_birth DATE;