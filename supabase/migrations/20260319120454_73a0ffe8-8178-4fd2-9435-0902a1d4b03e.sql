CREATE POLICY "Users can update own vehicle images"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'vehicle-images' AND (storage.foldername(name))[1] = auth.uid()::text)
WITH CHECK (bucket_id = 'vehicle-images' AND (storage.foldername(name))[1] = auth.uid()::text);