
DROP FUNCTION IF EXISTS public.get_social_credentials_status();
DROP FUNCTION IF EXISTS public.get_social_credentials_for_user(UUID);
DROP FUNCTION IF EXISTS public.set_social_credentials(TEXT, TEXT, TEXT, TEXT);

ALTER TABLE public.user_social_credentials
  ADD COLUMN IF NOT EXISTS x_api_key_encrypted BYTEA,
  ADD COLUMN IF NOT EXISTS x_api_secret_encrypted BYTEA,
  ADD COLUMN IF NOT EXISTS x_access_token_encrypted BYTEA,
  ADD COLUMN IF NOT EXISTS x_access_token_secret_encrypted BYTEA,
  ADD COLUMN IF NOT EXISTS x_screen_name TEXT;

CREATE OR REPLACE FUNCTION public.set_social_credentials(
  _ig_user_id TEXT,
  _ig_access_token TEXT,
  _fb_page_id TEXT,
  _fb_page_token TEXT,
  _x_api_key TEXT DEFAULT NULL,
  _x_api_secret TEXT DEFAULT NULL,
  _x_access_token TEXT DEFAULT NULL,
  _x_access_token_secret TEXT DEFAULT NULL
) RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions
AS $$
DECLARE
  _uid UUID := auth.uid();
  _key TEXT;
  _ig_enc BYTEA; _fb_enc BYTEA;
  _xk_enc BYTEA; _xs_enc BYTEA; _xt_enc BYTEA; _xts_enc BYTEA;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  SELECT value INTO _key FROM public.admin_secrets WHERE key = 'FTP_ENCRYPTION_KEY';
  IF _key IS NULL THEN RAISE EXCEPTION 'Encryption key not configured'; END IF;

  IF _ig_access_token IS NOT NULL AND length(_ig_access_token) > 0 THEN
    _ig_enc := extensions.pgp_sym_encrypt(_ig_access_token, _key); END IF;
  IF _fb_page_token IS NOT NULL AND length(_fb_page_token) > 0 THEN
    _fb_enc := extensions.pgp_sym_encrypt(_fb_page_token, _key); END IF;
  IF _x_api_key IS NOT NULL AND length(_x_api_key) > 0 THEN
    _xk_enc := extensions.pgp_sym_encrypt(_x_api_key, _key); END IF;
  IF _x_api_secret IS NOT NULL AND length(_x_api_secret) > 0 THEN
    _xs_enc := extensions.pgp_sym_encrypt(_x_api_secret, _key); END IF;
  IF _x_access_token IS NOT NULL AND length(_x_access_token) > 0 THEN
    _xt_enc := extensions.pgp_sym_encrypt(_x_access_token, _key); END IF;
  IF _x_access_token_secret IS NOT NULL AND length(_x_access_token_secret) > 0 THEN
    _xts_enc := extensions.pgp_sym_encrypt(_x_access_token_secret, _key); END IF;

  INSERT INTO public.user_social_credentials AS u (
    user_id, ig_user_id, ig_access_token_encrypted, fb_page_id, fb_page_token_encrypted,
    x_api_key_encrypted, x_api_secret_encrypted, x_access_token_encrypted, x_access_token_secret_encrypted,
    updated_at
  ) VALUES (
    _uid, NULLIF(_ig_user_id,''), _ig_enc, NULLIF(_fb_page_id,''), _fb_enc,
    _xk_enc, _xs_enc, _xt_enc, _xts_enc, now()
  )
  ON CONFLICT (user_id) DO UPDATE SET
    ig_user_id = COALESCE(NULLIF(EXCLUDED.ig_user_id,''), u.ig_user_id),
    ig_access_token_encrypted = COALESCE(EXCLUDED.ig_access_token_encrypted, u.ig_access_token_encrypted),
    fb_page_id = COALESCE(NULLIF(EXCLUDED.fb_page_id,''), u.fb_page_id),
    fb_page_token_encrypted = COALESCE(EXCLUDED.fb_page_token_encrypted, u.fb_page_token_encrypted),
    x_api_key_encrypted = COALESCE(EXCLUDED.x_api_key_encrypted, u.x_api_key_encrypted),
    x_api_secret_encrypted = COALESCE(EXCLUDED.x_api_secret_encrypted, u.x_api_secret_encrypted),
    x_access_token_encrypted = COALESCE(EXCLUDED.x_access_token_encrypted, u.x_access_token_encrypted),
    x_access_token_secret_encrypted = COALESCE(EXCLUDED.x_access_token_secret_encrypted, u.x_access_token_secret_encrypted),
    updated_at = now();
