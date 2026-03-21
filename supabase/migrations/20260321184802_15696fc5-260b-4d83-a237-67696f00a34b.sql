
-- Replace broad authenticated read with granular access
DROP POLICY IF EXISTS "Authenticated can read settings" ON public.admin_settings;

-- Regular users can only read specific non-sensitive settings
CREATE POLICY "Users can read public settings"
  ON public.admin_settings
  FOR SELECT
  TO authenticated
  USING (key IN ('credit_costs', 'ai_prompts'));
