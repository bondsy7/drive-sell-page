
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS address text,
  ADD COLUMN IF NOT EXISTS postal_code text,
  ADD COLUMN IF NOT EXISTS city text,
  ADD COLUMN IF NOT EXISTS tax_id text,
  ADD COLUMN IF NOT EXISTS facebook_url text,
  ADD COLUMN IF NOT EXISTS instagram_url text,
  ADD COLUMN IF NOT EXISTS x_url text,
  ADD COLUMN IF NOT EXISTS tiktok_url text,
  ADD COLUMN IF NOT EXISTS youtube_url text,
  ADD COLUMN IF NOT EXISTS leasing_bank text,
  ADD COLUMN IF NOT EXISTS leasing_legal_text text,
  ADD COLUMN IF NOT EXISTS financing_bank text,
  ADD COLUMN IF NOT EXISTS financing_legal_text text,
  ADD COLUMN IF NOT EXISTS default_legal_text text;
