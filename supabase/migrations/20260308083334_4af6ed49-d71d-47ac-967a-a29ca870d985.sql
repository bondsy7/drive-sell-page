
-- ============================================
-- PHASE 1: Monetization Schema
-- ============================================

-- 1. Enums
CREATE TYPE public.app_role AS ENUM ('admin', 'moderator', 'user');
CREATE TYPE public.subscription_status AS ENUM ('active', 'cancelled', 'past_due', 'trialing');
CREATE TYPE public.billing_cycle AS ENUM ('monthly', 'yearly');
CREATE TYPE public.credit_action_type AS ENUM (
  'pdf_analysis', 'image_generate', 'image_remaster', 'vin_ocr',
  'credit_purchase', 'subscription_reset', 'admin_adjustment', 'landing_page_export'
);

-- 2. subscription_plans (public read)
CREATE TABLE public.subscription_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  monthly_credits INTEGER NOT NULL DEFAULT 0,
  price_monthly_cents INTEGER NOT NULL DEFAULT 0,
  price_yearly_cents INTEGER NOT NULL DEFAULT 0,
  extra_credit_price_cents INTEGER NOT NULL DEFAULT 0,
  features JSONB NOT NULL DEFAULT '[]'::jsonb,
  sort_order INTEGER NOT NULL DEFAULT 0,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.subscription_plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read plans" ON public.subscription_plans FOR SELECT USING (true);

-- 3. user_roles
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  UNIQUE (user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- 4. Security definer function for role check (BEFORE RLS policies that use it)
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role
  )
$$;

-- RLS for user_roles
CREATE POLICY "Users can view own roles" ON public.user_roles FOR SELECT
  TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Admins can manage all roles" ON public.user_roles FOR ALL
  TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- 5. user_subscriptions
CREATE TABLE public.user_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  plan_id UUID REFERENCES public.subscription_plans(id) NOT NULL,
  status subscription_status NOT NULL DEFAULT 'active',
  billing_cycle billing_cycle NOT NULL DEFAULT 'monthly',
  current_period_start TIMESTAMPTZ NOT NULL DEFAULT now(),
  current_period_end TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '1 month'),
  stripe_subscription_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.user_subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own subscription" ON public.user_subscriptions FOR SELECT
  TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Admins can manage subscriptions" ON public.user_subscriptions FOR ALL
  TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- 6. credit_balances
CREATE TABLE public.credit_balances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  balance INTEGER NOT NULL DEFAULT 10,
  lifetime_used INTEGER NOT NULL DEFAULT 0,
  last_reset_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.credit_balances ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own balance" ON public.credit_balances FOR SELECT
  TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Admins can manage balances" ON public.credit_balances FOR ALL
  TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- 7. credit_transactions
CREATE TABLE public.credit_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  amount INTEGER NOT NULL,
  action_type credit_action_type NOT NULL,
  model_used TEXT,
  description TEXT,
  reference_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.credit_transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own transactions" ON public.credit_transactions FOR SELECT
  TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Admins can manage transactions" ON public.credit_transactions FOR ALL
  TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- 8. admin_settings
CREATE TABLE public.admin_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT NOT NULL UNIQUE,
  value JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID REFERENCES auth.users(id)
);
ALTER TABLE public.admin_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read settings" ON public.admin_settings FOR SELECT USING (true);
CREATE POLICY "Admins can manage settings" ON public.admin_settings FOR ALL
  TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- 9. Atomic credit deduction function
CREATE OR REPLACE FUNCTION public.deduct_credits(
  _user_id UUID,
  _amount INTEGER,
  _action_type credit_action_type,
  _model TEXT DEFAULT NULL,
  _description TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _balance INTEGER;
  _new_balance INTEGER;
BEGIN
  -- Get current balance with row lock
  SELECT balance INTO _balance FROM public.credit_balances WHERE user_id = _user_id FOR UPDATE;
  
  IF _balance IS NULL THEN
    -- Auto-create balance for new users
    INSERT INTO public.credit_balances (user_id, balance) VALUES (_user_id, 10)
    ON CONFLICT (user_id) DO NOTHING;
    SELECT balance INTO _balance FROM public.credit_balances WHERE user_id = _user_id FOR UPDATE;
  END IF;

  IF _balance < _amount THEN
    RETURN jsonb_build_object('success', false, 'error', 'insufficient_credits', 'balance', _balance, 'cost', _amount);
  END IF;

  _new_balance := _balance - _amount;

  UPDATE public.credit_balances
  SET balance = _new_balance, lifetime_used = lifetime_used + _amount
  WHERE user_id = _user_id;

  INSERT INTO public.credit_transactions (user_id, amount, action_type, model_used, description)
  VALUES (_user_id, -_amount, _action_type, _model, _description);

  RETURN jsonb_build_object('success', true, 'balance', _new_balance, 'cost', _amount);
END;
$$;

-- 10. Add credits function
CREATE OR REPLACE FUNCTION public.add_credits(
  _user_id UUID,
  _amount INTEGER,
  _action_type credit_action_type,
  _description TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _new_balance INTEGER;
BEGIN
  INSERT INTO public.credit_balances (user_id, balance)
  VALUES (_user_id, 10 + _amount)
  ON CONFLICT (user_id) DO UPDATE SET balance = credit_balances.balance + _amount;

  SELECT balance INTO _new_balance FROM public.credit_balances WHERE user_id = _user_id;

  INSERT INTO public.credit_transactions (user_id, amount, action_type, description)
  VALUES (_user_id, _amount, _action_type, _description);

  RETURN jsonb_build_object('success', true, 'balance', _new_balance);
END;
$$;

-- 11. Auto-create credit balance on user signup (extend existing trigger)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, contact_name)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', ''));
  
  INSERT INTO public.credit_balances (user_id, balance)
  VALUES (NEW.id, 10);
  
  RETURN NEW;
END;
$$;

-- 12. Seed subscription plans
INSERT INTO public.subscription_plans (name, slug, monthly_credits, price_monthly_cents, price_yearly_cents, extra_credit_price_cents, features, sort_order) VALUES
  ('Free', 'free', 0, 0, 0, 0, '["10 Credits einmalig","PDF-Analyse","Standard Bildqualität","Landing Page Export"]'::jsonb, 0),
  ('Starter', 'starter', 50, 2900, 27840, 20, '["50 Credits/Monat","PDF-Analyse","Standard + Pro Bildqualität","Landing Page Export","VIN-OCR","Priority Support"]'::jsonb, 1),
  ('Pro', 'pro', 200, 7900, 75840, 15, '["200 Credits/Monat","Alles aus Starter","Pro Bildqualität bevorzugt","Erweiterte Statistiken","API-Zugang"]'::jsonb, 2),
  ('Enterprise', 'enterprise', 600, 19900, 191040, 10, '["600 Credits/Monat","Alles aus Pro","Dedizierter Support","Custom Branding","SLA"]'::jsonb, 3);

-- 13. Seed admin_settings with credit costs
INSERT INTO public.admin_settings (key, value) VALUES
  ('credit_costs', '{
    "pdf_analysis": {"standard": 1, "pro": 1},
    "image_generate": {"standard": 3, "pro": 8},
    "image_remaster": {"standard": 2, "pro": 5},
    "vin_ocr": {"standard": 1, "pro": 1},
    "landing_page_export": {"standard": 0, "pro": 0}
  }'::jsonb),
  ('ai_prompts', '{
    "pdf_analysis": "default",
    "image_generate": "default",
    "image_remaster": "default",
    "vin_ocr": "default"
  }'::jsonb);
