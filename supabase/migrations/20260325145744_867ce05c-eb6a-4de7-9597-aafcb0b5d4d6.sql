
CREATE TABLE public.pipeline_timing_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  project_id uuid REFERENCES public.projects(id) ON DELETE SET NULL,
  model_tier text NOT NULL DEFAULT 'standard',
  total_jobs integer NOT NULL DEFAULT 0,
  total_images integer NOT NULL DEFAULT 0,
  completed_images integer NOT NULL DEFAULT 0,
  failed_images integer NOT NULL DEFAULT 0,
  total_duration_ms integer NOT NULL DEFAULT 0,
  job_durations jsonb NOT NULL DEFAULT '[]'::jsonb,
  vehicle_description text,
  detected_brand text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.pipeline_timing_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can insert own timing logs"
  ON public.pipeline_timing_logs FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view own timing logs"
  ON public.pipeline_timing_logs FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all timing logs"
  ON public.pipeline_timing_logs FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE INDEX idx_pipeline_timing_logs_user ON public.pipeline_timing_logs(user_id);
CREATE INDEX idx_pipeline_timing_logs_created ON public.pipeline_timing_logs(created_at DESC);
