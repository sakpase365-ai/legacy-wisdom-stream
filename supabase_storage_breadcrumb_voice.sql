-- Voice notes bucket for Record Audio. Run in Supabase SQL editor once.
-- Public URL keeps archive playback simple; paths use random UUIDs. Tighten later with signed URLs if needed.

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'breadcrumb-voice',
  'breadcrumb-voice',
  true,
  10485760,
  ARRAY['audio/webm', 'audio/mp4', 'audio/mpeg', 'audio/wav', 'audio/ogg']
)
ON CONFLICT (id) DO NOTHING;
