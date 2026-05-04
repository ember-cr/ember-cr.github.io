-- Add media columns to messages
ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS media_url text,
  ADD COLUMN IF NOT EXISTS media_type text;

-- Allow empty content when there is media
ALTER TABLE public.messages ALTER COLUMN content DROP NOT NULL;
ALTER TABLE public.messages ALTER COLUMN content SET DEFAULT '';

-- Storage bucket for chat media
INSERT INTO storage.buckets (id, name, public)
VALUES ('chat-media', 'chat-media', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies: members of the room can read; uploaders own their folder
-- File path convention: {room_id}/{user_id}/{filename}
CREATE POLICY "Chat media is viewable by room members"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'chat-media'
  AND public.is_room_member(((storage.foldername(name))[1])::uuid, auth.uid())
);

CREATE POLICY "Members can upload chat media to their room folder"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'chat-media'
  AND public.is_room_member(((storage.foldername(name))[1])::uuid, auth.uid())
  AND (storage.foldername(name))[2] = auth.uid()::text
);

CREATE POLICY "Users can delete their own chat media"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'chat-media'
  AND (storage.foldername(name))[2] = auth.uid()::text
);