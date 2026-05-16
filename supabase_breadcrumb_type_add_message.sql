-- Capture intent "message" for simplified /capture (memory + lesson already exist on enum).
-- Run once in Supabase SQL Editor if inserts fail with invalid enum value for message.

ALTER TYPE public.breadcrumb_type ADD VALUE IF NOT EXISTS 'message';
