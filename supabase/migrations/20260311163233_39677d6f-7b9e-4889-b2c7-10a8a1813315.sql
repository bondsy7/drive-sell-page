
-- Add autopilot columns to sales_assistant_profiles
ALTER TABLE public.sales_assistant_profiles
  ADD COLUMN IF NOT EXISTS autopilot_mode text NOT NULL DEFAULT 'approval',
  ADD COLUMN IF NOT EXISTS auto_reply_stages text[] DEFAULT ARRAY['new_lead','first_contact']::text[],
  ADD COLUMN IF NOT EXISTS auto_follow_up_enabled boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS auto_follow_up_delay_hours integer DEFAULT 24,
  ADD COLUMN IF NOT EXISTS daily_summary_enabled boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS weekly_summary_enabled boolean DEFAULT true;

-- Create notifications table
CREATE TABLE IF NOT EXISTS public.sales_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  notification_type text NOT NULL DEFAULT 'info',
  title text NOT NULL,
  body text,
  action_type text,
  action_payload jsonb DEFAULT '{}'::jsonb,
  is_read boolean DEFAULT false,
  requires_approval boolean DEFAULT false,
  approval_status text DEFAULT 'pending',
  related_conversation_id uuid REFERENCES public.sales_assistant_conversations(id) ON DELETE CASCADE,
  related_lead_id uuid REFERENCES public.leads(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.sales_notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own notifications"
  ON public.sales_notifications FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can view all notifications"
  ON public.sales_notifications FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Create chat messages table for the internal assistant chatbot
CREATE TABLE IF NOT EXISTS public.sales_chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  role text NOT NULL DEFAULT 'user',
  content text NOT NULL,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.sales_chat_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own chat messages"
  ON public.sales_chat_messages FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Enable realtime for notifications
ALTER PUBLICATION supabase_realtime ADD TABLE public.sales_notifications;
