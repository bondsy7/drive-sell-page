-- Reset the stuck pipeline job so user can retry
UPDATE image_generation_jobs 
SET status = 'failed',
    updated_at = now()
WHERE id = '0f0a8724-fcbb-42c9-9e71-581d4c7a6637'
  AND status = 'running';