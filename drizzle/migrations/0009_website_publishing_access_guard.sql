CREATE OR REPLACE FUNCTION public.website_publications_guard()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE _vin text; _owner uuid;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.user_module_access
     WHERE user_id = NEW.user_id AND module_key = 'website-publishing' AND enabled) THEN
    RAISE EXCEPTION 'Website-Veröffentlichung ist für dieses Konto nicht freigeschaltet.';
  END IF;
  SELECT vin, user_id INTO _vin, _owner FROM public.vehicles WHERE id = NEW.vehicle_id;
  IF _owner IS NULL OR _owner <> NEW.user_id THEN
    RAISE EXCEPTION 'Fahrzeug nicht gefunden.';
  END IF;
  IF _vin IS NULL OR btrim(_vin) = '' OR _vin LIKE 'AUTO3-%' THEN
    RAISE EXCEPTION 'Fahrzeug ohne gültige VIN kann nicht veröffentlicht werden.';
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_website_publications_guard ON public.website_publications;
CREATE TRIGGER trg_website_publications_guard BEFORE INSERT OR UPDATE ON public.website_publications
FOR EACH ROW EXECUTE FUNCTION public.website_publications_guard();