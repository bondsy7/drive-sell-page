CREATE TABLE public.vehicle_data_cache (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  vin TEXT NOT NULL,
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, vin)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.vehicle_data_cache TO authenticated;
GRANT ALL ON public.vehicle_data_cache TO service_role;

ALTER TABLE public.vehicle_data_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users select own vehicle data cache"
  ON public.vehicle_data_cache FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users insert own vehicle data cache"
  ON public.vehicle_data_cache FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update own vehicle data cache"
  ON public.vehicle_data_cache FOR UPDATE TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users delete own vehicle data cache"
  ON public.vehicle_data_cache FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

CREATE TRIGGER update_vehicle_data_cache_updated_at
  BEFORE UPDATE ON public.vehicle_data_cache
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_vehicle_data_cache_user_vin ON public.vehicle_data_cache(user_id, vin);