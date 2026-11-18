ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS seo_lead_recipient_email text;

COMMENT ON COLUMN public.profiles.seo_lead_recipient_email IS
  'Optional default recipient for enquiries submitted through SEO landing pages; a page-specific recipient takes precedence.';