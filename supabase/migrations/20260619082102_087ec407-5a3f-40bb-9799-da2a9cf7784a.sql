
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

INSERT INTO public.admin_secrets (key, value, label)
SELECT 'FTP_ENCRYPTION_KEY',
       encode(extensions.gen_random_bytes(32), 'hex'),
       'FTP/SFTP password encryption key (auto-generated)'
WHERE NOT EXISTS (SELECT 1 FROM public.admin_secrets WHERE key = 'FTP_ENCRYPTION_KEY');

ALTER TABLE public.ftp_configs ADD COLUMN IF NOT EXISTS password_encrypted bytea;

UPDATE public.ftp_configs f
SET password_encrypted = extensions.pgp_sym_encrypt(
        f.password,
        (SELECT value FROM public.admin_secrets WHERE key = 'FTP_ENCRYPTION_KEY')
      )
WHERE f.password_encrypted IS NULL AND f.password IS NOT NULL AND f.password <> '';

-- Recreate dependent view on top of the encrypted column
DROP VIEW IF EXISTS public.ftp_configs_safe;

ALTER TABLE public.ftp_configs DROP COLUMN IF EXISTS password;

CREATE VIEW public.ftp_configs_safe
WITH (security_invoker = true)
AS
SELECT id, user_id, host, port, username, directory, is_sftp, created_at, updated_at,
  CASE WHEN password_encrypted IS NOT NULL THEN '••••••••'::text ELSE ''::text END AS password_masked,
  (password_encrypted IS NOT NULL) AS has_password
FROM public.ftp_configs;

GRANT SELECT ON public.ftp_configs_safe TO authenticated;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.ftp_configs'::regclass AND conname = 'ftp_configs_user_id_key'
  ) THEN
    ALTER TABLE public.ftp_configs ADD CONSTRAINT ftp_configs_user_id_key UNIQUE (user_id);
  END IF;
END $$;

-- Column-level grants: clients never touch password_encrypted directly
REVOKE ALL ON public.ftp_configs FROM anon, authenticated;
GRANT SELECT (id, user_id, host, port, username, directory, is_sftp, created_at, updated_at),
      INSERT (id, user_id, host, port, username, directory, is_sftp, created_at, updated_at),
      UPDATE (host, port, username, directory, is_sftp, updated_at),
      DELETE
  ON public.ftp_configs TO authenticated;
GRANT ALL ON public.ftp_configs TO service_role;

-- RPC: store/update encrypted password for caller
CREATE OR REPLACE FUNCTION public.set_ftp_password(_password text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  _uid uuid := auth.uid();
  _key text;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF _password IS NULL OR length(_password) = 0 THEN RAISE EXCEPTION 'Password must not be empty'; END IF;

  SELECT value INTO _key FROM public.admin_secrets WHERE key = 'FTP_ENCRYPTION_KEY';
  IF _key IS NULL THEN RAISE EXCEPTION 'Encryption key not configured'; END IF;

  INSERT INTO public.ftp_configs (user_id, password_encrypted, updated_at)
  VALUES (_uid, extensions.pgp_sym_encrypt(_password, _key), now())
  ON CONFLICT (user_id) DO UPDATE
    SET password_encrypted = EXCLUDED.password_encrypted,
        updated_at = now();
END;
$$;
REVOKE ALL ON FUNCTION public.set_ftp_password(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_ftp_password(text) TO authenticated;

-- RPC: whether the caller has a stored password
CREATE OR REPLACE FUNCTION public.has_ftp_password()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.ftp_configs
    WHERE user_id = auth.uid() AND password_encrypted IS NOT NULL
  );
$$;
REVOKE ALL ON FUNCTION public.has_ftp_password() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_ftp_password() TO authenticated;

-- RPC: decrypt a user's password — service_role only
CREATE OR REPLACE FUNCTION public.get_ftp_password(_user_id uuid)
RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions
AS $$
DECLARE _key text; _enc bytea;
BEGIN
  SELECT value INTO _key FROM public.admin_secrets WHERE key = 'FTP_ENCRYPTION_KEY';
  SELECT password_encrypted INTO _enc FROM public.ftp_configs WHERE user_id = _user_id;
  IF _enc IS NULL OR _key IS NULL THEN RETURN NULL; END IF;
  RETURN extensions.pgp_sym_decrypt(_enc, _key);
END;
$$;
REVOKE ALL ON FUNCTION public.get_ftp_password(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_ftp_password(uuid) TO service_role;
