ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS privacy_policy_url text;

COMMENT ON COLUMN public.profiles.privacy_policy_url IS
  'HTTPS URL of the dealer privacy policy linked from SEO landing-page enquiry forms.';