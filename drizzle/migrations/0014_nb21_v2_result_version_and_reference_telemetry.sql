ALTER TABLE public.project_images ADD COLUMN IF NOT EXISTS generation_context jsonb;
ALTER TABLE public.generation_attempt_logs ADD COLUMN IF NOT EXISTS prompt_version text;
ALTER TABLE public.generation_attempt_logs ADD COLUMN IF NOT EXISTS reference_manifest jsonb;
ALTER TABLE public.generation_attempt_logs ADD COLUMN IF NOT EXISTS transport_manifest jsonb;
COMMENT ON COLUMN public.project_images.generation_context IS 'Optional per-result prompt version and durable original provenance; legacy rows remain unchanged.';
COMMENT ON COLUMN public.generation_attempt_logs.reference_manifest IS 'NB21 v2 ordered reference authority manifest; never image bytes or credentials.';
COMMENT ON COLUMN public.generation_attempt_logs.transport_manifest IS 'NB21 v2 actual outgoing image order and sanitized file identifiers or content hashes.';