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
  WITH user_vehicles AS (
    SELECT veh.id
    FROM public.vehicles AS veh
    WHERE veh.user_id = _uid
  ),
  p_counts AS (
    SELECT pr.vehicle_id AS v_id, COUNT(*)::int AS c
    FROM public.projects AS pr
    JOIN user_vehicles AS uv ON uv.id = pr.vehicle_id
    GROUP BY pr.vehicle_id
  ),
  i_counts AS (
    SELECT img.vehicle_id AS v_id, COUNT(*)::int AS c
    FROM public.project_images AS img
    JOIN user_vehicles AS uv ON uv.id = img.vehicle_id
    GROUP BY img.vehicle_id
  ),
  s_counts AS (
    SELECT spin.vehicle_id AS v_id, COUNT(*)::int AS c
    FROM public.spin360_jobs AS spin
    JOIN user_vehicles AS uv ON uv.id = spin.vehicle_id
    GROUP BY spin.vehicle_id
  ),
  proj_map AS (
    SELECT pr.id, pr.vehicle_id AS v_id
    FROM public.projects AS pr
    JOIN user_vehicles AS uv ON uv.id = pr.vehicle_id
  ),
  l_counts AS (
    SELECT
      COALESCE(ld.vehicle_id, pm.v_id) AS v_id,
      COUNT(*)::int AS c
    FROM public.leads AS ld
    LEFT JOIN proj_map AS pm ON pm.id = ld.project_id
    WHERE ld.dealer_user_id = _uid
      AND COALESCE(ld.vehicle_id, pm.v_id) IS NOT NULL
    GROUP BY COALESCE(ld.vehicle_id, pm.v_id)
  ),
  filtered_banners AS (
    SELECT split_part(obj.name, '/', 2) AS vehicle_path
    FROM storage.objects AS obj
    WHERE obj.bucket_id = 'banners'
      AND split_part(obj.name, '/', 1) = _uid::text
      AND obj.name LIKE '%.png'
      AND split_part(obj.name, '/', 3) NOT LIKE 'state-%'
      AND split_part(obj.name, '/', 3) NOT LIKE '.%'
      AND split_part(obj.name, '/', 2) ~ '^[0-9a-f-]{36}$'
  ),
  b_counts AS (
    SELECT fb.vehicle_path::uuid AS v_id, COUNT(*)::int AS c
    FROM filtered_banners AS fb
    JOIN user_vehicles AS uv ON uv.id = fb.vehicle_path::uuid
    GROUP BY fb.vehicle_path
  ),
  p_cover AS (
    SELECT DISTINCT ON (pr.vehicle_id)
      pr.vehicle_id AS v_id,
      pr.main_image_url
    FROM public.projects AS pr
    JOIN user_vehicles AS uv ON uv.id = pr.vehicle_id
    WHERE pr.main_image_url IS NOT NULL
    ORDER BY pr.vehicle_id, pr.updated_at DESC
  ),
  i_cover AS (
    SELECT DISTINCT ON (img.vehicle_id)
      img.vehicle_id AS v_id,
      img.image_url
    FROM public.project_images AS img
    JOIN user_vehicles AS uv ON uv.id = img.vehicle_id
    WHERE img.image_url IS NOT NULL AND img.image_url <> ''
    ORDER BY img.vehicle_id, img.created_at DESC
  )
  SELECT
    uv.id AS vehicle_id,
    COALESCE(pc.c, 0) AS projects_count,
    COALESCE(ic.c, 0) AS images_count,
    COALESCE(sc.c, 0) AS spin360_count,
    COALESCE(bc.c, 0) AS banners_count,
    COALESCE(lc.c, 0) AS leads_count,
    COALESCE(pcvr.main_image_url, icvr.image_url) AS cover_fallback
  FROM user_vehicles AS uv
  LEFT JOIN p_counts AS pc ON pc.v_id = uv.id
  LEFT JOIN i_counts AS ic ON ic.v_id = uv.id
  LEFT JOIN s_counts AS sc ON sc.v_id = uv.id
  LEFT JOIN b_counts AS bc ON bc.v_id = uv.id
  LEFT JOIN l_counts AS lc ON lc.v_id = uv.id
  LEFT JOIN p_cover AS pcvr ON pcvr.v_id = uv.id
  LEFT JOIN i_cover AS icvr ON icvr.v_id = uv.id;
END;
$$;

REVOKE ALL ON FUNCTION public.get_vehicle_dashboard() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_vehicle_dashboard() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_vehicle_dashboard() TO service_role;

