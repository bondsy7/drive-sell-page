-- Spin360 V2 Phase A: exakte Dezimalwinkel + Referenz-Metadaten (rückwärtskompatibel)
ALTER TABLE public.spin360_source_selection
  ALTER COLUMN angle_degrees TYPE numeric USING angle_degrees::numeric;

ALTER TABLE public.spin360_generated_frames
  ALTER COLUMN angle_degrees TYPE numeric USING angle_degrees::numeric;

ALTER TABLE public.spin360_canonical_images
  ALTER COLUMN angle_degrees TYPE numeric USING angle_degrees::numeric;

ALTER TABLE public.spin360_generated_frames
  ADD COLUMN IF NOT EXISTS reference_metadata jsonb NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE public.spin360_generated_frames
  ALTER COLUMN reference_metadata SET DEFAULT '{}'::jsonb;

-- Neue Jobs: 48 Frames Standard, 32 als Diagnose. Legacy-Zeilen bleiben unangetastet (NOT VALID).
ALTER TABLE public.spin360_jobs
  ALTER COLUMN target_frame_count SET DEFAULT 48;

ALTER TABLE public.spin360_jobs
  DROP CONSTRAINT IF EXISTS spin360_jobs_target_frame_count_v2_check;

ALTER TABLE public.spin360_jobs
  ADD CONSTRAINT spin360_jobs_target_frame_count_v2_check
  CHECK (target_frame_count IN (32, 48)) NOT VALID;