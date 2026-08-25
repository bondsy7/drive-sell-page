-- ── spin360 redesign: schema hardening ─────────────────────────────
-- Frames
ALTER TABLE public.spin360_generated_frames
  ADD COLUMN IF NOT EXISTS quality_score integer,
  ADD COLUMN IF NOT EXISTS attempt_count integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS source_kind text NOT NULL DEFAULT 'generated',
  ADD COLUMN IF NOT EXISTS reference_frame_ids uuid[];

UPDATE public.spin360_generated_frames SET angle_degrees = 0 WHERE angle_degrees IS NULL;
ALTER TABLE public.spin360_generated_frames ALTER COLUMN angle_degrees SET NOT NULL;

-- dedupe before unique constraint
DELETE FROM public.spin360_generated_frames a
USING public.spin360_generated_frames b
WHERE a.job_id = b.job_id
  AND a.frame_index = b.frame_index
  AND a.ctid > b.ctid;

CREATE UNIQUE INDEX IF NOT EXISTS spin360_frames_job_index_uidx
  ON public.spin360_generated_frames(job_id, frame_index);

-- Jobs
ALTER TABLE public.spin360_jobs
  ADD COLUMN IF NOT EXISTS source_mode text NOT NULL DEFAULT 'upload',
  ADD COLUMN IF NOT EXISTS keyframe_count integer NOT NULL DEFAULT 8,
  ADD COLUMN IF NOT EXISTS qa_summary jsonb,
  ADD COLUMN IF NOT EXISTS manifest_version integer NOT NULL DEFAULT 2,
  ADD COLUMN IF NOT EXISTS identity_hash text;

-- Canonicals
ALTER TABLE public.spin360_canonical_images
  ADD COLUMN IF NOT EXISTS angle_degrees integer,
  ADD COLUMN IF NOT EXISTS is_generated boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS normalization_status text NOT NULL DEFAULT 'normalized';

CREATE UNIQUE INDEX IF NOT EXISTS spin360_canonical_job_angle_uidx
  ON public.spin360_canonical_images(job_id, angle_degrees)
  WHERE angle_degrees IS NOT NULL;

-- QA history
CREATE TABLE IF NOT EXISTS public.spin360_frame_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL REFERENCES public.spin360_jobs(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  frame_index integer NOT NULL,
  attempt integer NOT NULL DEFAULT 1,
  verdict text NOT NULL,
  score integer,
  notes text,
  model_used text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.spin360_frame_reviews TO authenticated;
GRANT ALL ON public.spin360_frame_reviews TO service_role;
ALTER TABLE public.spin360_frame_reviews ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can manage own spin frame reviews" ON public.spin360_frame_reviews;
CREATE POLICY "Users can manage own spin frame reviews" ON public.spin360_frame_reviews
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX IF NOT EXISTS idx_spin360_frame_reviews_job ON public.spin360_frame_reviews(job_id);

-- Source selection (reproducibility without re-upload)
CREATE TABLE IF NOT EXISTS public.spin360_source_selection (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL REFERENCES public.spin360_jobs(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  angle_degrees integer NOT NULL,
  asset_kind text NOT NULL,
  asset_id text,
  storage_path text,
  image_url text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (job_id, angle_degrees)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.spin360_source_selection TO authenticated;
GRANT ALL ON public.spin360_source_selection TO service_role;
ALTER TABLE public.spin360_source_selection ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can manage own spin source selection" ON public.spin360_source_selection;
CREATE POLICY "Users can manage own spin source selection" ON public.spin360_source_selection
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX IF NOT EXISTS idx_spin360_source_selection_job ON public.spin360_source_selection(job_id);