-- reference_v2_protection_integrity_hardening

CREATE OR REPLACE FUNCTION public.reference_v2_assets_block_protected_delete()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF OLD.protection = 'protected' THEN
    RAISE EXCEPTION 'reference_v2_assets: protected asset % cannot be deleted; unlock it first (set protection to unprotected)', OLD.asset_key
      USING ERRCODE = 'raise_exception';
  END IF;
  RETURN OLD;
END;
$$;

REVOKE ALL ON FUNCTION public.reference_v2_assets_block_protected_delete() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.reference_v2_assets_block_protected_delete() FROM anon;
REVOKE ALL ON FUNCTION public.reference_v2_assets_block_protected_delete() FROM authenticated;

DROP TRIGGER IF EXISTS reference_v2_assets_block_protected_delete_trg ON public.reference_v2_assets;
CREATE TRIGGER reference_v2_assets_block_protected_delete_trg
BEFORE DELETE ON public.reference_v2_assets
FOR EACH ROW
EXECUTE FUNCTION public.reference_v2_assets_block_protected_delete();

ALTER TABLE public.reference_v2_assets
  ADD CONSTRAINT reference_v2_assets_role_allowed
  CHECK (role IN ('primary', 'primary_candidate', 'secondary_support', 'rejected'));

ALTER TABLE public.reference_v2_assets
  ADD CONSTRAINT reference_v2_assets_protection_allowed
  CHECK (protection IN ('unprotected', 'protected'));

ALTER TABLE public.reference_v2_assets
  ADD CONSTRAINT reference_v2_assets_blocked_must_be_rejected
  CHECK (
    (COALESCE(cardinality(blockers), 0) = 0 AND COALESCE(cardinality(hard_failures), 0) = 0)
    OR role = 'rejected'
  );
