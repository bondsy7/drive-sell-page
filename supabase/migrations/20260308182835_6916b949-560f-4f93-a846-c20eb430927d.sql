
-- Sample PDFs table for curated gallery
CREATE TABLE public.sample_pdfs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  brand TEXT,
  model TEXT,
  category TEXT DEFAULT 'Leasing',
  pdf_url TEXT NOT NULL,
  thumbnail_url TEXT,
  active BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id)
);

-- RLS
ALTER TABLE public.sample_pdfs ENABLE ROW LEVEL SECURITY;

-- Anyone can read active sample PDFs
CREATE POLICY "Anyone can read active sample PDFs"
ON public.sample_pdfs FOR SELECT
USING (active = true);

-- Admins can manage all sample PDFs
CREATE POLICY "Admins can manage sample PDFs"
ON public.sample_pdfs FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- Storage bucket for sample PDFs
INSERT INTO storage.buckets (id, name, public) VALUES ('sample-pdfs', 'sample-pdfs', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for sample-pdfs bucket
CREATE POLICY "Anyone can read sample PDFs" ON storage.objects
FOR SELECT USING (bucket_id = 'sample-pdfs');

CREATE POLICY "Admins can upload sample PDFs" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'sample-pdfs' AND public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete sample PDFs" ON storage.objects
FOR DELETE TO authenticated
USING (bucket_id = 'sample-pdfs' AND public.has_role(auth.uid(), 'admin'::app_role));
