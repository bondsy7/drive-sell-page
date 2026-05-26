
DO $$
DECLARE
  v_user uuid := '753b5f67-58ad-493f-a031-200016d23a95';
  v_vin  text := 'WBA13AR08MCF16714';
  v_vehicle_id uuid;
  v_cover text;
BEGIN
  INSERT INTO public.vehicles (user_id, vin, brand, title)
  VALUES (v_user, v_vin, 'BMW', 'BMW')
  ON CONFLICT (user_id, vin) DO UPDATE SET updated_at = now()
  RETURNING id INTO v_vehicle_id;

  UPDATE public.project_images
     SET vehicle_id = v_vehicle_id
   WHERE user_id = v_user
     AND vehicle_id IS NULL
     AND created_at > now() - interval '6 hours';

  SELECT image_url INTO v_cover
    FROM public.project_images
   WHERE vehicle_id = v_vehicle_id
     AND perspective ILIKE 'Pipeline: Master-Bild%'
   ORDER BY created_at DESC LIMIT 1;

  IF v_cover IS NOT NULL THEN
    UPDATE public.vehicles SET cover_image_url = v_cover WHERE id = v_vehicle_id;
  END IF;
END $$;
