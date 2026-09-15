CREATE POLICY "Admins can read b2b test uploads" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'b2b-test-uploads' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete b2b test uploads" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'b2b-test-uploads' AND public.has_role(auth.uid(), 'admin'));