CREATE TABLE public.banner_projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  vehicle_id uuid REFERENCES public.vehicles(id) ON DELETE SET NULL,
  title text NOT NULL DEFAULT 'Banner-Entwurf',
  source_image_url text,
  master_image_url text,
  state jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_banner_projects_user ON public.banner_projects(user_id, updated_at DESC);
CREATE INDEX idx_banner_projects_vehicle ON public.banner_projects(vehicle_id);

ALTER TABLE public.banner_projects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own banner projects"
ON public.banner_projects
FOR ALL
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can view all banner projects"
ON public.banner_projects
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER update_banner_projects_updated_at
BEFORE UPDATE ON public.banner_projects
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();