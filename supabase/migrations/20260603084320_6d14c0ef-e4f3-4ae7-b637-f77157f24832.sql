INSERT INTO public.user_module_access (user_id, module_key, enabled, updated_at) VALUES
('3c49b62c-4713-4d39-8e1c-f4392d68fc80','photos',false, now()),
('3c49b62c-4713-4d39-8e1c-f4392d68fc80','photos-preset',false, now()),
('3c49b62c-4713-4d39-8e1c-f4392d68fc80','photos-multi',false, now()),
('3c49b62c-4713-4d39-8e1c-f4392d68fc80','photos-spin360',false, now()),
('3c49b62c-4713-4d39-8e1c-f4392d68fc80','studio',false, now()),
('3c49b62c-4713-4d39-8e1c-f4392d68fc80','pdf-landing',true, now()),
('3c49b62c-4713-4d39-8e1c-f4392d68fc80','manual-landing',false, now()),
('3c49b62c-4713-4d39-8e1c-f4392d68fc80','banner',true, now()),
('3c49b62c-4713-4d39-8e1c-f4392d68fc80','canvas-banner-studio',false, now()),
('3c49b62c-4713-4d39-8e1c-f4392d68fc80','video',false, now()),
('3c49b62c-4713-4d39-8e1c-f4392d68fc80','damage-repair',false, now()),
('3c49b62c-4713-4d39-8e1c-f4392d68fc80','damage-analysis',false, now()),
('3c49b62c-4713-4d39-8e1c-f4392d68fc80','sales-assistant',false, now())
ON CONFLICT (user_id, module_key) DO UPDATE SET enabled=EXCLUDED.enabled, updated_at=now();