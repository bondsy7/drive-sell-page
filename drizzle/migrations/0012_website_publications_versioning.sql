ALTER TABLE public.website_publications
  ADD COLUMN IF NOT EXISTS version integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS live_updated_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_action text,
  ADD COLUMN IF NOT EXISTS last_action_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_error text;

-- Backfill: existing live/disabled rows start at version 1 (Tiguan 37767 stays live)
UPDATE public.website_publications
  SET version = 1,
      live_updated_at = COALESCE(published_at, updated_at),
      last_action = COALESCE(last_action, CASE WHEN status = 'live' THEN 'publish' ELSE 'disable' END),
      last_action_at = COALESCE(last_action_at, published_at, updated_at)
  WHERE status IN ('live','disabled') AND version = 0;

CREATE OR REPLACE FUNCTION public.website_media_url_ok(_u text)
RETURNS boolean LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT _u IS NOT NULL
    AND _u ~* '^https://'
    AND _u !~ '/object/sign/'
    AND _u !~ '[?&]token='
    AND _u !~* '/object/public/(banners|originals)/'
    AND _u ~* '\.(png|jpe?g|webp|avif)(\?|#|$)'
$$;

CREATE OR REPLACE FUNCTION public.website_publications_versioning()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE _img jsonb; _urls text[] := '{}'; _u text;
BEGIN
  IF NEW.status = 'live' THEN
    IF NEW.live_snapshot IS NULL THEN RAISE EXCEPTION 'Live-Veröffentlichung ohne Snapshot ist nicht erlaubt.'; END IF;
    IF NEW.live_snapshot->>'coverMode' = 'ai' AND NOT public.website_media_url_ok(NEW.live_snapshot->>'coverImageUrl') THEN
      RAISE EXCEPTION 'Cover hat keine dauerhafte öffentliche Bildadresse.';
    END IF;
    FOR _img IN SELECT * FROM jsonb_array_elements(COALESCE(NEW.live_snapshot->'images','[]'::jsonb)) LOOP
      _u := _img->>'url';
      IF NOT public.website_media_url_ok(_u) THEN RAISE EXCEPTION 'Nur dauerhafte öffentliche Fahrzeugbilder können veröffentlicht werden.'; END IF;
      IF _u = ANY(_urls) THEN RAISE EXCEPTION 'Doppeltes Bild in der Galerie.'; END IF;
      _urls := _urls || _u;
    END LOOP;
  END IF;

  IF TG_OP = 'INSERT' THEN
    NEW.version := CASE WHEN NEW.status IN ('live','disabled') THEN 1 ELSE 0 END;
    IF NEW.version = 1 THEN NEW.live_updated_at := now(); END IF;
  ELSE
    IF NEW.status IS DISTINCT FROM OLD.status
       OR (NEW.status = 'live' AND (NEW.live_snapshot IS DISTINCT FROM OLD.live_snapshot OR NEW.published_at IS DISTINCT FROM OLD.published_at)) THEN
      NEW.version := OLD.version + 1;
      NEW.live_updated_at := now();
    ELSE
      NEW.version := OLD.version;
      NEW.live_updated_at := OLD.live_updated_at;
    END IF;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_website_publications_versioning ON public.website_publications;
CREATE TRIGGER trg_website_publications_versioning
  BEFORE INSERT OR UPDATE ON public.website_publications
  FOR EACH ROW EXECUTE FUNCTION public.website_publications_versioning();

-- Internal storage existence check for delivery (no external HEAD requests)
CREATE OR REPLACE FUNCTION public.website_media_missing_urls(_urls text[])
RETURNS text[] LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, storage AS $$
  SELECT COALESCE(array_agg(u), '{}') FROM unnest(_urls) AS u
  WHERE u ~ '/storage/v1/object/public/vehicle-images/'
    AND NOT EXISTS (
      SELECT 1 FROM storage.objects o
      WHERE o.bucket_id = 'vehicle-images'
        AND o.name = split_part(split_part(split_part(u, '/storage/v1/object/public/vehicle-images/', 2), '?', 1), '#', 1)
    )
$$;
REVOKE ALL ON FUNCTION public.website_media_missing_urls(text[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.website_media_missing_urls(text[]) TO service_role;