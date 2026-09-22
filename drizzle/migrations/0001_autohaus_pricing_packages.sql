-- Neue Paketstruktur gemäß autohaus.ai (netto zzgl. USt.)
INSERT INTO public.subscription_plans (name, slug, monthly_credits, price_monthly_cents, price_yearly_cents, extra_credit_price_cents, features, sort_order, active)
VALUES
  ('Basic',    'basic',    600,   39900,  478800, 50, '["ca. 30 Fahrzeuge mtl.","600 Credits inklusive","360 Fahrzeugbilder","30 Instagram-Motive","30 Facebook-Motive","30 Google-Banner"]'::jsonb,   10, true),
  ('Advanced', 'advanced', 1000,  49900,  598800, 50, '["ca. 50 Fahrzeuge mtl.","1.000 Credits inklusive","600 Fahrzeugbilder","50 Instagram-Motive","50 Facebook-Motive","50 Google-Banner"]'::jsonb,  11, true),
  ('Premium',  'premium',  2000,  89900, 1078800, 45, '["Für Mehrmarken-Autohäuser","ca. 100 Fahrzeuge mtl.","2.000 Credits inklusive","1.200 Fahrzeugbilder","100 Instagram-Motive","100 Facebook-Motive","100 Google-Banner"]'::jsonb, 12, true),
  ('Ultra',    'ultra',    4000, 159800, 1917600, 40, '["Für Autohaus-Gruppen","ca. 200 Fahrzeuge mtl.","4.000 Credits inklusive","2.400 Fahrzeugbilder","200 Instagram-Motive","200 Facebook-Motive","200 Google-Banner"]'::jsonb, 13, true),
  ('Fotoservice 1',   'foto1',     16,    999,   11988, 50, '["1 Fahrzeug mtl.","16 Perspektiven pro Fahrzeug"]'::jsonb,   20, true),
  ('Fotoservice 25',  'foto25',   400,  19900,  238800, 50, '["25 Fahrzeuge mtl.","16 Perspektiven pro Fahrzeug","7,99 € pro Fahrzeug"]'::jsonb,  21, true),
  ('Fotoservice 50',  'foto50',   800,  34900,  418800, 50, '["50 Fahrzeuge mtl.","16 Perspektiven pro Fahrzeug","6,99 € pro Fahrzeug"]'::jsonb,  22, true),
  ('Fotoservice 100', 'foto100', 1600,  59900,  718800, 45, '["100 Fahrzeuge mtl.","16 Perspektiven pro Fahrzeug","5,99 € pro Fahrzeug"]'::jsonb, 23, true),
  ('Fotoservice 200', 'foto200', 3200, 109800, 1317600, 40, '["200 Fahrzeuge mtl.","16 Perspektiven pro Fahrzeug","5,49 € pro Fahrzeug"]'::jsonb, 24, true)
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  monthly_credits = EXCLUDED.monthly_credits,
  price_monthly_cents = EXCLUDED.price_monthly_cents,
  price_yearly_cents = EXCLUDED.price_yearly_cents,
  extra_credit_price_cents = EXCLUDED.extra_credit_price_cents,
  features = EXCLUDED.features,
  sort_order = EXCLUDED.sort_order,
  active = true;

-- Altes Einzelpaket wird nicht mehr neu verkauft; bestehende Abos bleiben unberührt.
UPDATE public.subscription_plans SET active = false WHERE slug = 'basis';

-- Credit-Verbrauch an die neue Preisliste angleichen (0,50 € je Credit):
-- Fahrzeug = 16 Bilder, Post/Banner = 5, Video = 17, Landingpage = 19
UPDATE public.admin_settings
SET value = jsonb_set(
      jsonb_set(
        jsonb_set(
          jsonb_set(value, '{banner_generate}', '{"schnell":5,"qualitaet":5,"turbo":5,"neu":5,"premium":5,"ultra":5}'::jsonb, true),
          '{video_generate_standard}', '{"schnell":17,"qualitaet":17,"turbo":17,"neu":17,"premium":17,"ultra":17}'::jsonb, true),
        '{video_generate_audio}', '{"schnell":17,"qualitaet":17,"turbo":17,"neu":17,"premium":17,"ultra":17}'::jsonb, true),
      '{landing_page_export}', '{"schnell":19,"qualitaet":19,"turbo":19,"neu":19,"premium":19,"ultra":19}'::jsonb, true)
WHERE key = 'credit_costs';