CREATE UNIQUE INDEX IF NOT EXISTS project_images_unique_vehicle_result
ON public.project_images (
  user_id,
  vehicle_id,
  md5(COALESCE(gallery_folder, '')),
  md5(COALESCE(perspective, '')),
  md5(image_url)
)
WHERE vehicle_id IS NOT NULL AND image_url IS NOT NULL;