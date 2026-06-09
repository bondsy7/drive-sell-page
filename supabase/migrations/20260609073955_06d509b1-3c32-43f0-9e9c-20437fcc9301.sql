
DROP POLICY IF EXISTS "Users update own banner templates" ON public.banner_templates;
CREATE POLICY "Users update own banner templates"
ON public.banner_templates
FOR UPDATE TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid() AND is_global = false);

DROP POLICY IF EXISTS "Admins can view all damage reports"   ON public.damage_reports;
DROP POLICY IF EXISTS "Users can delete own damage reports"  ON public.damage_reports;
DROP POLICY IF EXISTS "Users can insert own damage reports"  ON public.damage_reports;
DROP POLICY IF EXISTS "Users can update own damage reports"  ON public.damage_reports;
DROP POLICY IF EXISTS "Users can view own damage reports"    ON public.damage_reports;

CREATE POLICY "Admins can view all damage reports"
ON public.damage_reports FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "Users can view own damage reports"
ON public.damage_reports FOR SELECT TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own damage reports"
ON public.damage_reports FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own damage reports"
ON public.damage_reports FOR UPDATE TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own damage reports"
ON public.damage_reports FOR DELETE TO authenticated
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Authenticated users can upload vehicle images" ON storage.objects;
CREATE POLICY "Authenticated users can upload vehicle images"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'vehicle-images'
  AND (storage.foldername(name))[1] = (auth.uid())::text
);
