CREATE TABLE public.account_approvals (
  user_id uuid PRIMARY KEY,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  full_name text,
  email text,
  phone text,
  company_name text,
  company_address text,
  company_website text,
  submitted_at timestamptz,
  decided_at timestamptz,
  decided_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.account_approvals TO authenticated;
GRANT ALL ON public.account_approvals TO service_role;
ALTER TABLE public.account_approvals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Own approval readable" ON public.account_approvals FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

-- Every self-registered account (email or Google) starts pending; admin-created accounts skip this.
CREATE OR REPLACE FUNCTION public.create_account_approval()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF COALESCE((NEW.raw_app_meta_data->>'created_by_admin')::boolean, false) THEN
    RETURN NEW;
  END IF;
  INSERT INTO public.account_approvals (user_id, email) VALUES (NEW.id, NEW.email)
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RETURN NEW;
END $$;
CREATE TRIGGER on_auth_user_created_approval
AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.create_account_approval();

CREATE OR REPLACE FUNCTION public.is_account_approved(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT NOT EXISTS (SELECT 1 FROM public.account_approvals WHERE user_id = _user_id AND status <> 'approved')
$$;

-- The approval request email replaces the plain signup email.
DROP TRIGGER IF EXISTS profiles_notify_new_signup ON public.profiles;

CREATE OR REPLACE FUNCTION public.deduct_credits(_user_id uuid, _amount integer, _action_type credit_action_type, _model text DEFAULT NULL::text, _description text DEFAULT NULL::text)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  _balance INTEGER;
  _new_balance INTEGER;
BEGIN
  IF auth.uid() IS NOT NULL AND auth.uid() <> _user_id AND NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'permission denied';
  END IF;

  IF NOT public.is_account_approved(_user_id) THEN
    RETURN jsonb_build_object('success', false, 'error', 'account_not_approved', 'balance', 0, 'cost', _amount);
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