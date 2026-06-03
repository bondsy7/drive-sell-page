
-- Table to track per-user monthly download limits
CREATE TABLE public.user_download_limits (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE,
  monthly_limit INTEGER NOT NULL DEFAULT 100,
  used_count INTEGER NOT NULL DEFAULT 0,
  period_start DATE NOT NULL DEFAULT date_trunc('month', now())::date,
  period_end DATE NOT NULL DEFAULT (date_trunc('month', now()) + INTERVAL '1 month - 1 day')::date,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_download_limits TO authenticated;
GRANT ALL ON public.user_download_limits TO service_role;

ALTER TABLE public.user_download_limits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own download limit"
ON public.user_download_limits FOR SELECT TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Admins can manage all download limits"
ON public.user_download_limits FOR ALL TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER update_user_download_limits_updated_at
BEFORE UPDATE ON public.user_download_limits
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Atomic consumption + auto-reset on new month
CREATE OR REPLACE FUNCTION public.consume_download(_user_id UUID)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _row public.user_download_limits;
  _today DATE := (now() AT TIME ZONE 'Europe/Berlin')::date;
BEGIN
  SELECT * INTO _row FROM public.user_download_limits
  WHERE user_id = _user_id FOR UPDATE;

  -- No limit configured for this user => unlimited
  IF NOT FOUND THEN
    RETURN jsonb_build_object('limited', false, 'success', true);
  END IF;

  -- Auto reset when entering a new month
  IF _today > _row.period_end THEN
    _row.used_count := 0;
    _row.period_start := date_trunc('month', _today)::date;
    _row.period_end := (date_trunc('month', _today) + INTERVAL '1 month - 1 day')::date;
  END IF;

  IF _row.used_count >= _row.monthly_limit THEN
    UPDATE public.user_download_limits
    SET period_start = _row.period_start,
        period_end = _row.period_end,
        used_count = _row.used_count
    WHERE id = _row.id;
    RETURN jsonb_build_object(
      'limited', true, 'success', false,
      'remaining', 0,
      'monthly_limit', _row.monthly_limit,
      'used', _row.used_count,
      'period_end', _row.period_end
    );
  END IF;

  UPDATE public.user_download_limits
  SET used_count = _row.used_count + 1,
      period_start = _row.period_start,
      period_end = _row.period_end
  WHERE id = _row.id;

  RETURN jsonb_build_object(
    'limited', true, 'success', true,
    'remaining', _row.monthly_limit - (_row.used_count + 1),
    'monthly_limit', _row.monthly_limit,
    'used', _row.used_count + 1,
    'period_end', _row.period_end
  );
END;
$$;

-- Seed limit for rinnetal@auto3.de (100 downloads, period Jun 2026)
INSERT INTO public.user_download_limits (user_id, monthly_limit, used_count, period_start, period_end)
VALUES ('3c49b62c-4713-4d39-8e1c-f4392d68fc80', 100, 0, '2026-06-01', '2026-06-30')
ON CONFLICT (user_id) DO NOTHING;
