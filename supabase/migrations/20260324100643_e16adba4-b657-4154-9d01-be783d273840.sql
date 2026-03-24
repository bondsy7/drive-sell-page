
-- Preset-System für den Bildergenerator

-- 1. Presets (Vorlagen)
CREATE TABLE public.presets (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL DEFAULT 'Allgemein',
  prompt_secret TEXT NOT NULL DEFAULT '',
  type TEXT NOT NULL DEFAULT 'editing',
  active BOOLEAN NOT NULL DEFAULT true,
  display_order INTEGER NOT NULL DEFAULT 0,
  example_preview_url TEXT,
  example_images JSONB DEFAULT '[]'::jsonb,
  requires_user_template BOOLEAN NOT NULL DEFAULT false,
  requires_premium_model BOOLEAN NOT NULL DEFAULT false,
  premium_reason TEXT,
  allowed_aspect_ratios TEXT[] DEFAULT ARRAY['1:1']::TEXT[],
  user_id UUID,
  is_global BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.presets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read active presets" ON public.presets
  FOR SELECT TO authenticated
  USING (active = true AND (is_global = true OR user_id = auth.uid()));

CREATE POLICY "Admins can manage all presets" ON public.presets
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- 2. Placeholder-Definitionen (Feld-Typen)
CREATE TABLE public.placeholder_definitions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  key TEXT NOT NULL UNIQUE,
  label TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'text',
  options JSONB DEFAULT '[]'::jsonb,
  default_value TEXT,
  required BOOLEAN NOT NULL DEFAULT false,
  placeholder_text TEXT,
  description TEXT,
  parent_id UUID REFERENCES public.placeholder_definitions(id),
  trigger_value TEXT,
  condition JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.placeholder_definitions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read placeholder definitions" ON public.placeholder_definitions
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Admins can manage placeholder definitions" ON public.placeholder_definitions
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- 3. Preset-Placeholder-Zuordnung (Junction)
CREATE TABLE public.preset_placeholders (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  preset_id UUID NOT NULL REFERENCES public.presets(id) ON DELETE CASCADE,
  placeholder_id UUID NOT NULL REFERENCES public.placeholder_definitions(id) ON DELETE CASCADE,
  display_order INTEGER NOT NULL DEFAULT 0,
  overrides JSONB,
  UNIQUE(preset_id, placeholder_id)
);

ALTER TABLE public.preset_placeholders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read preset placeholders" ON public.preset_placeholders
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Admins can manage preset placeholders" ON public.preset_placeholders
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