END; $$;

CREATE OR REPLACE FUNCTION public.get_social_credentials_status()
RETURNS TABLE(
  instagram_configured BOOLEAN, facebook_configured BOOLEAN, x_configured BOOLEAN,
  ig_user_id TEXT, fb_page_id TEXT, x_screen_name TEXT
) LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _uid UUID := auth.uid();
BEGIN
  IF _uid IS NULL THEN
    instagram_configured:=false; facebook_configured:=false; x_configured:=false;
    ig_user_id:=NULL; fb_page_id:=NULL; x_screen_name:=NULL;
    RETURN NEXT; RETURN;
  END IF;
  RETURN QUERY SELECT
    (u.ig_user_id IS NOT NULL AND u.ig_access_token_encrypted IS NOT NULL),
    (u.fb_page_id IS NOT NULL AND u.fb_page_token_encrypted IS NOT NULL),
    (u.x_api_key_encrypted IS NOT NULL AND u.x_api_secret_encrypted IS NOT NULL
       AND u.x_access_token_encrypted IS NOT NULL AND u.x_access_token_secret_encrypted IS NOT NULL),
    u.ig_user_id, u.fb_page_id, u.x_screen_name
  FROM public.user_social_credentials u WHERE u.user_id = _uid;
  IF NOT FOUND THEN
    instagram_configured:=false; facebook_configured:=false; x_configured:=false;
    ig_user_id:=NULL; fb_page_id:=NULL; x_screen_name:=NULL;
    RETURN NEXT;
  END IF;
END; $$;

CREATE OR REPLACE FUNCTION public.get_social_credentials_for_user(_user_id UUID)
RETURNS TABLE(
  ig_user_id TEXT, ig_access_token TEXT, fb_page_id TEXT, fb_page_token TEXT,
  x_api_key TEXT, x_api_secret TEXT, x_access_token TEXT, x_access_token_secret TEXT
) LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions AS $$
DECLARE _key TEXT;
BEGIN
  SELECT value INTO _key FROM public.admin_secrets WHERE key = 'FTP_ENCRYPTION_KEY';
  IF _key IS NULL THEN RAISE EXCEPTION 'Encryption key not configured'; END IF;
  RETURN QUERY SELECT
    u.ig_user_id,
    CASE WHEN u.ig_access_token_encrypted IS NOT NULL THEN extensions.pgp_sym_decrypt(u.ig_access_token_encrypted,_key) ELSE NULL END,
    u.fb_page_id,
    CASE WHEN u.fb_page_token_encrypted IS NOT NULL THEN extensions.pgp_sym_decrypt(u.fb_page_token_encrypted,_key) ELSE NULL END,
    CASE WHEN u.x_api_key_encrypted IS NOT NULL THEN extensions.pgp_sym_decrypt(u.x_api_key_encrypted,_key) ELSE NULL END,
    CASE WHEN u.x_api_secret_encrypted IS NOT NULL THEN extensions.pgp_sym_decrypt(u.x_api_secret_encrypted,_key) ELSE NULL END,
    CASE WHEN u.x_access_token_encrypted IS NOT NULL THEN extensions.pgp_sym_decrypt(u.x_access_token_encrypted,_key) ELSE NULL END,
    CASE WHEN u.x_access_token_secret_encrypted IS NOT NULL THEN extensions.pgp_sym_decrypt(u.x_access_token_secret_encrypted,_key) ELSE NULL END
  FROM public.user_social_credentials u WHERE u.user_id = _user_id;
END; $$;

CREATE OR REPLACE FUNCTION public.clear_social_credentials(_platform TEXT)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _uid UUID := auth.uid();
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF _platform = 'instagram' THEN
    UPDATE public.user_social_credentials
      SET ig_user_id=NULL, ig_access_token_encrypted=NULL, updated_at=now() WHERE user_id=_uid;
  ELSIF _platform = 'facebook' THEN
    UPDATE public.user_social_credentials
      SET fb_page_id=NULL, fb_page_token_encrypted=NULL, updated_at=now() WHERE user_id=_uid;
  ELSIF _platform = 'x' THEN
    UPDATE public.user_social_credentials
      SET x_api_key_encrypted=NULL, x_api_secret_encrypted=NULL,
          x_access_token_encrypted=NULL, x_access_token_secret_encrypted=NULL,
          x_screen_name=NULL, updated_at=now() WHERE user_id=_uid;
  ELSE
    RAISE EXCEPTION 'Unknown platform: %', _platform;
  END IF;
END; $$;
