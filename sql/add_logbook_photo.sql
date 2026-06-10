-- 1. Add photo_url to logbooks
ALTER TABLE public.logbooks
ADD COLUMN IF NOT EXISTS photo_url text;

-- 2. Create the logbook_photos storage bucket
-- (You will need to run this in the Supabase SQL Editor if it doesn't run automatically)
INSERT INTO storage.buckets (id, name, public)
VALUES ('logbook_photos', 'logbook_photos', true)
ON CONFLICT (id) DO NOTHING;

-- 3. Set up Storage Policies for logbook_photos
-- Allow public read access
CREATE POLICY "Public Access" ON storage.objects
FOR SELECT
USING (bucket_id = 'logbook_photos');

-- Allow authenticated users to insert (upload)
CREATE POLICY "Auth Insert" ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'logbook_photos' AND
  auth.role() = 'authenticated'
);

-- Allow authenticated users to update their own uploads
CREATE POLICY "Auth Update" ON storage.objects
FOR UPDATE
USING (
  bucket_id = 'logbook_photos' AND
  auth.role() = 'authenticated'
);

-- Allow authenticated users to delete their own uploads
CREATE POLICY "Auth Delete" ON storage.objects
FOR DELETE
USING (
  bucket_id = 'logbook_photos' AND
  auth.role() = 'authenticated'
);
