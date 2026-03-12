
ALTER TABLE public.leads
  ADD COLUMN interested_test_drive boolean NOT NULL DEFAULT false,
  ADD COLUMN interested_trade_in boolean NOT NULL DEFAULT false,
  ADD COLUMN interested_leasing boolean NOT NULL DEFAULT false,
  ADD COLUMN interested_financing boolean NOT NULL DEFAULT false,
  ADD COLUMN interested_purchase boolean NOT NULL DEFAULT false;
