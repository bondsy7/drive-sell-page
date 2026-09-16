CREATE TABLE public.consent_records (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  consent_id text NOT NULL,
  version text NOT NULL,
  analytics boolean NOT NULL DEFAULT false,
  marketing boolean NOT NULL DEFAULT false,
  user_id uuid NULL,
  user_agent text NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.consent_records TO authenticated;
GRANT INSERT ON public.consent_records TO anon;
GRANT ALL ON public.consent_records TO service_role;

ALTER TABLE public.consent_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone may record a consent decision"
ON public.consent_records FOR INSERT TO anon, authenticated
WITH CHECK (user_id IS NULL OR user_id = auth.uid());

CREATE POLICY "Users can read their own consent records"
ON public.consent_records FOR SELECT TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Admins can read all consent records"
ON public.consent_records FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE INDEX idx_consent_records_created_at ON public.consent_records (created_at DESC);
CREATE INDEX idx_consent_records_user ON public.consent_records (user_id, created_at DESC);