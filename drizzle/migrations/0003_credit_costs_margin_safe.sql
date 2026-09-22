UPDATE public.admin_settings
SET value = value
  || jsonb_build_object(
    'image_analysis', jsonb_build_object('schnell',1,'qualitaet',1,'turbo',1,'neu',1,'premium',1,'ultra',1),
    'text_generate',  jsonb_build_object('schnell',1,'qualitaet',1,'turbo',1,'neu',1,'premium',1,'ultra',1),
    'chat_message',   jsonb_build_object('schnell',1,'qualitaet',1,'turbo',1,'neu',1,'premium',1,'ultra',1),
    'banner_reframe', jsonb_build_object('schnell',3,'qualitaet',3,'turbo',3,'neu',3,'premium',3,'ultra',3),
    'music_generate', jsonb_build_object('schnell',5,'qualitaet',5,'turbo',5,'neu',5,'premium',5,'ultra',5),
    'video_generate', jsonb_build_object('schnell',17,'qualitaet',17,'turbo',17,'neu',17,'premium',17,'ultra',17)
  )
WHERE key = 'credit_costs';