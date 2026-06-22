UPDATE public.admin_settings
SET value = jsonb_set(
              COALESCE(value, '{}'::jsonb),
              '{video_generate}',
              '{"standard":15,"fast":8,"lite":5}'::jsonb,
              true
            ),
    updated_at = now()
WHERE key = 'credit_costs';