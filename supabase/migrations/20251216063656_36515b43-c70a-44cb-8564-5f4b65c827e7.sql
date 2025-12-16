-- Create categories table
CREATE TABLE public.categories (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  sort_order INTEGER NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on categories (public read-only)
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Categories are viewable by everyone"
ON public.categories
FOR SELECT
USING (true);

-- Drop existing topics table and recreate with new schema
DROP TABLE IF EXISTS public.topics CASCADE;

CREATE TABLE public.topics (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  category_id UUID NOT NULL REFERENCES public.categories(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  sort_order INTEGER NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(category_id, name)
);

-- Enable RLS on topics (public read-only)
ALTER TABLE public.topics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Topics are viewable by everyone"
ON public.topics
FOR SELECT
USING (true);

-- Seed the 9 categories
INSERT INTO public.categories (name, sort_order) VALUES
  ('Faith & Values', 1),
  ('Family & Relationships', 2),
  ('Personal Growth', 3),
  ('School & Career', 4),
  ('Money', 5),
  ('Life Skills', 6),
  ('Health & Wellness', 7),
  ('Hard Seasons & Healing', 8),
  ('Legacy & Memories', 9);

-- Seed topics for Faith & Values
INSERT INTO public.topics (category_id, name, sort_order)
SELECT c.id, t.name, t.sort_order
FROM public.categories c
CROSS JOIN (VALUES
  ('Prayer', 1),
  ('Trust', 2),
  ('Gratitude', 3),
  ('Discernment', 4),
  ('Purpose', 5),
  ('Service', 6)
) AS t(name, sort_order)
WHERE c.name = 'Faith & Values';

-- Seed topics for Family & Relationships
INSERT INTO public.topics (category_id, name, sort_order)
SELECT c.id, t.name, t.sort_order
FROM public.categories c
CROSS JOIN (VALUES
  ('Communication', 1),
  ('Respect', 2),
  ('Conflict Resolution', 3),
  ('Forgiveness', 4),
  ('Friendship', 5),
  ('Parenting', 6)
) AS t(name, sort_order)
WHERE c.name = 'Family & Relationships';

-- Seed topics for Personal Growth
INSERT INTO public.topics (category_id, name, sort_order)
SELECT c.id, t.name, t.sort_order
FROM public.categories c
CROSS JOIN (VALUES
  ('Confidence', 1),
  ('Integrity', 2),
  ('Discipline', 3),
  ('Decision-Making', 4),
  ('Leadership', 5),
  ('Boundaries', 6)
) AS t(name, sort_order)
WHERE c.name = 'Personal Growth';

-- Seed topics for School & Career
INSERT INTO public.topics (category_id, name, sort_order)
SELECT c.id, t.name, t.sort_order
FROM public.categories c
CROSS JOIN (VALUES
  ('Study Habits', 1),
  ('Choosing a Path', 2),
  ('Work Ethic', 3),
  ('Professionalism', 4),
  ('Networking', 5),
  ('Negotiation', 6)
) AS t(name, sort_order)
WHERE c.name = 'School & Career';

-- Seed topics for Money
INSERT INTO public.topics (category_id, name, sort_order)
SELECT c.id, t.name, t.sort_order
FROM public.categories c
CROSS JOIN (VALUES
  ('Budgeting', 1),
  ('Saving', 2),
  ('Credit', 3),
  ('Debt', 4),
  ('Giving', 5),
  ('Investing Basics', 6)
) AS t(name, sort_order)
WHERE c.name = 'Money';

-- Seed topics for Life Skills
INSERT INTO public.topics (category_id, name, sort_order)
SELECT c.id, t.name, t.sort_order
FROM public.categories c
CROSS JOIN (VALUES
  ('Time Management', 1),
  ('Cooking Basics', 2),
  ('Cleaning & Organization', 3),
  ('Etiquette', 4),
  ('Driving Prep', 5),
  ('Planning', 6)
) AS t(name, sort_order)
WHERE c.name = 'Life Skills';

-- Seed topics for Health & Wellness
INSERT INTO public.topics (category_id, name, sort_order)
SELECT c.id, t.name, t.sort_order
FROM public.categories c
CROSS JOIN (VALUES
  ('Fitness', 1),
  ('Nutrition', 2),
  ('Sleep', 3),
  ('Habits', 4),
  ('Self-Care', 5),
  ('Routine', 6)
) AS t(name, sort_order)
WHERE c.name = 'Health & Wellness';

-- Seed topics for Hard Seasons & Healing
INSERT INTO public.topics (category_id, name, sort_order)
SELECT c.id, t.name, t.sort_order
FROM public.categories c
CROSS JOIN (VALUES
  ('Grief', 1),
  ('Failure', 2),
  ('Anxiety', 3),
  ('Resilience', 4),
  ('Recovery', 5),
  ('Hope', 6)
) AS t(name, sort_order)
WHERE c.name = 'Hard Seasons & Healing';

-- Seed topics for Legacy & Memories
INSERT INTO public.topics (category_id, name, sort_order)
SELECT c.id, t.name, t.sort_order
FROM public.categories c
CROSS JOIN (VALUES
  ('Family Stories', 1),
  ('Lessons Learned', 2),
  ('Traditions', 3),
  ('Milestones', 4),
  ('Advice for the Future', 5),
  ('Heritage', 6)
) AS t(name, sort_order)
WHERE c.name = 'Legacy & Memories';

-- Update breadcrumbs table to remove topic foreign key constraint temporarily
-- and ensure topic_id can reference new topics table
ALTER TABLE public.breadcrumbs DROP CONSTRAINT IF EXISTS breadcrumbs_topic_id_fkey;
ALTER TABLE public.breadcrumbs 
ADD CONSTRAINT breadcrumbs_topic_id_fkey 
FOREIGN KEY (topic_id) REFERENCES public.topics(id) ON DELETE SET NULL;