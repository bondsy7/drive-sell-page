CREATE TABLE public.vehicle_processing_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  name text NOT NULL DEFAULT 'Standard',
  settings jsonb NOT NULL DEFAULT '{}'::jsonb,
  cost_per_job integer NOT NULL DEFAULT 0,
  approved_at timestamptz,
  approved_max_credits_per_job integer,
  approved_settings_hash text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.vehicle_processing_profiles TO authenticated;
GRANT ALL ON public.vehicle_processing_profiles TO service_role;
ALTER TABLE public.vehicle_processing_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owner manages processing profile" ON public.vehicle_processing_profiles
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER trg_vehicle_processing_profiles_updated_at BEFORE UPDATE ON public.vehicle_processing_profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.auto3_processing_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  vehicle_id uuid NOT NULL REFERENCES public.vehicles(id) ON DELETE CASCADE,
  profile_id uuid REFERENCES public.vehicle_processing_profiles(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'queued',
  master_file text,
  master_reason text,
  master_alternatives jsonb NOT NULL DEFAULT '[]'::jsonb,
  datasheet jsonb NOT NULL DEFAULT '{}'::jsonb,
  plan jsonb,
  steps jsonb NOT NULL DEFAULT '{}'::jsonb,
  progress_done integer NOT NULL DEFAULT 0,
  progress_total integer NOT NULL DEFAULT 0,
  progress_label text,
  cost_estimate integer NOT NULL DEFAULT 0,
  credits_spent integer NOT NULL DEFAULT 0,
  pause_reason text,
  error text,
  attempts integer NOT NULL DEFAULT 0,
  lease_until timestamptz,
  next_run_at timestamptz,
  started_at timestamptz,
  finished_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (vehicle_id)
);
GRANT SELECT ON public.auto3_processing_jobs TO authenticated;
GRANT ALL ON public.auto3_processing_jobs TO service_role;
ALTER TABLE public.auto3_processing_jobs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owner reads processing jobs" ON public.auto3_processing_jobs
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE INDEX idx_auto3_processing_jobs_user ON public.auto3_processing_jobs(user_id, status);
CREATE TRIGGER trg_auto3_processing_jobs_updated_at BEFORE UPDATE ON public.auto3_processing_jobs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();