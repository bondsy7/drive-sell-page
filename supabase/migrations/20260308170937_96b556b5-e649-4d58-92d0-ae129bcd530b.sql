
CREATE TABLE public.ftp_configs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  host text NOT NULL DEFAULT '',
  port integer NOT NULL DEFAULT 21,
  username text NOT NULL DEFAULT '',
  password text NOT NULL DEFAULT '',
  directory text NOT NULL DEFAULT '/',
  is_sftp boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.ftp_configs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own ftp config"
  ON public.ftp_configs FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own ftp config"
  ON public.ftp_configs FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own ftp config"
  ON public.ftp_configs FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own ftp config"
  ON public.ftp_configs FOR DELETE
  USING (auth.uid() = user_id);
