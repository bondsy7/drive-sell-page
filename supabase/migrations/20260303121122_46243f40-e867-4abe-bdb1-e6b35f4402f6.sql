-- Create storage bucket for dealer logos
INSERT INTO storage.buckets (id, name, public) VALUES ('logos', 'logos', true);

-- Allow authenticated users to upload their own logos
CREATE POLICY "Users can upload own logo"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'logos' AND (storage.foldername(name))[1] = auth.uid()::text);

-- Allow authenticated users to update their own logos
CREATE POLICY "Users can update own logo"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'logos' AND (storage.foldername(name))[1] = auth.uid()::text);

-- Allow authenticated users to delete their own logos
CREATE POLICY "Users can delete own logo"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'logos' AND (storage.foldername(name))[1] = auth.uid()::text);

-- Allow public read access to logos
CREATE POLICY "Public can view logos"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'logos');