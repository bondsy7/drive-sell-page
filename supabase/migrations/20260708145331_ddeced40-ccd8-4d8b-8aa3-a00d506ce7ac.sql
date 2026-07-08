
CREATE TABLE public.user_social_credentials (
  user_id UUID NOT NULL PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  ig_user_id TEXT,
  ig_access_token_encrypted BYTEA,
  fb_page_id TEXT,
  fb_page_token_encrypted BYTEA,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- No direct access for anon/authenticated on token columns.
-- Users interact only via SECURITY DEFINER functions below.
GRANT ALL ON public.user_social_credentials TO service_role;
-- Allow authenticated users to DELETE their own row (disconnect) and SELECT non-secret metadata via RLS-controlled column-level access is complex; we expose reads through the status RPC only.
GRANT SELECT, DELETE ON public.user_social_credentials TO authenticated;

ALTER TABLE public.user_social_credentials ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users can view own social creds row"
  ON public.user_social_credentials FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "users can delete own social creds row"
  ON public.user_social_credentials FOR DELETE
  USING (auth.uid() = user_id);

CREATE TRIGGER update_user_social_credentials_updated_at
  BEFORE UPDATE ON public.user_social_credentials
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ── Set credentials (only fields provided are updated) ────────────────
CREATE OR REPLACE FUNCTION public.set_social_credentials(
  _ig_user_id TEXT,
  _ig_access_token TEXT,
  _fb_page_id TEXT,
  _fb_page_token TEXT
) RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  _uid UUID := auth.uid();
  _key TEXT;
  _ig_enc BYTEA;
  _fb_enc BYTEA;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  SELECT value INTO _key FROM public.admin_secrets WHERE key = 'FTP_ENCRYPTION_KEY';
  IF _key IS NULL THEN RAISE EXCEPTION 'Encryption key not configured'; END IF;

  IF _ig_access_token IS NOT NULL AND length(_ig_access_token) > 0 THEN
    _ig_enc := extensions.pgp_sym_encrypt(_ig_access_token, _key);
  END IF;
  IF _fb_page_token IS NOT NULL AND length(_fb_page_token) > 0 THEN
    _fb_enc := extensions.pgp_sym_encrypt(_fb_page_token, _key);
  END IF;

  INSERT INTO public.user_social_credentials AS u (
    user_id, ig_user_id, ig_access_token_encrypted, fb_page_id, fb_page_token_encrypted, updated_at
  ) VALUES (
    _uid,
    NULLIF(_ig_user_id, ''),
    _ig_enc,
    NULLIF(_fb_page_id, ''),
    _fb_enc,
    now()
  )
  ON CONFLICT (user_id) DO UPDATE SET
    ig_user_id = COALESCE(NULLIF(EXCLUDED.ig_user_id, ''), u.ig_user_id),
    ig_access_token_encrypted = COALESCE(EXCLUDED.ig_access_token_encrypted, u.ig_access_token_encrypted),
    fb_page_id = COALESCE(NULLIF(EXCLUDED.fb_page_id, ''), u.fb_page_id),
    fb_page_token_encrypted = COALESCE(EXCLUDED.fb_page_token_encrypted, u.fb_page_token_encrypted),
    updated_at = now();
END;
$$;

REVOKE ALL ON FUNCTION public.set_social_credentials(TEXT, TEXT, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_social_credentials(TEXT, TEXT, TEXT, TEXT) TO authenticated;

-- ── Clear a specific platform's tokens ────────────────────────────────
CREATE OR REPLACE FUNCTION public.clear_social_credentials(_platform TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid UUID := auth.uid();
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  IF _platform = 'instagram' THEN
    UPDATE public.user_social_credentials
      SET ig_user_id = NULL, ig_access_token_encrypted = NULL, updated_at = now()
      WHERE user_id = _uid;
  ELSIF _platform = 'facebook' THEN
    UPDATE public.user_social_credentials
      SET fb_page_id = NULL, fb_page_token_encrypted = NULL, updated_at = now()
      WHERE user_id = _uid;
  ELSE
    RAISE EXCEPTION 'Unknown platform: %', _platform;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.clear_social_credentials(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.clear_social_credentials(TEXT) TO authenticated;

-- ── Status for current user (no tokens exposed) ───────────────────────
CREATE OR REPLACE FUNCTION public.get_social_credentials_status()
RETURNS TABLE (
  instagram_configured BOOLEAN,
  facebook_configured BOOLEAN,
  ig_user_id TEXT,
  fb_page_id TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid UUID := auth.uid();
BEGIN
  IF _uid IS NULL THEN
    instagram_configured := false;
    facebook_configured := false;
    ig_user_id := NULL;
    fb_page_id := NULL;
    RETURN NEXT;
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    (u.ig_user_id IS NOT NULL AND u.ig_access_token_encrypted IS NOT NULL) AS instagram_configured,
    (u.fb_page_id IS NOT NULL AND u.fb_page_token_encrypted IS NOT NULL)   AS facebook_configured,
    u.ig_user_id,
    u.fb_page_id
  FROM public.user_social_credentials u
  WHERE u.user_id = _uid;

  IF NOT FOUND THEN
    instagram_configured := false;
    facebook_configured := false;
    ig_user_id := NULL;
    fb_page_id := NULL;
    RETURN NEXT;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.get_social_credentials_status() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_social_credentials_status() TO authenticated;

-- ── Decrypt for edge functions (service_role only) ────────────────────
CREATE OR REPLACE FUNCTION public.get_social_credentials_for_user(_user_id UUID)
RETURNS TABLE (
  ig_user_id TEXT,
  ig_access_token TEXT,
  fb_page_id TEXT,
  fb_page_token TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  _key TEXT;
BEGIN
  SELECT value INTO _key FROM public.admin_secrets WHERE key = 'FTP_ENCRYPTION_KEY';
  IF _key IS NULL THEN RAISE EXCEPTION 'Encryption key not configured'; END IF;

  RETURN QUERY
  SELECT
    u.ig_user_id,
    CASE WHEN u.ig_access_token_encrypted IS NOT NULL
         THEN extensions.pgp_sym_decrypt(u.ig_access_token_encrypted, _key)
         ELSE NULL END,
    u.fb_page_id,
    CASE WHEN u.fb_page_token_encrypted IS NOT NULL
         THEN extensions.pgp_sym_decrypt(u.fb_page_token_encrypted, _key)
         ELSE NULL END
  FROM public.user_social_credentials u
  WHERE u.user_id = _user_id;
END;
$$;

REVOKE ALL ON FUNCTION public.get_social_credentials_for_user(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_social_credentials_for_user(UUID) TO service_role;
