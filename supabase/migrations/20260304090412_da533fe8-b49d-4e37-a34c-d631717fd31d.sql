
-- Create vehicle-images storage bucket
INSERT INTO storage.buckets (id, name, public) VALUES ('vehicle-images', 'vehicle-images', true);

-- Add URL columns to projects and project_images
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS main_image_url text;
ALTER TABLE public.project_images ADD COLUMN IF NOT EXISTS image_url text;

-- Storage RLS: anyone can read (public bucket)
CREATE POLICY "Public read vehicle images"
ON storage.objects FOR SELECT
USING (bucket_id = 'vehicle-images');

-- Authenticated users can upload
CREATE POLICY "Authenticated users can upload vehicle images"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'vehicle-images');

-- Users can delete own images
CREATE POLICY "Users can delete own vehicle images"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'vehicle-images' AND (storage.foldername(name))[1] = auth.uid()::text);
