ALTER TABLE public.spin360_jobs ADD COLUMN IF NOT EXISTS image_engine text NOT NULL DEFAULT 'gemini';
ALTER TABLE public.spin360_jobs DROP CONSTRAINT IF EXISTS spin360_jobs_image_engine_check;
ALTER TABLE public.spin360_jobs ADD CONSTRAINT spin360_jobs_image_engine_check CHECK (image_engine IN ('gemini','flare','sunburst'));