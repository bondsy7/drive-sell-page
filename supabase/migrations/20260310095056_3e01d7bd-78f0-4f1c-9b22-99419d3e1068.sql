UPDATE admin_settings SET value = '{
  "image_generate": {"standard": 3, "pro": 8, "schnell": 3, "qualitaet": 5, "premium": 8, "turbo": 6, "ultra": 10},
  "image_remaster": {"standard": 2, "pro": 5, "schnell": 2, "qualitaet": 3, "premium": 5, "turbo": 4, "ultra": 7},
  "landing_page_export": {"standard": 1, "pro": 1, "schnell": 1, "qualitaet": 1, "premium": 1, "turbo": 1, "ultra": 1},
  "pdf_analysis": {"standard": 1, "pro": 1, "schnell": 1, "qualitaet": 1, "premium": 1, "turbo": 1, "ultra": 1},
  "vin_ocr": {"standard": 1, "pro": 1, "schnell": 1, "qualitaet": 1, "premium": 1, "turbo": 1, "ultra": 1}
}'::jsonb, updated_at = now() WHERE key = 'credit_costs';