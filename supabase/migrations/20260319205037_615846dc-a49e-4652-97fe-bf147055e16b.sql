
-- Main 360 spin jobs table
CREATE TABLE public.spin360_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  project_id uuid REFERENCES public.projects(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'uploaded',
  target_frame_count integer NOT NULL DEFAULT 36,
  identity_profile jsonb DEFAULT '{}'::jsonb,
  manifest jsonb DEFAULT '{}'::jsonb,
  error_message text,
  retry_count integer DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Source images (the 4 uploads)
CREATE TABLE public.spin360_source_images (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL REFERENCES public.spin360_jobs(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  perspective text NOT NULL, -- front, rear, left, right
  image_url text NOT NULL,
  analysis jsonb DEFAULT '{}'::jsonb, -- quality, crop, detected perspective etc
  sort_order integer DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Canonical (normalized) images
CREATE TABLE public.spin360_canonical_images (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL REFERENCES public.spin360_jobs(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  perspective text NOT NULL,
  image_url text NOT NULL,
  sort_order integer DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Generated frames (anchors + intermediates)
CREATE TABLE public.spin360_generated_frames (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL REFERENCES public.spin360_jobs(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  frame_index integer NOT NULL,
  frame_type text NOT NULL DEFAULT 'intermediate', -- canonical, anchor, intermediate
  image_url text NOT NULL,
  angle_degrees numeric DEFAULT 0,
  model_used text,
  validation_status text DEFAULT 'pending', -- pending, passed, failed, regenerated
  validation_notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE public.spin360_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.spin360_source_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.spin360_canonical_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.spin360_generated_frames ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can manage own spin jobs" ON public.spin360_jobs FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can manage own spin source images" ON public.spin360_source_images FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can manage own spin canonical images" ON public.spin360_canonical_images FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can manage own spin frames" ON public.spin360_generated_frames FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Enable realtime for job status updates
ALTER PUBLICATION supabase_realtime ADD TABLE public.spin360_jobs;
