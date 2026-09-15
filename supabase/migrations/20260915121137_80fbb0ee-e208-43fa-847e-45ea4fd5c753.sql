CREATE TABLE public.generation_attempt_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  workflow_key text,
  project_id text,
  vehicle_id uuid,
  job_key text,
  job_label text,
  prompt_index integer NOT NULL DEFAULT 0,
  stage text NOT NULL DEFAULT 'generate',
  attempt integer NOT NULL DEFAULT 1,
  status text NOT NULL DEFAULT 'error',
  model_tier text,
  engine text,
  model text,
  duration_ms integer,
  error_code text,
  error_message text,
  provider_status integer,
  provider_response jsonb,
  retryable boolean,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.generation_attempt_logs TO authenticated;
GRANT ALL ON public.generation_attempt_logs TO service_role;

ALTER TABLE public.generation_attempt_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read their own generation logs"
ON public.generation_attempt_logs FOR SELECT TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can write their own generation logs"
ON public.generation_attempt_logs FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can read all generation logs"
ON public.generation_attempt_logs FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX idx_generation_attempt_logs_user_created
  ON public.generation_attempt_logs (user_id, created_at DESC);
CREATE INDEX idx_generation_attempt_logs_workflow
  ON public.generation_attempt_logs (workflow_key, created_at DESC);
CREATE INDEX idx_generation_attempt_logs_status
  ON public.generation_attempt_logs (status, created_at DESC);