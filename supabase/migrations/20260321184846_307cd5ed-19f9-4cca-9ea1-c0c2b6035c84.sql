
-- FIX: profiles policies from {public} to {authenticated}
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;

CREATE POLICY "Users can view own profile"
  ON public.profiles FOR SELECT TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile"
  ON public.profiles FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE TO authenticated
  USING (auth.uid() = id);

-- FIX: ftp_configs policies from {public} to {authenticated}
DROP POLICY IF EXISTS "Users can view own ftp config" ON public.ftp_configs;
DROP POLICY IF EXISTS "Users can insert own ftp config" ON public.ftp_configs;
DROP POLICY IF EXISTS "Users can update own ftp config" ON public.ftp_configs;
DROP POLICY IF EXISTS "Users can delete own ftp config" ON public.ftp_configs;

CREATE POLICY "Users can view own ftp config"
  ON public.ftp_configs FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own ftp config"
  ON public.ftp_configs FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own ftp config"
  ON public.ftp_configs FOR UPDATE TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own ftp config"
  ON public.ftp_configs FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- FIX: projects policies from {public} to {authenticated}
DROP POLICY IF EXISTS "Users can view own projects" ON public.projects;
DROP POLICY IF EXISTS "Users can insert own projects" ON public.projects;
DROP POLICY IF EXISTS "Users can update own projects" ON public.projects;
DROP POLICY IF EXISTS "Users can delete own projects" ON public.projects;

CREATE POLICY "Users can view own projects"
  ON public.projects FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own projects"
  ON public.projects FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own projects"
  ON public.projects FOR UPDATE TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own projects"
  ON public.projects FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- FIX: project_images policies from {public} to {authenticated} + add UPDATE
DROP POLICY IF EXISTS "Users can view own images" ON public.project_images;
DROP POLICY IF EXISTS "Users can insert own images" ON public.project_images;
DROP POLICY IF EXISTS "Users can delete own images" ON public.project_images;

CREATE POLICY "Users can view own images"
  ON public.project_images FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own images"
  ON public.project_images FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own images"
  ON public.project_images FOR UPDATE TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own images"
  ON public.project_images FOR DELETE TO authenticated
  USING (auth.uid() = user_id);
