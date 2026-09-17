ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS legal_confirmed_at timestamptz;

UPDATE public.profiles AS p
SET legal_confirmed_at = evidence.confirmed_at
FROM (
  SELECT user_id, max(accepted_at) AS confirmed_at
  FROM public.legal_acceptances
  WHERE version = '2026-09-16'
    AND document IN ('agb', 'b2b_confirmation')
  GROUP BY user_id
  HAVING count(DISTINCT document) = 2
) AS evidence
WHERE p.id = evidence.user_id
  AND p.legal_confirmed_at IS NULL;