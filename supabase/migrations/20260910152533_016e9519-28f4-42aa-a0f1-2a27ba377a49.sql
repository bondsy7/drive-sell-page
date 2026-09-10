CREATE TABLE public.api_cost_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  action_type text NOT NULL,
  tier text,
  engine text,
  model text,
  request_id text,
  reference_count integer,
  output_count integer,
  size text,
  quality text,
  prompt_chars integer,
  prompt_tokens integer,
  input_image_tokens integer,
  output_image_tokens integer,
  orchestrator_input_tokens integer,
  orchestrator_cached_tokens integer,
  orchestrator_output_tokens integer,
  provider_cost_usd numeric,
  internal_overhead_usd numeric,
  total_ek_usd numeric,
  measurement_status text NOT NULL DEFAULT 'estimated'
    CHECK (measurement_status IN ('measured','partial','estimated'))
);

GRANT SELECT ON public.api_cost_events TO authenticated;
GRANT ALL ON public.api_cost_events TO service_role;

ALTER TABLE public.api_cost_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can read api cost events"
ON public.api_cost_events
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE INDEX idx_api_cost_events_created_at ON public.api_cost_events (created_at DESC);
CREATE INDEX idx_api_cost_events_tier ON public.api_cost_events (tier, created_at DESC);