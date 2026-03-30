-- Clean up duplicate remastered input images (keep only the earliest per perspective+folder)
DELETE FROM project_images
WHERE id IN (
  SELECT id FROM (
    SELECT id, ROW_NUMBER() OVER (
      PARTITION BY gallery_folder, perspective 
      ORDER BY created_at ASC
    ) as rn
    FROM project_images
    WHERE perspective NOT LIKE 'Pipeline:%'
  ) sub
  WHERE rn > 1
);