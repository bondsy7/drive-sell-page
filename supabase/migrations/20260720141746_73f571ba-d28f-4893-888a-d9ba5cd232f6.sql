insert into public.user_module_access (user_id, module_key, enabled, updated_at)
values
  ('d75734d2-9add-443b-9d3d-d1a0c8acbefa', 'remaster-cleanup', true, now()),
  ('753b5f67-58ad-493f-a031-200016d23a95', 'remaster-cleanup', true, now())
on conflict (user_id, module_key) do update set enabled = excluded.enabled, updated_at = now();