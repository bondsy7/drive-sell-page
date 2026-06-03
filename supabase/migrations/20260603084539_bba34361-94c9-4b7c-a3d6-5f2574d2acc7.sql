UPDATE public.user_module_access SET enabled=true, updated_at=now()
WHERE user_id='3c49b62c-4713-4d39-8e1c-f4392d68fc80'
  AND module_key IN ('photos','photos-preset','photos-multi','photos-spin360','video');