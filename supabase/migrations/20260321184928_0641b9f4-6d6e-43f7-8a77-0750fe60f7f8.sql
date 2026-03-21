
-- Fix Security Definer View by setting it to INVOKER
ALTER VIEW public.ftp_configs_safe SET (security_invoker = on);
