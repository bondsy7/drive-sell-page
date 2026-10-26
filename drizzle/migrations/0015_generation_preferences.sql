CREATE TABLE public.generation_preferences (
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  preference_key text NOT NULL,
  name text,
  settings jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, preference_key)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.generation_preferences TO authenticated;
GRANT ALL ON public.generation_preferences TO service_role;
ALTER TABLE public.generation_preferences ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own generation preferences" ON public.generation_preferences FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER generation_preferences_updated_at BEFORE UPDATE ON public.generation_preferences FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();