CREATE OR REPLACE FUNCTION public.get_vehicle_dashboard_page(_limit integer DEFAULT 24, _offset integer DEFAULT 0)
RETURNS TABLE(
  id uuid,
  user_id uuid,
  vin text,
  brand text,
  model text,
  year integer,
  color text,
  title text,
  vehicle_data jsonb,
  cover_image_url text,
  created_at timestamptz,
  updated_at timestamptz,
  projects_count integer,
  images_count integer,
  spin360_count integer,
  banners_count integer,
  leads_count integer,
  cover_fallback text,
  total_count bigint
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _safe_limit integer := LEAST(GREATEST(COALESCE(_limit, 24), 1), 60);
  _safe_offset integer := GREATEST(COALESCE(_offset, 0), 0);
BEGIN
  IF _uid IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY
  WITH all_user_vehicles AS (
    SELECT veh.*
    FROM public.vehicles AS veh
    WHERE veh.user_id = _uid
  ),
  page_vehicles AS (
    SELECT auv.*
    FROM all_user_vehicles AS auv
    ORDER BY auv.updated_at DESC NULLS LAST, auv.created_at DESC
    LIMIT _safe_limit OFFSET _safe_offset
  ),
  total AS (
    SELECT COUNT(*)::bigint AS c FROM all_user_vehicles
  ),
  p_counts AS (
    SELECT pr.vehicle_id AS v_id, COUNT(*)::int AS c
    FROM public.projects AS pr
    JOIN page_vehicles AS pv ON pv.id = pr.vehicle_id
    GROUP BY pr.vehicle_id
  ),
  i_counts AS (
    SELECT img.vehicle_id AS v_id, COUNT(*)::int AS c
    FROM public.project_images AS img
    JOIN page_vehicles AS pv ON pv.id = img.vehicle_id
    GROUP BY img.vehicle_id
  ),
  s_counts AS (
    SELECT spin.vehicle_id AS v_id, COUNT(*)::int AS c
    FROM public.spin360_jobs AS spin
    JOIN page_vehicles AS pv ON pv.id = spin.vehicle_id
    GROUP BY spin.vehicle_id
  ),
  proj_map AS (
    SELECT pr.id, pr.vehicle_id AS v_id
    FROM public.projects AS pr
    JOIN page_vehicles AS pv ON pv.id = pr.vehicle_id
  ),
  l_counts AS (
    SELECT
      COALESCE(ld.vehicle_id, pm.v_id) AS v_id,
      COUNT(*)::int AS c
    FROM public.leads AS ld
    LEFT JOIN proj_map AS pm ON pm.id = ld.project_id
    WHERE ld.dealer_user_id = _uid
      AND COALESCE(ld.vehicle_id, pm.v_id) IS NOT NULL
    GROUP BY COALESCE(ld.vehicle_id, pm.v_id)
  ),
  filtered_banners AS (
    SELECT split_part(obj.name, '/', 2) AS vehicle_path
    FROM storage.objects AS obj
    WHERE obj.bucket_id = 'banners'
      AND split_part(obj.name, '/', 1) = _uid::text
      AND obj.name LIKE '%.png'
      AND split_part(obj.name, '/', 3) NOT LIKE 'state-%'
      AND split_part(obj.name, '/', 3) NOT LIKE '.%'
      AND split_part(obj.name, '/', 2) ~ '^[0-9a-f-]{36}$'
  ),
  b_counts AS (
    SELECT fb.vehicle_path::uuid AS v_id, COUNT(*)::int AS c
    FROM filtered_banners AS fb
    JOIN page_vehicles AS pv ON pv.id = fb.vehicle_path::uuid
    GROUP BY fb.vehicle_path
  ),
  p_cover AS (
    SELECT DISTINCT ON (pr.vehicle_id)
      pr.vehicle_id AS v_id,
      pr.main_image_url
    FROM public.projects AS pr
    JOIN page_vehicles AS pv ON pv.id = pr.vehicle_id
    WHERE pr.main_image_url IS NOT NULL
    ORDER BY pr.vehicle_id, pr.updated_at DESC
  ),
  i_cover AS (
    SELECT DISTINCT ON (img.vehicle_id)
      img.vehicle_id AS v_id,
      img.image_url
    FROM public.project_images AS img
    JOIN page_vehicles AS pv ON pv.id = img.vehicle_id
    WHERE img.image_url IS NOT NULL AND img.image_url <> ''
    ORDER BY img.vehicle_id, img.created_at DESC
  )
  SELECT
    pv.id,
    pv.user_id,
    pv.vin,
    pv.brand,
    pv.model,
    pv.year,
    pv.color,
    pv.title,
    pv.vehicle_data,
    COALESCE(pv.cover_image_url, pcvr.main_image_url, icvr.image_url) AS cover_image_url,
    pv.created_at,
    pv.updated_at,
    COALESCE(pc.c, 0) AS projects_count,
    COALESCE(ic.c, 0) AS images_count,
    COALESCE(sc.c, 0) AS spin360_count,
    COALESCE(bc.c, 0) AS banners_count,
    COALESCE(lc.c, 0) AS leads_count,
    COALESCE(pcvr.main_image_url, icvr.image_url) AS cover_fallback,
    total.c AS total_count
  FROM page_vehicles AS pv
  CROSS JOIN total
  LEFT JOIN p_counts AS pc ON pc.v_id = pv.id
  LEFT JOIN i_counts AS ic ON ic.v_id = pv.id
  LEFT JOIN s_counts AS sc ON sc.v_id = pv.id
  LEFT JOIN b_counts AS bc ON bc.v_id = pv.id
  LEFT JOIN l_counts AS lc ON lc.v_id = pv.id
  LEFT JOIN p_cover AS pcvr ON pcvr.v_id = pv.id
  LEFT JOIN i_cover AS icvr ON icvr.v_id = pv.id
  ORDER BY pv.updated_at DESC NULLS LAST, pv.created_at DESC;
END;
$$;

REVOKE ALL ON FUNCTION public.get_vehicle_dashboard_page(integer, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_vehicle_dashboard_page(integer, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_vehicle_dashboard_page(integer, integer) TO service_role;