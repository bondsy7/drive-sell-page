DROP INDEX IF EXISTS public.spin360_canonical_job_angle_uidx;
CREATE UNIQUE INDEX spin360_canonical_job_angle_uidx
  ON public.spin360_canonical_images (job_id, angle_degrees);