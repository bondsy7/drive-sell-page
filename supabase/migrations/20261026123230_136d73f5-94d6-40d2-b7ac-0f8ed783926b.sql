-- Landingpage publication fields on projects (only used for template_id='landing-page')
ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS landing_status text NOT NULL DEFAULT 'draft',
  ADD COLUMN IF NOT EXISTS slug text;

ALTER TABLE public.projects
  ADD CONSTRAINT projects_landing_status_check CHECK (landing_status IN ('draft','published','archived'));

CREATE OR REPLACE FUNCTION public.landing_slugify(_t text)
RETURNS text LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT coalesce(nullif(trim(both '-' from regexp_replace(
    lower(translate(coalesce(_t,''), 'ÄÖÜäöüßÀÁÂÉÈÊÍÓÔÚàáâéèêíóôúçÇ', 'AOUaousAAAEEEIOOUaaaeeeiooucC')),
    '[^a-z0-9]+', '-', 'g')), ''), 'landingpage')
$$;

CREATE OR REPLACE FUNCTION public.projects_landing_maintain()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE base text; candidate text; n int := 1;
BEGIN
  IF TG_OP = 'UPDATE' THEN
    NEW.updated_at := now();
  END IF;
  IF NEW.template_id = 'landing-page' AND (NEW.slug IS NULL OR NEW.slug = '') THEN
    base := left(public.landing_slugify(regexp_replace(NEW.title, '\s*–\s*Landing Page$', '')), 80);
    candidate := base;
    WHILE EXISTS (SELECT 1 FROM public.projects p WHERE p.user_id = NEW.user_id AND p.slug = candidate AND p.id <> NEW.id) LOOP
      n := n + 1; candidate := base || '-' || n;
    END LOOP;
    NEW.slug := candidate;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS projects_landing_maintain ON public.projects;
CREATE TRIGGER projects_landing_maintain BEFORE INSERT OR UPDATE ON public.projects
  FOR EACH ROW EXECUTE FUNCTION public.projects_landing_maintain();

-- Backfill slugs for existing landing pages (trigger fills them)
UPDATE public.projects SET slug = NULL WHERE template_id = 'landing-page' AND slug IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS projects_user_slug_unique ON public.projects(user_id, slug) WHERE slug IS NOT NULL;

-- Tombstones so the plugin can detect deleted landing pages
CREATE TABLE IF NOT EXISTS public.landing_page_deletions (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL,
  slug text,
  title text,
  deleted_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.landing_page_deletions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.landing_page_deletions FROM anon, authenticated;
GRANT ALL ON public.landing_page_deletions TO service_role;
CREATE INDEX IF NOT EXISTS landing_page_deletions_user ON public.landing_page_deletions(user_id, deleted_at DESC);

CREATE OR REPLACE FUNCTION public.projects_landing_tombstone()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF OLD.template_id = 'landing-page' THEN
    INSERT INTO public.landing_page_deletions(id, user_id, slug, title)
    VALUES (OLD.id, OLD.user_id, OLD.slug, OLD.title)
    ON CONFLICT (id) DO UPDATE SET deleted_at = now();
  END IF;
  RETURN OLD;
END $$;
REVOKE ALL ON FUNCTION public.projects_landing_tombstone() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS projects_landing_tombstone ON public.projects;
CREATE TRIGGER projects_landing_tombstone AFTER DELETE ON public.projects
  FOR EACH ROW EXECUTE FUNCTION public.projects_landing_tombstone();