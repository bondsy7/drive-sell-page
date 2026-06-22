
UPDATE public.subscription_plans SET active = false WHERE slug IN ('starter','pro','enterprise');
INSERT INTO public.subscription_plans (slug, name, monthly_credits, price_monthly_cents, price_yearly_cents, extra_credit_price_cents, features, sort_order, active)
VALUES ('basis','Basis',1000,49000,588000,50,
  '["1000 Credits pro Monat","Alle Tools enthalten (PDF, VIN, Bilder, Banner, Video, Landingpages)","Inkl. aller API- und Portal-Gebühren","Nachkauf jederzeit: 200 Credits für 100 €","E-Mail Support"]'::jsonb,
  1,true)
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  monthly_credits = EXCLUDED.monthly_credits,
  price_monthly_cents = EXCLUDED.price_monthly_cents,
  price_yearly_cents = EXCLUDED.price_yearly_cents,
  extra_credit_price_cents = EXCLUDED.extra_credit_price_cents,
  features = EXCLUDED.features,
  sort_order = EXCLUDED.sort_order,
  active = true;
