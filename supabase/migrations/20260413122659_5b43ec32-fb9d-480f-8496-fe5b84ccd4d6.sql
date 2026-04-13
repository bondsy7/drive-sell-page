
-- Custom QR login tokens with configurable expiry
CREATE TABLE public.qr_login_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token text NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(32), 'hex'),
  user_id uuid NOT NULL,
  email text NOT NULL,
  expires_at timestamptz,
  redirect_path text NOT NULL DEFAULT '/generator',
  created_by uuid NOT NULL,
  used_count integer NOT NULL DEFAULT 0,
  max_uses integer,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.qr_login_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage qr tokens"
  ON public.qr_login_tokens FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE INDEX idx_qr_login_tokens_token ON public.qr_login_tokens (token);
CREATE INDEX idx_qr_login_tokens_active ON public.qr_login_tokens (is_active, expires_at);
