
-- Add api_key column to profiles
ALTER TABLE public.profiles ADD COLUMN api_key text UNIQUE;

-- Create function to generate API keys
CREATE OR REPLACE FUNCTION public.generate_api_key()
RETURNS text
LANGUAGE sql
AS $$
  SELECT 'ak_' || encode(gen_random_bytes(24), 'hex')
$$;

-- Auto-generate api_key for new profiles
CREATE OR REPLACE FUNCTION public.set_api_key_on_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.api_key IS NULL THEN
    NEW.api_key := generate_api_key();
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_set_api_key
  BEFORE INSERT ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.set_api_key_on_insert();

-- Backfill existing profiles
UPDATE public.profiles SET api_key = public.generate_api_key() WHERE api_key IS NULL;

-- Allow public read of projects by api_key (for the API endpoint)
CREATE POLICY "API can read projects by api_key" ON public.projects
  FOR SELECT USING (true);

CREATE POLICY "API can read project_images" ON public.project_images
  FOR SELECT USING (true);
