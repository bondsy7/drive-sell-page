ALTER TABLE public.spin360_generated_frames
  ADD COLUMN IF NOT EXISTS quality_score integer,
  ADD COLUMN IF NOT EXISTS attempt_count integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS source_kind text NOT NULL DEFAULT 'generated',
  ADD COLUMN IF NOT EXISTS reference_metadata jsonb;

COMMENT ON COLUMN public.spin360_generated_frames.reference_metadata IS
  'V2: verwendete Referenzen, Sektor, Richtung, Interpolationsanteil, QA-Modell';

DROP INDEX IF EXISTS spin360_frames_job_index_uidx;

WITH ranked AS (
  SELECT id,
         row_number() OVER (
           PARTITION BY job_id, frame_index
           ORDER BY
             (source_kind IN ('canonical', 'normalized_source')) DESC,
             (frame_type = 'canonical') DESC,
             (validation_status = 'passed') DESC,
             COALESCE(quality_score, -1) DESC,
             created_at DESC
         ) AS rn
  FROM public.spin360_generated_frames
)
DELETE FROM public.spin360_generated_frames f
USING ranked r
WHERE f.id = r.id AND r.rn > 1;

CREATE UNIQUE INDEX IF NOT EXISTS spin360_frames_job_index_uidx
  ON public.spin360_generated_frames(job_id, frame_index);

ALTER TABLE public.spin360_jobs
  ADD COLUMN IF NOT EXISTS source_mode text NOT NULL DEFAULT 'upload',
  ADD COLUMN IF NOT EXISTS keyframe_count integer NOT NULL DEFAULT 8,
  ADD COLUMN IF NOT EXISTS qa_summary jsonb,
  ADD COLUMN IF NOT EXISTS manifest_version integer NOT NULL DEFAULT 2,
  ADD COLUMN IF NOT EXISTS identity_hash text;

COMMENT ON COLUMN public.spin360_jobs.manifest_version IS
  'V2 = auto3-spin Manifest. Aeltere Jobs bleiben ohne Version lesbar (Legacy 36 Frames).';
COMMENT ON COLUMN public.spin360_jobs.status IS
  'V2-Status: selecting_sources, profiling, preparing_keyframes, generating_keyframes, validating_keyframes, generating_frames, validating_frames, needs_review, completed, failed. Legacy-Status bleiben gueltig.';

ALTER TABLE public.spin360_canonical_images
  ADD COLUMN IF NOT EXISTS angle_degrees integer,
  ADD COLUMN IF NOT EXISTS is_generated boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS normalization_status text NOT NULL DEFAULT 'normalized';

COMMENT ON COLUMN public.spin360_canonical_images.normalization_status IS
  'normalized | failed — bei failed wird NIE ein Rohfoto als Keyframe verwendet.';