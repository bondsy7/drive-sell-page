UPDATE public.banner_templates
SET spec = jsonb_set(
  spec,
  '{layers}',
  (
    SELECT jsonb_agg(
      CASE WHEN l->>'id' = 'headline'
        THEN jsonb_build_array(
          l,
          jsonb_build_object(
            'x', 54, 'y', 150, 'id', 'subline', 'type', 'text',
            'align', 'left', 'color', 'background', 'field', 'subline',
            'width', 972, 'visible', true, 'fontSize', 38,
            'draggable', true, 'fontWeight', 400
          )
        )
        ELSE jsonb_build_array(l)
      END
    )
    FROM (
      SELECT jsonb_array_elements(spec->'layers') AS l
    ) sub
  )
)
WHERE id = '0e0d6bbe-3e8d-4d85-ab3d-62929106fe8e'
  AND NOT EXISTS (
    SELECT 1 FROM jsonb_array_elements(spec->'layers') x
    WHERE x->>'id' = 'subline'
  );

-- Flatten nested arrays
UPDATE public.banner_templates
SET spec = jsonb_set(
  spec,
  '{layers}',
  (
    SELECT jsonb_agg(elem)
    FROM jsonb_array_elements(spec->'layers') arr,
         jsonb_array_elements(
           CASE WHEN jsonb_typeof(arr) = 'array' THEN arr ELSE jsonb_build_array(arr) END
         ) elem
  )
)
WHERE id = '0e0d6bbe-3e8d-4d85-ab3d-62929106fe8e';

-- Also shift price y down so it doesn't overlap subline
UPDATE public.banner_templates
SET spec = jsonb_set(
  spec,
  '{layers}',
  (
    SELECT jsonb_agg(
      CASE WHEN l->>'id' = 'price'
        THEN l || jsonb_build_object('y', 220)
        ELSE l
      END
    )
    FROM jsonb_array_elements(spec->'layers') l
  )
)
WHERE id = '0e0d6bbe-3e8d-4d85-ab3d-62929106fe8e';
