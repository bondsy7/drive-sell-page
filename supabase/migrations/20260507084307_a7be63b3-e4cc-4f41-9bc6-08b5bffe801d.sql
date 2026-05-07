CREATE TABLE public.damage_reports (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  title TEXT NOT NULL DEFAULT 'Schadensbericht',
  vehicle_info JSONB NOT NULL DEFAULT '{}'::jsonb,
  anlass TEXT,
  analysis JSONB NOT NULL,
  images JSONB NOT NULL DEFAULT '[]'::jsonb,
  schaden_count INTEGER NOT NULL DEFAULT 0,
  schweregrad TEXT,
  kosten_realistisch_brutto INTEGER,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.damage_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own damage reports"
  ON public.damage_reports FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own damage reports"
  ON public.damage_reports FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own damage reports"
  ON public.damage_reports FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own damage reports"
  ON public.damage_reports FOR DELETE
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all damage reports"
  ON public.damage_reports FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX idx_damage_reports_user_created ON public.damage_reports(user_id, created_at DESC);

CREATE TRIGGER update_damage_reports_updated_at
  BEFORE UPDATE ON public.damage_reports
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();