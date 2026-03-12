
-- Table to log journey stage changes with reason
CREATE TABLE public.conversation_stage_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES public.sales_assistant_conversations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  previous_stage text,
  new_stage text NOT NULL,
  reason text,
  changed_by text NOT NULL DEFAULT 'manual', -- 'manual' or 'bot'
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.conversation_stage_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own stage logs"
  ON public.conversation_stage_log
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Table for manual customer replies posted in CRM timeline
CREATE TABLE public.crm_manual_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid REFERENCES public.sales_assistant_conversations(id) ON DELETE CASCADE,
  lead_id uuid REFERENCES public.leads(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  note_type text NOT NULL DEFAULT 'customer_reply', -- 'customer_reply', 'internal_note', 'stage_change'
  content text NOT NULL,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.crm_manual_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own crm notes"
  ON public.crm_manual_notes
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
