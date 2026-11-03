ALTER TABLE public.project_images ADD COLUMN IF NOT EXISTS pipeline_run_at timestamptz;

CREATE OR REPLACE FUNCTION public.project_images_assign_run()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _last record;
BEGIN
  IF NEW.pipeline_run_at IS NULL THEN
    SELECT pipeline_run_at, created_at INTO _last FROM public.project_images
     WHERE user_id = NEW.user_id AND COALESCE(gallery_folder,'') = COALESCE(NEW.gallery_folder,'')
       AND pipeline_run_at IS NOT NULL
     ORDER BY created_at DESC LIMIT 1;
    IF _last.pipeline_run_at IS NOT NULL AND _last.created_at > now() - interval '30 minutes' THEN
      NEW.pipeline_run_at := _last.pipeline_run_at;
    ELSE
      NEW.pipeline_run_at := now();
    END IF;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS project_images_assign_run ON public.project_images;
CREATE TRIGGER project_images_assign_run BEFORE INSERT ON public.project_images
FOR EACH ROW EXECUTE FUNCTION public.project_images_assign_run();

WITH ordered AS (
  SELECT id, user_id, gallery_folder, created_at,
    CASE WHEN lag(created_at) OVER w IS NULL OR created_at - lag(created_at) OVER w > interval '30 minutes' THEN 1 ELSE 0 END AS brk
  FROM public.project_images WHERE pipeline_run_at IS NULL
  WINDOW w AS (PARTITION BY user_id, COALESCE(gallery_folder,'') ORDER BY created_at)
), grp AS (
  SELECT id, user_id, gallery_folder, created_at,
    sum(brk) OVER (PARTITION BY user_id, COALESCE(gallery_folder,'') ORDER BY created_at) AS g
  FROM ordered
), starts AS (
  SELECT id, min(created_at) OVER (PARTITION BY user_id, COALESCE(gallery_folder,''), g) AS run_at FROM grp
)
UPDATE public.project_images p SET pipeline_run_at = s.run_at FROM starts s WHERE p.id = s.id;