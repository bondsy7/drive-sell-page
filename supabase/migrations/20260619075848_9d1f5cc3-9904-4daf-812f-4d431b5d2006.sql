-- Lock down SECURITY DEFINER functions that must NOT be callable directly
-- by clients via PostgREST. They are invoked only from edge functions
-- (service_role) or as table triggers.

REVOKE EXECUTE ON FUNCTION public.deduct_credits(uuid, integer, credit_action_type, text, text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.add_credits(uuid, integer, credit_action_type, text)         FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.consume_download(uuid)                                       FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.generate_api_key()                                           FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user()                                            FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.set_api_key_on_insert()                                      FROM PUBLIC, anon, authenticated;

-- Service role keeps execute rights (edge functions + triggers run as service_role / table owner).
GRANT EXECUTE ON FUNCTION public.deduct_credits(uuid, integer, credit_action_type, text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.add_credits(uuid, integer, credit_action_type, text)         TO service_role;
GRANT EXECUTE ON FUNCTION public.consume_download(uuid)                                       TO service_role;
GRANT EXECUTE ON FUNCTION public.generate_api_key()                                           TO service_role;

-- has_role(uuid, app_role) is intentionally callable by signed-in users:
-- it is referenced from RLS policies and AppHeader admin detection.
-- We do NOT revoke it.