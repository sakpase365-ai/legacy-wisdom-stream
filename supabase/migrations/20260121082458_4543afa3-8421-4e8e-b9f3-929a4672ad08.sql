-- Create table for tracking creator achievements/badges
CREATE TABLE public.creator_achievements (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  achievement_type TEXT NOT NULL,
  achievement_name TEXT NOT NULL,
  description TEXT,
  earned_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  metadata JSONB DEFAULT '{}'::jsonb,
  UNIQUE(profile_id, achievement_type)
);

-- Create table for tracking streaks
CREATE TABLE public.creator_streaks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE UNIQUE,
  current_streak INTEGER NOT NULL DEFAULT 0,
  longest_streak INTEGER NOT NULL DEFAULT 0,
  last_activity_date DATE,
  week_start_count INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create table for weekly challenges
CREATE TABLE public.weekly_challenges (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  week_start DATE NOT NULL,
  challenge_type TEXT NOT NULL,
  challenge_description TEXT NOT NULL,
  target_recipient_id UUID REFERENCES public.recipients(id) ON DELETE SET NULL,
  target_topic_id UUID REFERENCES public.topics(id) ON DELETE SET NULL,
  is_completed BOOLEAN NOT NULL DEFAULT false,
  completed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(profile_id, week_start, challenge_type)
);

-- Enable RLS
ALTER TABLE public.creator_achievements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.creator_streaks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.weekly_challenges ENABLE ROW LEVEL SECURITY;

-- RLS policies for creator_achievements
CREATE POLICY "Users can view their own achievements"
ON public.creator_achievements FOR SELECT
USING (profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid()));

CREATE POLICY "Users can insert their own achievements"
ON public.creator_achievements FOR INSERT
WITH CHECK (profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid()));

-- RLS policies for creator_streaks
CREATE POLICY "Users can view their own streaks"
ON public.creator_streaks FOR SELECT
USING (profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid()));

CREATE POLICY "Users can insert their own streaks"
ON public.creator_streaks FOR INSERT
WITH CHECK (profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid()));

CREATE POLICY "Users can update their own streaks"
ON public.creator_streaks FOR UPDATE
USING (profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid()));

-- RLS policies for weekly_challenges
CREATE POLICY "Users can view their own challenges"
ON public.weekly_challenges FOR SELECT
USING (profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid()));

CREATE POLICY "Users can insert their own challenges"
ON public.weekly_challenges FOR INSERT
WITH CHECK (profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid()));

CREATE POLICY "Users can update their own challenges"
ON public.weekly_challenges FOR UPDATE
USING (profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid()));