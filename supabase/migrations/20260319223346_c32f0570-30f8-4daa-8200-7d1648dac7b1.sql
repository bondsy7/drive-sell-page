
CREATE TABLE public.admin_secrets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text NOT NULL UNIQUE,
  value text NOT NULL DEFAULT '',
  label text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES auth.users(id)
);

ALTER TABLE public.admin_secrets ENABLE ROW LEVEL SECURITY;

-- ONLY admins can read and write - NO public access
CREATE POLICY "Admins can manage secrets"
  ON public.admin_secrets FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Seed with current secret keys (empty values - admin must fill them)
INSERT INTO public.admin_secrets (key, label) VALUES
  ('GEMINI_API_KEY', 'Google Gemini API Key'),
  ('OPENAI_API_KEY', 'OpenAI API Key'),
  ('STRIPE_SECRET_KEY', 'Stripe Secret Key'),
  ('STRIPE_WEBHOOK_SECRET', 'Stripe Webhook Secret'),
  ('RESEND_API_KEY', 'Resend API Key'),
  ('RESEND_FROM_EMAIL', 'Resend Absender E-Mail'),
  ('RESEND_REPLY_TO', 'Resend Reply-To E-Mail'),
  ('OUTVIN_API_KEY', 'OutVIN API Key');
