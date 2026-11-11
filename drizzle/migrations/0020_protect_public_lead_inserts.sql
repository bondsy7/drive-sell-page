DROP POLICY IF EXISTS "Anyone can insert leads" ON public.leads;
REVOKE INSERT ON public.leads FROM anon, authenticated;
GRANT SELECT, DELETE ON public.leads TO authenticated;
GRANT ALL ON public.leads TO service_role;
COMMENT ON TABLE public.leads IS 'Public enquiries are inserted only through submit-lead with server-side validation and ownership checks.';