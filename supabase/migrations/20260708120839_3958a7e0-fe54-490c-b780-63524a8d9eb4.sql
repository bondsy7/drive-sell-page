CREATE TABLE public.social_publications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  vehicle_id UUID REFERENCES public.vehicles(id) ON DELETE SET NULL,
  banner_path TEXT NOT NULL,
  banner_name TEXT,
  banner_url TEXT NOT NULL,
  platform TEXT NOT NULL CHECK (platform IN ('instagram', 'facebook')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'success', 'failed')),
  caption TEXT,
  meta_post_id TEXT,
  meta_container_id TEXT,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT ON public.social_publications TO authenticated;
GRANT ALL ON public.social_publications TO service_role;

ALTER TABLE public.social_publications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own social publications"
  ON public.social_publications FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE INDEX idx_social_publications_user ON public.social_publications(user_id, created_at DESC);
CREATE INDEX idx_social_publications_banner ON public.social_publications(banner_path);

CREATE TRIGGER update_social_publications_updated_at
  BEFORE UPDATE ON public.social_publications
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();