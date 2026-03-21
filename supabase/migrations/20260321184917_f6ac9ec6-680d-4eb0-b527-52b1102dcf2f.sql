
-- Create a view that masks the password for client-side queries
CREATE OR REPLACE VIEW public.ftp_configs_safe AS
SELECT id, user_id, host, port, username, directory, is_sftp, created_at, updated_at,
  CASE WHEN length(password) > 0 THEN '••••••••' ELSE '' END AS password_masked,
  CASE WHEN length(password) > 0 THEN true ELSE false END AS has_password
FROM public.ftp_configs;

-- Grant access to the view
GRANT SELECT ON public.ftp_configs_safe TO authenticated;
