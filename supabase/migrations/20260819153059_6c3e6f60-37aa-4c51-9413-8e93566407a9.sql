WITH base AS (SELECT 'https://rauzclzphdnhzflovrya.supabase.co/storage/v1/object/public/vehicle-images/07e886d4-6992-4f1e-ad10-b29f5038b94d/gallery/WUAZZZF26SN907953/' AS p),
m(id, f) AS (VALUES
 ('ce4948ba-8765-422d-b355-a975e76aa29c'::uuid,'v2_EXT_FRONT_34.png'),
 ('feb56385-1af6-4401-b5a7-28dfa6e3cb21','v2_EXT_FRONT_34.png'),
 ('ccdd5b19-7aae-4b46-b340-a90b5c44dbc6','v2_EXT_FRONT_34_RIGHT.png'),
 ('2fe992b2-14d3-4b98-b1da-5c8467b713b4','v2_EXT_SIDE_RIGHT.jpeg'),
 ('f9669b85-a14f-4997-9da7-b13ae05a8078','v2_EXT_SIDE_LEFT.png'),
 ('98954f92-1b88-4b87-baa1-18b3f2012c73','v2_EXT_REAR.jpeg'),
 ('82c88960-fb13-420f-8f74-882b24c6c946','v2_EXT_REAR.jpeg'),
 ('87f62621-dc7f-42fb-a7d5-59f288cdb759','v2_EXT_FRONT.jpeg'),
 ('c8b6d02c-3938-42b5-9bba-e5b8acbb06e4','v2_DET_HEADLIGHT.jpeg'),
 ('b1c6044d-88ec-42a1-9d1b-0cebf4d6f9c0','v2_DET_TAILLIGHT.jpeg'),
 ('abf725af-4f4d-4bbf-b206-7a4e6dafc691','v2_INT_DASHBOARD.jpeg')
)
UPDATE public.project_images pi
SET image_url = base.p || m.f, image_base64 = ''
FROM m, base
WHERE pi.id = m.id;