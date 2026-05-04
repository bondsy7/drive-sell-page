-- 0. Helper: update_updated_at_column (idempotent)
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- 1. vehicles
CREATE TABLE public.vehicles (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid NOT NULL,
  vin             text NOT NULL,
  brand           text,
  model           text,
  year            integer,
  color           text,
  title           text,
  vehicle_data    jsonb NOT NULL DEFAULT '{}'::jsonb,
  cover_image_url text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, vin)
);

ALTER TABLE public.vehicles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own vehicles"
  ON public.vehicles FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can view all vehicles"
  ON public.vehicles FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX idx_vehicles_user      ON public.vehicles(user_id);
CREATE INDEX idx_vehicles_user_vin  ON public.vehicles(user_id, vin);

CREATE TRIGGER update_vehicles_updated_at
  BEFORE UPDATE ON public.vehicles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2. vehicle_id an Asset-Tabellen
ALTER TABLE public.projects        ADD COLUMN vehicle_id uuid REFERENCES public.vehicles(id) ON DELETE CASCADE;
ALTER TABLE public.project_images  ADD COLUMN vehicle_id uuid REFERENCES public.vehicles(id) ON DELETE CASCADE;
ALTER TABLE public.spin360_jobs    ADD COLUMN vehicle_id uuid REFERENCES public.vehicles(id) ON DELETE CASCADE;
ALTER TABLE public.leads           ADD COLUMN vehicle_id uuid REFERENCES public.vehicles(id) ON DELETE SET NULL;

CREATE INDEX idx_projects_vehicle       ON public.projects(vehicle_id);
CREATE INDEX idx_project_images_vehicle ON public.project_images(vehicle_id);
CREATE INDEX idx_spin360_vehicle        ON public.spin360_jobs(vehicle_id);
CREATE INDEX idx_leads_vehicle          ON public.leads(vehicle_id);

-- 3. Bucket "originals" + Policies
INSERT INTO storage.buckets (id, name, public)
VALUES ('originals', 'originals', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Users can read own originals"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'originals' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can upload own originals"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'originals' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can update own originals"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'originals' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can delete own originals"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'originals' AND auth.uid()::text = (storage.foldername(name))[1]);