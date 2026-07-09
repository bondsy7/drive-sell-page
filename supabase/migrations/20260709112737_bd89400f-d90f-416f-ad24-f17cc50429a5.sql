
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS auto3_account_email TEXT,
  ADD COLUMN IF NOT EXISTS auto3_channels_default TEXT[] NOT NULL DEFAULT ARRAY['website','instagram','facebook']::text[],
  ADD COLUMN IF NOT EXISTS auto3_default_caption TEXT,
  ADD COLUMN IF NOT EXISTS auto3_default_cta_url TEXT;

CREATE TABLE IF NOT EXISTS public.banner_publications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  banner_path TEXT NOT NULL,
  banner_url TEXT,
  target_email TEXT NOT NULL,
  client_reference_id TEXT NOT NULL,
  channels TEXT[] NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'pending',
  response JSONB,
  error TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (user_id, client_reference_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.banner_publications TO authenticated;
GRANT ALL ON public.banner_publications TO service_role;

ALTER TABLE public.banner_publications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own auto3 publications"
  ON public.banner_publications FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own auto3 publications"
  ON public.banner_publications FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own auto3 publications"
  ON public.banner_publications FOR UPDATE TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own auto3 publications"
  ON public.banner_publications FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_banner_publications_user_created
  ON public.banner_publications (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_banner_publications_banner_path
  ON public.banner_publications (user_id, banner_path);

CREATE TRIGGER trg_banner_publications_updated_at
  BEFORE UPDATE ON public.banner_publications
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
