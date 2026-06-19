-- Switch qr_login_tokens to hashed token storage
ALTER TABLE public.qr_login_tokens ADD COLUMN IF NOT EXISTS token_hash text;

-- Backfill: hash any existing plaintext tokens (sha256 hex)
UPDATE public.qr_login_tokens
SET token_hash = encode(extensions.digest(token, 'sha256'), 'hex')
WHERE token_hash IS NULL;

ALTER TABLE public.qr_login_tokens ALTER COLUMN token_hash SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS qr_login_tokens_token_hash_key ON public.qr_login_tokens(token_hash);

-- Drop the plaintext token column entirely so a DB leak does not expose usable tokens
ALTER TABLE public.qr_login_tokens DROP COLUMN token;