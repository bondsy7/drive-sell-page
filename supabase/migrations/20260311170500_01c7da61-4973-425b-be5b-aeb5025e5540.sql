
-- Dealer availability / working hours
CREATE TABLE public.dealer_availability (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  day_of_week integer NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  start_time time NOT NULL DEFAULT '09:00',
  end_time time NOT NULL DEFAULT '18:00',
  is_available boolean NOT NULL DEFAULT true,
  slot_duration_minutes integer NOT NULL DEFAULT 30,
  max_parallel_bookings integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, day_of_week)
);

ALTER TABLE public.dealer_availability ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own availability" ON public.dealer_availability
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Blocked dates (holidays, special closings)
CREATE TABLE public.dealer_blocked_dates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  blocked_date date NOT NULL,
  reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, blocked_date)
);

ALTER TABLE public.dealer_blocked_dates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own blocked dates" ON public.dealer_blocked_dates
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Test drive bookings
CREATE TABLE public.test_drive_bookings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  lead_id uuid REFERENCES public.leads(id) ON DELETE SET NULL,
  project_id uuid REFERENCES public.projects(id) ON DELETE SET NULL,
  conversation_id uuid REFERENCES public.sales_assistant_conversations(id) ON DELETE SET NULL,
  customer_name text NOT NULL,
  customer_email text,
  customer_phone text,
  vehicle_title text,
  booking_date date NOT NULL,
  booking_time time NOT NULL,
  duration_minutes integer NOT NULL DEFAULT 30,
  status text NOT NULL DEFAULT 'pending',
  notes text,
  reminder_sent boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.test_drive_bookings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own bookings" ON public.test_drive_bookings
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Calendar sync configurations
CREATE TABLE public.calendar_sync_configs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  provider text NOT NULL DEFAULT 'none',
  is_active boolean NOT NULL DEFAULT false,
  sync_direction text NOT NULL DEFAULT 'both',
  external_calendar_id text,
  access_token_encrypted text,
  refresh_token_encrypted text,
  token_expires_at timestamptz,
  last_synced_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, provider)
);

ALTER TABLE public.calendar_sync_configs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own calendar configs" ON public.calendar_sync_configs
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Trade-in valuations
CREATE TABLE public.trade_in_valuations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  conversation_id uuid REFERENCES public.sales_assistant_conversations(id) ON DELETE SET NULL,
  lead_id uuid REFERENCES public.leads(id) ON DELETE SET NULL,
  vehicle_make text,
  vehicle_model text,
  vehicle_year integer,
  mileage_km integer,
  condition text DEFAULT 'good',
  estimated_value_min integer,
  estimated_value_max integer,
  notes text,
  status text NOT NULL DEFAULT 'draft',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.trade_in_valuations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own valuations" ON public.trade_in_valuations
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Quotes / Angebote
CREATE TABLE public.sales_quotes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  conversation_id uuid REFERENCES public.sales_assistant_conversations(id) ON DELETE SET NULL,
  lead_id uuid REFERENCES public.leads(id) ON DELETE SET NULL,
  project_id uuid REFERENCES public.projects(id) ON DELETE SET NULL,
  vehicle_title text,
  base_price integer,
  discount_amount integer DEFAULT 0,
  discount_reason text,
  trade_in_value integer DEFAULT 0,
  final_price integer,
  financing_monthly_rate integer,
  financing_term_months integer,
  financing_down_payment integer,
  leasing_monthly_rate integer,
  leasing_term_months integer,
  leasing_mileage_per_year integer,
  valid_until date,
  status text NOT NULL DEFAULT 'draft',
  notes text,
  sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.sales_quotes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own quotes" ON public.sales_quotes
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Email outbox for sent emails
CREATE TABLE public.sales_email_outbox (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  conversation_id uuid REFERENCES public.sales_assistant_conversations(id) ON DELETE SET NULL,
  lead_id uuid REFERENCES public.leads(id) ON DELETE SET NULL,
  to_email text NOT NULL,
  to_name text,
  subject text NOT NULL,
  body_html text NOT NULL,
  body_text text,
  status text NOT NULL DEFAULT 'queued',
  sent_at timestamptz,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.sales_email_outbox ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own emails" ON public.sales_email_outbox
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Enable realtime for bookings
ALTER PUBLICATION supabase_realtime ADD TABLE public.test_drive_bookings;
