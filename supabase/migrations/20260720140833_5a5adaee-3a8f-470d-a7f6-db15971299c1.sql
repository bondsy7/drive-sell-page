
-- Indexes for join columns used by the vehicle dashboard aggregation
CREATE INDEX IF NOT EXISTS idx_project_images_vehicle_id ON public.project_images(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_projects_vehicle_id ON public.projects(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_spin360_jobs_vehicle_id ON public.spin360_jobs(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_leads_dealer_user_id ON public.leads(dealer_user_id);
CREATE INDEX IF NOT EXISTS idx_leads_vehicle_id ON public.leads(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_leads_project_id ON public.leads(project_id);
CREATE INDEX IF NOT EXISTS idx_vehicles_user_updated ON public.vehicles(user_id, updated_at DESC);

-- Aggregated per-vehicle dashboard payload for the current user.
-- Returns counts + a cover fallback URL, all in one round-trip.
CREATE OR REPLACE FUNCTION public.get_vehicle_dashboard()
RETURNS TABLE(
  vehicle_id uuid,
  projects_count integer,
  images_count integer,
  spin360_count integer,
  banners_count integer,
  leads_count integer,
  cover_fallback text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
BEGIN
  IF _uid IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY
  WITH v AS (
    SELECT id FROM public.vehicles WHERE user_id = _uid
  ),
  p_counts AS (
    SELECT p.vehicle_id, COUNT(*)::int AS c
    FROM public.projects p
    WHERE p.vehicle_id IN (SELECT id FROM v)
    GROUP BY p.vehicle_id
  ),
  i_counts AS (
    SELECT pi.vehicle_id, COUNT(*)::int AS c
    FROM public.project_images pi
    WHERE pi.vehicle_id IN (SELECT id FROM v)
    GROUP BY pi.vehicle_id
  ),
  s_counts AS (
    SELECT sj.vehicle_id, COUNT(*)::int AS c
    FROM public.spin360_jobs sj
    WHERE sj.vehicle_id IN (SELECT id FROM v)
    GROUP BY sj.vehicle_id
  ),
  proj_map AS (
    SELECT id, vehicle_id FROM public.projects WHERE vehicle_id IN (SELECT id FROM v)
  ),
  l_counts AS (
    SELECT
      COALESCE(l.vehicle_id, pm.vehicle_id) AS vehicle_id,
      COUNT(*)::int AS c
    FROM public.leads l
    LEFT JOIN proj_map pm ON pm.id = l.project_id
    WHERE l.dealer_user_id = _uid
      AND COALESCE(l.vehicle_id, pm.vehicle_id) IS NOT NULL
    GROUP BY COALESCE(l.vehicle_id, pm.vehicle_id)
  ),
  b_counts AS (
    SELECT
      (split_part(o.name, '/', 2))::uuid AS vehicle_id,
      COUNT(*)::int AS c
    FROM storage.objects o
    WHERE o.bucket_id = 'banners'
      AND split_part(o.name, '/', 1) = _uid::text
      AND o.name LIKE '%.png'
      AND split_part(o.name, '/', 3) NOT LIKE 'state-%'
      AND split_part(o.name, '/', 3) NOT LIKE '.%'
      AND split_part(o.name, '/', 2) ~ '^[0-9a-f-]{36}$'
    GROUP BY split_part(o.name, '/', 2)
  ),
  p_cover AS (
    SELECT DISTINCT ON (vehicle_id) vehicle_id, main_image_url
    FROM public.projects
    WHERE vehicle_id IN (SELECT id FROM v) AND main_image_url IS NOT NULL
    ORDER BY vehicle_id, updated_at DESC
  ),
  i_cover AS (
    SELECT DISTINCT ON (vehicle_id) vehicle_id, image_url
    FROM public.project_images
    WHERE vehicle_id IN (SELECT id FROM v) AND image_url IS NOT NULL AND image_url <> ''
    ORDER BY vehicle_id, created_at DESC
  )
  SELECT
    v.id,
    COALESCE(p_counts.c, 0),
    COALESCE(i_counts.c, 0),
    COALESCE(s_counts.c, 0),
    COALESCE(b_counts.c, 0),
    COALESCE(l_counts.c, 0),
    COALESCE(p_cover.main_image_url, i_cover.image_url)
  FROM v
  LEFT JOIN p_counts ON p_counts.vehicle_id = v.id
  LEFT JOIN i_counts ON i_counts.vehicle_id = v.id
  LEFT JOIN s_counts ON s_counts.vehicle_id = v.id
  LEFT JOIN b_counts ON b_counts.vehicle_id = v.id
  LEFT JOIN l_counts ON l_counts.vehicle_id = v.id
  LEFT JOIN p_cover  ON p_cover.vehicle_id = v.id
  LEFT JOIN i_cover  ON i_cover.vehicle_id = v.id;
END;
$$;

REVOKE ALL ON FUNCTION public.get_vehicle_dashboard() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_vehicle_dashboard() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_vehicle_dashboard() TO service_role;
