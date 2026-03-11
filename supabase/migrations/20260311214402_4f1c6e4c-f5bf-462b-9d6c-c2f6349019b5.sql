
ALTER TABLE public.trade_in_valuations
  ADD COLUMN IF NOT EXISTS vin text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS variant text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS equipment jsonb DEFAULT '[]'::jsonb;
