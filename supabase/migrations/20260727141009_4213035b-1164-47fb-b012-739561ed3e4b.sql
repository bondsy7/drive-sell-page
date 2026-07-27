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
  SET balance = _new_balance, lifetime_used = lifetime_used + _amount
  WHERE user_id = _user_id;

  INSERT INTO public.credit_transactions (user_id, amount, action_type, model_used, description)
  VALUES (_user_id, -_amount, _action_type, _model, _description);

  RETURN jsonb_build_object('success', true, 'balance', _new_balance, 'cost', _amount);
END;
$function$;

GRANT EXECUTE ON FUNCTION public.add_credits(uuid, integer, credit_action_type, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.deduct_credits(uuid, integer, credit_action_type, text, text) TO authenticated;