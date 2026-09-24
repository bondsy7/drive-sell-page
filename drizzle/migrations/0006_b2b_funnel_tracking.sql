ALTER TABLE public.b2b_marketing_leads
  ADD COLUMN IF NOT EXISTS owner text,
  ADD COLUMN IF NOT EXISTS validated_at timestamptz,
  ADD COLUMN IF NOT EXISTS contacted_at timestamptz,
  ADD COLUMN IF NOT EXISTS demo_requested_at timestamptz,
  ADD COLUMN IF NOT EXISTS demo_booked_at timestamptz,
  ADD COLUMN IF NOT EXISTS demo_scheduled_for timestamptz,
  ADD COLUMN IF NOT EXISTS demo_held_at timestamptz,
  ADD COLUMN IF NOT EXISTS sql_at timestamptz,
  ADD COLUMN IF NOT EXISTS proposal_at timestamptz,
  ADD COLUMN IF NOT EXISTS won_at timestamptz,
  ADD COLUMN IF NOT EXISTS lost_at timestamptz,
  ADD COLUMN IF NOT EXISTS next_step text,
  ADD COLUMN IF NOT EXISTS next_step_date date,
  ADD COLUMN IF NOT EXISTS lost_reason text,
  ADD COLUMN IF NOT EXISTS opportunity_id text,
  ADD COLUMN IF NOT EXISTS license_id text,
  ADD COLUMN IF NOT EXISTS license_qty integer,
  ADD COLUMN IF NOT EXISTS net_contract_value numeric(12,2),
  ADD COLUMN IF NOT EXISTS gbraid text,
  ADD COLUMN IF NOT EXISTS wbraid text,
  ADD COLUMN IF NOT EXISTS last_touch jsonb,
  ADD COLUMN IF NOT EXISTS step2_completed_at timestamptz,
  ADD COLUMN IF NOT EXISTS step2_token uuid DEFAULT gen_random_uuid(),
  ADD COLUMN IF NOT EXISTS funnel_type text NOT NULL DEFAULT 'vehicle_test';

-- Bisherige "demo_booked" waren nur Wünsche
UPDATE public.b2b_marketing_leads SET status = 'demo_requested' WHERE status = 'demo_booked' AND demo_scheduled_for IS NULL;
UPDATE public.b2b_marketing_leads SET status = 'sql' WHERE status = 'qualified';

CREATE OR REPLACE FUNCTION public.b2b_lead_status_timestamps()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' OR NEW.status IS DISTINCT FROM OLD.status THEN
    CASE NEW.status
      WHEN 'validated' THEN NEW.validated_at := COALESCE(NEW.validated_at, now());
      WHEN 'contacted' THEN NEW.contacted_at := COALESCE(NEW.contacted_at, now());
      WHEN 'demo_requested' THEN NEW.demo_requested_at := COALESCE(NEW.demo_requested_at, now());
      WHEN 'demo_booked' THEN NEW.demo_booked_at := COALESCE(NEW.demo_booked_at, now());
      WHEN 'demo_held' THEN NEW.demo_held_at := COALESCE(NEW.demo_held_at, now());
      WHEN 'sql' THEN NEW.sql_at := COALESCE(NEW.sql_at, now());
      WHEN 'proposal' THEN NEW.proposal_at := COALESCE(NEW.proposal_at, now());
      WHEN 'won' THEN NEW.won_at := COALESCE(NEW.won_at, now());
      WHEN 'lost' THEN NEW.lost_at := COALESCE(NEW.lost_at, now());
      ELSE NULL;
    END CASE;
  END IF;
  IF NEW.demo_requested AND NEW.demo_requested_at IS NULL THEN NEW.demo_requested_at := now(); END IF;
  NEW.updated_at := now();
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_b2b_lead_status_ts ON public.b2b_marketing_leads;
CREATE TRIGGER trg_b2b_lead_status_ts BEFORE INSERT OR UPDATE ON public.b2b_marketing_leads
  FOR EACH ROW EXECUTE FUNCTION public.b2b_lead_status_timestamps();

CREATE TABLE public.marketing_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  event_name text NOT NULL,
  event_id text NOT NULL UNIQUE,
  lead_id uuid REFERENCES public.b2b_marketing_leads(id) ON DELETE SET NULL,
  session_id text,
  page text,
  utm_source text,
  utm_medium text,
  utm_campaign text,
  utm_content text,
  utm_term text,
  has_click_id boolean NOT NULL DEFAULT false,
  consent_analytics boolean NOT NULL DEFAULT false,
  consent_marketing boolean NOT NULL DEFAULT false,
  source text NOT NULL DEFAULT 'web',
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb
);
CREATE INDEX marketing_events_name_time ON public.marketing_events (event_name, created_at DESC);
CREATE INDEX marketing_events_lead ON public.marketing_events (lead_id);

GRANT SELECT, INSERT ON public.marketing_events TO authenticated;
GRANT ALL ON public.marketing_events TO service_role;
ALTER TABLE public.marketing_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins read marketing events" ON public.marketing_events
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins insert marketing events" ON public.marketing_events
  FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));