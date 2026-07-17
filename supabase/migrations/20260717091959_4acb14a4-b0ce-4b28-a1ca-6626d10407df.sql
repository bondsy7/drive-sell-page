
-- Lock down SECURITY DEFINER functions: revoke broad EXECUTE, grant narrowly.

-- Sensitive: decrypts secrets or mutates credits/quotas -> service_role only
REVOKE ALL ON FUNCTION public.get_social_credentials_for_user(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_social_credentials_for_user(uuid) TO service_role;

REVOKE ALL ON FUNCTION public.get_ftp_password(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_ftp_password(uuid) TO service_role;

REVOKE ALL ON FUNCTION public.deduct_credits(uuid, integer, credit_action_type, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.deduct_credits(uuid, integer, credit_action_type, text, text) TO service_role;

REVOKE ALL ON FUNCTION public.add_credits(uuid, integer, credit_action_type, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.add_credits(uuid, integer, credit_action_type, text) TO service_role;

REVOKE ALL ON FUNCTION public.consume_download(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.consume_download(uuid) TO service_role;

-- Trigger-only functions: no direct exec needed
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.set_api_key_on_insert() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.update_updated_at_column() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.generate_api_key() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.generate_api_key() TO service_role;

-- User-facing helpers (self-scoped via auth.uid()): authenticated only
REVOKE ALL ON FUNCTION public.get_social_credentials_status() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_social_credentials_status() TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.set_social_credentials(text, text, text, text, text, text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_social_credentials(text, text, text, text, text, text, text, text) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.clear_social_credentials(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.clear_social_credentials(text) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.has_ftp_password() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_ftp_password() TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.set_ftp_password(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_ftp_password(text) TO authenticated, service_role;

-- has_role is used inside RLS policies; must remain callable by any role that hits those policies
REVOKE ALL ON FUNCTION public.has_role(uuid, app_role) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO anon, authenticated, service_role;
