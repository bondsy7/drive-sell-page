DELETE FROM public.project_images WHERE vehicle_id='d09b13d8-6183-42b8-a141-beb57d612fe2';
DELETE FROM public.spin360_jobs WHERE vehicle_id='d09b13d8-6183-42b8-a141-beb57d612fe2';
DELETE FROM public.projects WHERE vehicle_id='d09b13d8-6183-42b8-a141-beb57d612fe2';
UPDATE public.vehicles SET cover_image_url=NULL WHERE id='d09b13d8-6183-42b8-a141-beb57d612fe2';