CREATE TABLE public.auto3_oneshot_preparations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  vehicle_id uuid NOT NULL REFERENCES public.vehicles(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'imported' CHECK (status IN ('imported','analyzing_originals','ready_for_oneshot','analysis_failed','started')),
  preset_key text NOT NULL DEFAULT 'auto3_standard',
  options jsonb NOT NULL DEFAULT '{"remaster":true,"perspectives":true,"banner":false,"social":false,"video":false}'::jsonb,
  analysis jsonb NOT NULL DEFAULT '[]'::jsonb,
  selection jsonb NOT NULL DEFAULT '{}'::jsonb,
  detail_selection jsonb NOT NULL DEFAULT '[]'::jsonb,
  originals_count integer NOT NULL DEFAULT 0,
  error text,
  analyzed_at timestamptz,
  started_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (vehicle_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.auto3_oneshot_preparations TO authenticated;
GRANT ALL ON public.auto3_oneshot_preparations TO service_role;
ALTER TABLE public.auto3_oneshot_preparations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owner manages own oneshot preparations" ON public.auto3_oneshot_preparations
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX auto3_oneshot_preparations_user_idx ON public.auto3_oneshot_preparations(user_id, status);
CREATE TRIGGER trg_auto3_oneshot_preparations_updated_at BEFORE UPDATE ON public.auto3_oneshot_preparations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS auto3_autopilot_mode text NOT NULL DEFAULT 'off'
  CHECK (auto3_autopilot_mode IN ('off','prepare','full'));
UPDATE public.profiles SET auto3_autopilot_mode = 'prepare' WHERE id = '5a98c64f-41ee-4390-b65d-ce533608ee99';