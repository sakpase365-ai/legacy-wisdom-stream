-- Add content_type and media_url to breadcrumbs table.
-- Breadcrumbs supports text, audio, image, and video legacy messages.
ALTER TABLE public.breadcrumbs
  ADD COLUMN IF NOT EXISTS content_type text NOT NULL DEFAULT 'text'
    CHECK (content_type IN ('text', 'audio', 'image', 'video')),
  ADD COLUMN IF NOT EXISTS media_url    text;

COMMENT ON COLUMN public.breadcrumbs.content_type IS 'text | audio | image | video';
COMMENT ON COLUMN public.breadcrumbs.media_url    IS 'Storage URL for audio/image/video breadcrumbs';
