
INSERT INTO public.admin_settings (key, value)
VALUES ('credit_costs', '{
  "pdf_analysis":          {"schnell":1,"qualitaet":1,"premium":2,"turbo":1,"ultra":2,"neu":2},
  "vin_ocr":               {"schnell":1,"qualitaet":1,"premium":1,"turbo":1,"ultra":1,"neu":1},
  "image_generate":        {"schnell":1,"qualitaet":1,"premium":2,"turbo":1,"ultra":2,"neu":3},
  "image_remaster":        {"schnell":1,"qualitaet":1,"premium":2,"turbo":1,"ultra":2,"neu":2},
  "banner_generate":       {"schnell":1,"qualitaet":1,"premium":2,"turbo":1,"ultra":2,"neu":2},
  "video_generate":        {"schnell":4,"qualitaet":4,"premium":5,"turbo":4,"ultra":5,"neu":5},
  "video_generate_standard":{"schnell":10,"qualitaet":10,"premium":12,"turbo":10,"ultra":12,"neu":12},
  "video_generate_audio":  {"schnell":10,"qualitaet":10,"premium":12,"turbo":10,"ultra":12,"neu":12},
  "spin360_analysis":      {"schnell":1,"qualitaet":1,"premium":1,"turbo":1,"ultra":1,"neu":1},
  "spin360_normalize":     {"schnell":1,"qualitaet":1,"premium":2,"turbo":1,"ultra":2,"neu":2},
  "spin360_generate":      {"schnell":8,"qualitaet":10,"premium":12,"turbo":10,"ultra":12,"neu":12},
  "spin360_video":         {"schnell":4,"qualitaet":4,"premium":5,"turbo":4,"ultra":5,"neu":5},
  "spin360_export":        {"schnell":1,"qualitaet":1,"premium":1,"turbo":1,"ultra":1,"neu":1},
  "landing_page_export":   {"schnell":8,"qualitaet":10,"premium":15,"turbo":10,"ultra":15,"neu":15},
  "sales_response":        {"schnell":1,"qualitaet":1,"premium":1,"turbo":1,"ultra":1,"neu":1},
  "auto_process_lead":     {"schnell":1,"qualitaet":1,"premium":1,"turbo":1,"ultra":1,"neu":1}
}'::jsonb)
ON CONFLICT (key) DO UPDATE
  SET value = EXCLUDED.value,
      updated_at = now();
