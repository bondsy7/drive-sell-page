ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS auto3_tenant_url TEXT,
  ADD COLUMN IF NOT EXISTS auto3_connection_verified_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS auto3_connection_vehicle_count INTEGER;

COMMENT ON COLUMN public.profiles.auto3_tenant_url IS 'Verified HTTPS dealer tenant URL used as the server-side X-BASEURL selector for Auto3 inventory.';
COMMENT ON COLUMN public.profiles.auto3_connection_verified_at IS 'Time the dealer tenant URL last passed a server-side Auto3 inventory check.';
COMMENT ON COLUMN public.profiles.auto3_connection_vehicle_count IS 'Vehicle count returned by the last successful Auto3 connection check.';