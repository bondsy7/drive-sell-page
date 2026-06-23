CREATE OR REPLACE FUNCTION public.add_credits(_user_id uuid, _amount integer, _action_type credit_action_type, _description text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _new_balance INTEGER;
BEGIN
  -- Nur Admins dürfen Credits manuell hinzufügen (außer service_role aus Edge Functions)
  IF auth.uid() IS NOT NULL AND NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'permission denied: admin role required';
  END IF;

  INSERT INTO public.credit_balances (user_id, balance)
  VALUES (_user_id, 10 + _amount)
  ON CONFLICT (user_id) DO UPDATE SET balance = credit_balances.balance + _amount;

  SELECT balance INTO _new_balance FROM public.credit_balances WHERE user_id = _user_id;

  INSERT INTO public.credit_transactions (user_id, amount, action_type, description)
  VALUES (_user_id, _amount, _action_type, _description);

  RETURN jsonb_build_object('success', true, 'balance', _new_balance);
END;
$function$;

GRANT EXECUTE ON FUNCTION public.add_credits(uuid, integer, credit_action_type, text) TO authenticated;