CREATE SEQUENCE public.invoice_order_number_seq START WITH 100001 INCREMENT BY 1;

CREATE TABLE public.invoice_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number text NOT NULL UNIQUE DEFAULT 'AH-' || nextval('public.invoice_order_number_seq'::regclass),
  request_id uuid NOT NULL UNIQUE,
  user_id uuid,
  offer_slug text NOT NULL,
  offer_name text NOT NULL,
  offer_kind text NOT NULL CHECK (offer_kind IN ('subscription', 'credit_pack', 'service')),
  credits integer NOT NULL DEFAULT 0 CHECK (credits >= 0),
  price_net_cents integer NOT NULL CHECK (price_net_cents >= 0),
  setup_fee_cents integer NOT NULL DEFAULT 0 CHECK (setup_fee_cents >= 0),
  vat_cents integer NOT NULL CHECK (vat_cents >= 0),
  total_gross_cents integer NOT NULL CHECK (total_gross_cents >= 0),
  currency text NOT NULL DEFAULT 'EUR' CHECK (currency = 'EUR'),
  billing_company text NOT NULL,
  billing_contact text NOT NULL,
  billing_email text NOT NULL,
  billing_phone text,
  billing_street text NOT NULL,
  billing_postal_code text NOT NULL,
  billing_city text NOT NULL,
  billing_country text NOT NULL DEFAULT 'Deutschland',
  billing_tax_id text,
  notes text,
  terms_accepted_at timestamptz NOT NULL,
  payment_term_days integer NOT NULL DEFAULT 14 CHECK (payment_term_days = 14),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'activated', 'cancelled')),
  invoice_status text NOT NULL DEFAULT 'not_sent' CHECK (invoice_status IN ('not_sent', 'sent')),
  payment_status text NOT NULL DEFAULT 'unpaid' CHECK (payment_status IN ('unpaid', 'paid')),
  invoice_number text,
  invoice_issued_at timestamptz,
  paid_at timestamptz,
  activated_at timestamptz,
  activated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.invoice_orders TO authenticated;
GRANT ALL ON public.invoice_orders TO service_role;
GRANT USAGE ON SEQUENCE public.invoice_order_number_seq TO service_role;

ALTER TABLE public.invoice_orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own invoice orders"
ON public.invoice_orders FOR SELECT TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all invoice orders"
ON public.invoice_orders FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE INDEX invoice_orders_user_id_idx ON public.invoice_orders(user_id);
CREATE INDEX invoice_orders_billing_email_idx ON public.invoice_orders(lower(billing_email));
CREATE INDEX invoice_orders_created_at_idx ON public.invoice_orders(created_at DESC);

CREATE TRIGGER update_invoice_orders_updated_at
BEFORE UPDATE ON public.invoice_orders
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.activate_invoice_order(_order_id uuid, _admin_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  _order public.invoice_orders%ROWTYPE;
  _plan public.subscription_plans%ROWTYPE;
BEGIN
  IF _admin_id IS NULL OR NOT public.has_role(_admin_id, 'admin') THEN
    RAISE EXCEPTION 'permission denied: admin role required';
  END IF;

  SELECT * INTO _order FROM public.invoice_orders WHERE id = _order_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'invoice order not found'; END IF;
  IF _order.status = 'cancelled' THEN RAISE EXCEPTION 'cancelled order cannot be activated'; END IF;
  IF _order.status = 'activated' THEN
    RETURN jsonb_build_object('success', true, 'alreadyActivated', true, 'orderNumber', _order.order_number);
  END IF;

  IF _order.offer_kind IN ('subscription', 'credit_pack') THEN
    IF _order.user_id IS NULL THEN RAISE EXCEPTION 'approved account required before activation'; END IF;
    IF NOT public.is_account_approved(_order.user_id) THEN RAISE EXCEPTION 'account is not approved'; END IF;
  END IF;

  IF _order.offer_kind = 'subscription' THEN
    SELECT * INTO _plan FROM public.subscription_plans WHERE slug = _order.offer_slug AND active = true;
    IF NOT FOUND THEN RAISE EXCEPTION 'active subscription plan not found'; END IF;

    INSERT INTO public.user_subscriptions (
      user_id, plan_id, status, billing_cycle, current_period_start,
      current_period_end, stripe_subscription_id, updated_at
    ) VALUES (
      _order.user_id, _plan.id, 'active', 'monthly', now(),
      now() + interval '1 month', NULL, now()
    )
    ON CONFLICT (user_id) DO UPDATE SET
      plan_id = EXCLUDED.plan_id,
      status = 'active',
      billing_cycle = 'monthly',
      current_period_start = EXCLUDED.current_period_start,
      current_period_end = EXCLUDED.current_period_end,
      stripe_subscription_id = NULL,
      updated_at = now();

    PERFORM public.reset_monthly_credits(
      _order.user_id,
      _plan.monthly_credits,
      format('Rechnungsauftrag %s: %s aktiviert', _order.order_number, _plan.name)
    );
  ELSIF _order.offer_kind = 'credit_pack' THEN
    PERFORM public.add_credits(
      _order.user_id,
      _order.credits,
      'credit_purchase',
      format('Rechnungsauftrag %s: %s Credits manuell freigegeben', _order.order_number, _order.credits)
    );
  END IF;

  UPDATE public.invoice_orders
  SET status = 'activated', activated_at = now(), activated_by = _admin_id
  WHERE id = _order.id;

  RETURN jsonb_build_object('success', true, 'alreadyActivated', false, 'orderNumber', _order.order_number);
END;
$$;

REVOKE ALL ON FUNCTION public.activate_invoice_order(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.activate_invoice_order(uuid, uuid) TO service_role;