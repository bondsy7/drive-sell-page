
-- Fix search path - need extensions schema for gen_random_bytes
CREATE OR REPLACE FUNCTION public.generate_api_key()
RETURNS text
LANGUAGE sql
STABLE
SET search_path TO 'public', 'extensions'
AS $$
  SELECT 'ak_' || encode(extensions.gen_random_bytes(24), 'hex')
$$;

-- Drop overly permissive public policies, edge function uses service_role
DROP POLICY IF EXISTS "API can read projects by api_key" ON public.projects;
DROP POLICY IF EXISTS "API can read project_images" ON public.project_images;
