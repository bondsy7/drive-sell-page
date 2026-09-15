CREATE TABLE public.b2b_marketing_leads (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  company_name TEXT NOT NULL,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  business_email TEXT NOT NULL,
  website TEXT,
  phone TEXT,
  monthly_vehicle_volume TEXT NOT NULL,
  location_count TEXT NOT NULL,
  role TEXT NOT NULL,
  goals JSONB NOT NULL DEFAULT '[]'::jsonb,
  note TEXT,
  uploaded_image_path TEXT,
  lead_score INTEGER NOT NULL DEFAULT 0,
  lead_class TEXT NOT NULL DEFAULT 'standard',
  utm_source TEXT,
  utm_medium TEXT,
  utm_campaign TEXT,
  utm_content TEXT,
  utm_term TEXT,
  gclid TEXT,
  msclkid TEXT,
  fbclid TEXT,
  li_fat_id TEXT,
  landing_page TEXT,
  first_referrer TEXT,
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  status TEXT NOT NULL DEFAULT 'new',
  source_label TEXT NOT NULL DEFAULT 'paid_funnel',
  demo_requested BOOLEAN NOT NULL DEFAULT false,
  admin_note TEXT,
  client_fingerprint TEXT
);

GRANT SELECT, UPDATE, DELETE ON public.b2b_marketing_leads TO authenticated;
GRANT ALL ON public.b2b_marketing_leads TO service_role;

ALTER TABLE public.b2b_marketing_leads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view b2b leads" ON public.b2b_marketing_leads
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can update b2b leads" ON public.b2b_marketing_leads
  FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can delete b2b leads" ON public.b2b_marketing_leads
  FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE INDEX idx_b2b_marketing_leads_created_at ON public.b2b_marketing_leads (created_at DESC);
CREATE INDEX idx_b2b_marketing_leads_status ON public.b2b_marketing_leads (status);
CREATE INDEX idx_b2b_marketing_leads_class ON public.b2b_marketing_leads (lead_class);

CREATE TRIGGER update_b2b_marketing_leads_updated_at
  BEFORE UPDATE ON public.b2b_marketing_leads
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();