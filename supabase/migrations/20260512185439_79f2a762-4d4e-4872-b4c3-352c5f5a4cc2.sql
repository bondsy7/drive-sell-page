
CREATE TABLE public.banner_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id text NOT NULL,
  format_id text NOT NULL,
  name text NOT NULL,
  spec jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_global boolean NOT NULL DEFAULT true,
  user_id uuid NULL,
  brand_key text NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX banner_templates_unique_variant
  ON public.banner_templates (
    template_id,
    format_id,
    COALESCE(user_id::text, ''),
    COALESCE(brand_key, '')
  );

CREATE INDEX banner_templates_lookup
  ON public.banner_templates (template_id, format_id, is_global, user_id);

ALTER TABLE public.banner_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage all banner templates"
  ON public.banner_templates
  FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users read global or own banner templates"
  ON public.banner_templates
  FOR SELECT
  TO authenticated
  USING (is_global = true OR user_id = auth.uid());

CREATE POLICY "Users insert own banner templates"
  ON public.banner_templates
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid() AND is_global = false);

CREATE POLICY "Users update own banner templates"
  ON public.banner_templates
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users delete own banner templates"
  ON public.banner_templates
  FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

CREATE TRIGGER banner_templates_updated_at
  BEFORE UPDATE ON public.banner_templates
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
