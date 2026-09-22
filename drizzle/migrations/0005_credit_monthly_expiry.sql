-- Nicht verbrauchte Abo-Credits verfallen zum Ende des Abrechnungsmonats.
-- Nachgekaufte Credits bleiben erhalten und werden separat geführt.
ALTER TABLE public.credit_balances
  ADD COLUMN IF NOT EXISTS purchased_balance integer NOT NULL DEFAULT 0;

CREATE OR REPLACE FUNCTION public.add_credits(_user_id uuid, _amount integer, _action_type credit_action_type, _description text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _new_balance INTEGER;
BEGIN
  IF auth.uid() IS NOT NULL AND NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'permission denied: admin role required';
  END IF;

  INSERT INTO public.credit_balances (user_id, balance, purchased_balance)
  VALUES (
    _user_id,
    10 + _amount,
    CASE WHEN _action_type = 'credit_purchase' THEN _amount ELSE 0 END
  )
  ON CONFLICT (user_id) DO UPDATE SET
    balance = credit_balances.balance + _amount,
    purchased_balance = credit_balances.purchased_balance
      + CASE WHEN _action_type = 'credit_purchase' THEN _amount ELSE 0 END;

  SELECT balance INTO _new_balance FROM public.credit_balances WHERE user_id = _user_id;

  INSERT INTO public.credit_transactions (user_id, amount, action_type, description)
  VALUES (_user_id, _amount, _action_type, _description);

  RETURN jsonb_build_object('success', true, 'balance', _new_balance);
END;
$function$;

CREATE OR REPLACE FUNCTION public.deduct_credits(_user_id uuid, _amount integer, _action_type credit_action_type, _model text DEFAULT NULL::text, _description text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _balance INTEGER;
  _new_balance INTEGER;
BEGIN
  IF auth.uid() IS NOT NULL AND auth.uid() <> _user_id AND NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'permission denied';
  END IF;

  SELECT balance INTO _balance FROM public.credit_balances WHERE user_id = _user_id FOR UPDATE;

  IF _balance IS NULL THEN
    INSERT INTO public.credit_balances (user_id, balance) VALUES (_user_id, 10)
    ON CONFLICT (user_id) DO NOTHING;
    SELECT balance INTO _balance FROM public.credit_balances WHERE user_id = _user_id FOR UPDATE;
  END IF;

  IF _balance < _amount THEN
    RETURN jsonb_build_object('success', false, 'error', 'insufficient_credits', 'balance', _balance, 'cost', _amount);
  END IF;

  _new_balance := _balance - _amount;

  UPDATE public.credit_balances
  SET balance = _new_balance,
      lifetime_used = lifetime_used + _amount,
      purchased_balance = LEAST(purchased_balance, _new_balance)
  WHERE user_id = _user_id;

  INSERT INTO public.credit_transactions (user_id, amount, action_type, model_used, description)
  VALUES (_user_id, -_amount, _action_type, _model, _description);

  RETURN jsonb_build_object('success', true, 'balance', _new_balance, 'cost', _amount);
END;
$function$;

-- Monatlicher Reset: Abo-Credits verfallen, nachgekaufte Credits bleiben.
CREATE OR REPLACE FUNCTION public.reset_monthly_credits(_user_id uuid, _plan_credits integer, _description text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _balance INTEGER;
  _purchased INTEGER;
  _expired INTEGER;
  _new_balance INTEGER;
BEGIN
  IF auth.uid() IS NOT NULL AND NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'permission denied: admin role required';
  END IF;

  INSERT INTO public.credit_balances (user_id, balance, purchased_balance)
  VALUES (_user_id, 0, 0)
  ON CONFLICT (user_id) DO NOTHING;

  SELECT balance, purchased_balance INTO _balance, _purchased
  FROM public.credit_balances WHERE user_id = _user_id FOR UPDATE;

  _purchased := LEAST(COALESCE(_purchased, 0), COALESCE(_balance, 0));
  _expired := GREATEST(COALESCE(_balance, 0) - _purchased, 0);
  _new_balance := _purchased + COALESCE(_plan_credits, 0);

  UPDATE public.credit_balances
  SET balance = _new_balance, purchased_balance = _purchased
  WHERE user_id = _user_id;

  IF _expired > 0 THEN
    INSERT INTO public.credit_transactions (user_id, amount, action_type, description)
    VALUES (_user_id, -_expired, 'subscription_reset',
            format('Verfall nicht verbrauchter Credits zum Abrechnungsende (%s Credits)', _expired));
  END IF;

  IF COALESCE(_plan_credits, 0) > 0 THEN
    INSERT INTO public.credit_transactions (user_id, amount, action_type, description)
    VALUES (_user_id, _plan_credits, 'subscription_reset',
            COALESCE(_description, format('Monatliche Gutschrift: %s Credits', _plan_credits)));
  END IF;

  RETURN jsonb_build_object('success', true, 'balance', _new_balance, 'expired', _expired, 'kept_purchased', _purchased);
END;
$function$;

GRANT EXECUTE ON FUNCTION public.reset_monthly_credits(uuid, integer, text) TO service_role;