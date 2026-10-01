ALTER TABLE public.vehicles
  ADD COLUMN IF NOT EXISTS source_system text,
  ADD COLUMN IF NOT EXISTS external_vehicle_id text,
  ADD COLUMN IF NOT EXISTS external_internal_number text,
  ADD COLUMN IF NOT EXISTS external_images jsonb NOT NULL DEFAULT '[]'::jsonb;

CREATE UNIQUE INDEX IF NOT EXISTS vehicles_user_external_uniq
  ON public.vehicles (user_id, source_system, external_vehicle_id)
  WHERE source_system IS NOT NULL AND external_vehicle_id IS NOT NULL;

CREATE TABLE public.website_publications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  vehicle_id uuid NOT NULL REFERENCES public.vehicles(id) ON DELETE CASCADE,
  target text NOT NULL,
  source_system text NOT NULL,
  external_vehicle_id text NOT NULL,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','live','disabled')),
  cover_mode text NOT NULL DEFAULT 'auto3' CHECK (cover_mode IN ('auto3','ai')),
  gallery_mode text NOT NULL DEFAULT 'auto3' CHECK (gallery_mode IN ('auto3','append','replace')),
  cover_asset_id text,
  draft_items jsonb NOT NULL DEFAULT '[]'::jsonb,
  live_snapshot jsonb,
  published_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (vehicle_id, target),
  UNIQUE (target, source_system, external_vehicle_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.website_publications TO authenticated;
GRANT ALL ON public.website_publications TO service_role;

ALTER TABLE public.website_publications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owner manages own publications" ON public.website_publications
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (SELECT 1 FROM public.vehicles v WHERE v.id = vehicle_id AND v.user_id = auth.uid())
  );

CREATE TRIGGER trg_website_publications_updated_at
  BEFORE UPDATE ON public.website_publications
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();