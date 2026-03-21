
-- FIX 1: Restrict admin_settings read access to authenticated users only
DROP POLICY IF EXISTS "Anyone can read settings" ON public.admin_settings;
CREATE POLICY "Authenticated can read settings"
  ON public.admin_settings
  FOR SELECT
  TO authenticated
  USING (true);

-- FIX 2: Prevent privilege escalation on user_roles
-- Drop the existing overly broad admin policy and recreate with explicit policies
DROP POLICY IF EXISTS "Admins can manage all roles" ON public.user_roles;

-- Admins can SELECT all roles
CREATE POLICY "Admins can select all roles"
  ON public.user_roles
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

-- Admins can INSERT roles
CREATE POLICY "Admins can insert roles"
  ON public.user_roles
  FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- Admins can DELETE roles
CREATE POLICY "Admins can delete roles"
  ON public.user_roles
  FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

-- FIX 3: Restrict service_role full access policy on image_generation_jobs
-- (the "always true" warning)
DROP POLICY IF EXISTS "Service role full access" ON public.image_generation_jobs;
