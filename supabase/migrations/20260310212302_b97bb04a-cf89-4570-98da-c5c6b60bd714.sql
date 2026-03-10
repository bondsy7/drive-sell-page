
-- Create banners storage bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('banners', 'banners', true)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload banners
CREATE POLICY "Users can upload banners"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'banners' AND (storage.foldername(name))[1] = auth.uid()::text);

-- Allow authenticated users to read own banners
CREATE POLICY "Users can read own banners"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'banners' AND (storage.foldername(name))[1] = auth.uid()::text);

-- Allow public read for banners (since bucket is public)
CREATE POLICY "Public can read banners"
ON storage.objects FOR SELECT TO anon
USING (bucket_id = 'banners');

-- Allow users to delete own banners
CREATE POLICY "Users can delete own banners"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'banners' AND (storage.foldername(name))[1] = auth.uid()::text);
