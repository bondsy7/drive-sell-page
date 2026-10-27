CREATE OR REPLACE FUNCTION public.create_account_approval()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF COALESCE((NEW.raw_app_meta_data->>'created_by_admin')::boolean, false) THEN RETURN NEW; END IF;
  INSERT INTO public.account_approvals (user_id, email) VALUES (NEW.id, NEW.email)
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.enforce_account_activation()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status = 'approved' AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'approved') THEN
    IF NEW.submitted_at IS NULL THEN RAISE EXCEPTION 'application_required'; END IF;
    IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = NEW.user_id AND email_confirmed_at IS NOT NULL) THEN
      RAISE EXCEPTION 'email_not_verified';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER enforce_account_activation BEFORE INSERT OR UPDATE ON public.account_approvals
FOR EACH ROW EXECUTE FUNCTION public.enforce_account_activation();

CREATE OR REPLACE FUNCTION public.is_account_approved(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT NOT EXISTS (SELECT 1 FROM public.account_approvals WHERE user_id = _user_id)
    OR EXISTS (
      SELECT 1 FROM public.account_approvals a JOIN auth.users u ON u.id = a.user_id
      WHERE a.user_id = _user_id AND a.status = 'approved'
        AND a.submitted_at IS NOT NULL AND u.email_confirmed_at IS NOT NULL
    )
$$;