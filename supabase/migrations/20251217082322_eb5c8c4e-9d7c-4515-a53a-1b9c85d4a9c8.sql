-- Create junction table to link breadcrumbs to multiple recipients
CREATE TABLE public.breadcrumb_recipients (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  breadcrumb_id UUID NOT NULL REFERENCES public.breadcrumbs(id) ON DELETE CASCADE,
  recipient_id UUID NOT NULL REFERENCES public.recipients(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(breadcrumb_id, recipient_id)
);

-- Enable Row Level Security
ALTER TABLE public.breadcrumb_recipients ENABLE ROW LEVEL SECURITY;

-- Creators can manage breadcrumb recipients for their breadcrumbs
CREATE POLICY "Creators can insert breadcrumb recipients"
ON public.breadcrumb_recipients
FOR INSERT
WITH CHECK (
  breadcrumb_id IN (
    SELECT b.id FROM breadcrumbs b
    WHERE b.creator_id IN (
      SELECT p.id FROM profiles p WHERE p.user_id = auth.uid()
    )
  )
);

CREATE POLICY "Creators can view breadcrumb recipients"
ON public.breadcrumb_recipients
FOR SELECT
USING (
  breadcrumb_id IN (
    SELECT b.id FROM breadcrumbs b
    WHERE b.creator_id IN (
      SELECT p.id FROM profiles p WHERE p.user_id = auth.uid()
    )
  )
);

CREATE POLICY "Creators can delete breadcrumb recipients"
ON public.breadcrumb_recipients
FOR DELETE
USING (
  breadcrumb_id IN (
    SELECT b.id FROM breadcrumbs b
    WHERE b.creator_id IN (
      SELECT p.id FROM profiles p WHERE p.user_id = auth.uid()
    )
  )
);

-- Recipients can view breadcrumb recipients for breadcrumbs they can access
CREATE POLICY "Recipients can view breadcrumb recipients"
ON public.breadcrumb_recipients
FOR SELECT
USING (
  recipient_id IN (
    SELECT r.id FROM recipients r WHERE r.user_id = auth.uid()
  )
  OR breadcrumb_id IN (
    SELECT b.id FROM breadcrumbs b
    WHERE b.family_id = get_user_family_id(auth.uid()) AND b.visibility = 'family'
  )
);

-- Create index for better query performance
CREATE INDEX idx_breadcrumb_recipients_breadcrumb_id ON public.breadcrumb_recipients(breadcrumb_id);
CREATE INDEX idx_breadcrumb_recipients_recipient_id ON public.breadcrumb_recipients(recipient_id);