-- Reference V2 — Phase 2.6A: reference_v2_persistence_foundation
-- Isolated, vehicle-anchored persistence tables. No existing table is altered.
-- No storage bucket or storage policy is created here.

-- ---------------------------------------------------------------------------
-- 1. Workspaces
-- ---------------------------------------------------------------------------
CREATE TABLE public.reference_v2_workspaces (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  vehicle_id uuid NOT NULL REFERENCES public.vehicles(id) ON DELETE CASCADE,
  master_key text NOT NULL,
  label text NOT NULL,
  vehicle_class text NOT NULL,
  color_family text,
  identity_cluster_id text NOT NULL,
  master_version integer NOT NULL DEFAULT 1,
  master_history jsonb NOT NULL DEFAULT '[]'::jsonb,
  schema_version integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT reference_v2_workspaces_vehicle_unique UNIQUE (vehicle_id),
  CONSTRAINT reference_v2_workspaces_master_key_nonempty CHECK (length(btrim(master_key)) > 0),
  CONSTRAINT reference_v2_workspaces_label_nonempty CHECK (length(btrim(label)) > 0),
  CONSTRAINT reference_v2_workspaces_vehicle_class_nonempty CHECK (length(btrim(vehicle_class)) > 0),
  CONSTRAINT reference_v2_workspaces_identity_cluster_nonempty CHECK (length(btrim(identity_cluster_id)) > 0),
  CONSTRAINT reference_v2_workspaces_master_version_min CHECK (master_version >= 1),
  CONSTRAINT reference_v2_workspaces_schema_version_v1 CHECK (schema_version = 1)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.reference_v2_workspaces TO authenticated;
GRANT ALL ON public.reference_v2_workspaces TO service_role;

-- ---------------------------------------------------------------------------
-- 2. Assets
-- ---------------------------------------------------------------------------
CREATE TABLE public.reference_v2_assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.reference_v2_workspaces(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  asset_key text NOT NULL,
  requested_perspective_id text NOT NULL,
  canonical_perspective_id text NOT NULL,
  file_name text NOT NULL,
  storage_bucket text NOT NULL DEFAULT 'originals',
  storage_path text NOT NULL,
  mime_type text NOT NULL,
  size_bytes bigint,
  sha256 text NOT NULL,
  intake jsonb NOT NULL,
  analysis jsonb,
  scores jsonb NOT NULL,
  weighted_score numeric NOT NULL,
  hard_failures text[] NOT NULL DEFAULT '{}'::text[],
  blockers text[] NOT NULL DEFAULT '{}'::text[],
  warnings text[] NOT NULL DEFAULT '{}'::text[],
  role text NOT NULL,
  protection text NOT NULL,
  asset_version integer NOT NULL DEFAULT 1,
  history jsonb NOT NULL DEFAULT '[]'::jsonb,
  schema_version integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT reference_v2_assets_workspace_key_unique UNIQUE (workspace_id, asset_key),
  CONSTRAINT reference_v2_assets_storage_path_unique UNIQUE (storage_path),
  CONSTRAINT reference_v2_assets_asset_key_nonempty CHECK (length(btrim(asset_key)) > 0),
  CONSTRAINT reference_v2_assets_file_name_nonempty CHECK (length(btrim(file_name)) > 0),
  CONSTRAINT reference_v2_assets_bucket_originals CHECK (storage_bucket = 'originals'),
  CONSTRAINT reference_v2_assets_storage_path_relative CHECK (
    length(btrim(storage_path)) > 0
    AND storage_path !~ '://'
    AND storage_path !~* '^(data:|blob:)'
    AND storage_path NOT LIKE '/%'
    AND storage_path NOT LIKE '%..%'
  ),
  CONSTRAINT reference_v2_assets_mime_allowed CHECK (mime_type IN ('image/jpeg', 'image/png', 'image/webp')),
  CONSTRAINT reference_v2_assets_size_bytes_positive CHECK (size_bytes IS NULL OR size_bytes > 0),
  CONSTRAINT reference_v2_assets_sha256_format CHECK (sha256 ~ '^[0-9a-f]{64}$'),
  CONSTRAINT reference_v2_assets_weighted_score_range CHECK (weighted_score >= 0 AND weighted_score <= 100),
  CONSTRAINT reference_v2_assets_role_nonempty CHECK (length(btrim(role)) > 0),
  CONSTRAINT reference_v2_assets_protection_nonempty CHECK (length(btrim(protection)) > 0),
  CONSTRAINT reference_v2_assets_version_min CHECK (asset_version >= 1),
  CONSTRAINT reference_v2_assets_schema_version_v1 CHECK (schema_version = 1)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.reference_v2_assets TO authenticated;
GRANT ALL ON public.reference_v2_assets TO service_role;

-- ---------------------------------------------------------------------------
-- 3. Framing evidence
-- ---------------------------------------------------------------------------
CREATE TABLE public.reference_v2_framing_evidence (
  workspace_id uuid NOT NULL REFERENCES public.reference_v2_workspaces(id) ON DELETE CASCADE,
  asset_key text NOT NULL,
  user_id uuid NOT NULL,
  schema_version integer NOT NULL DEFAULT 1,
  source_aspect_ratio double precision NOT NULL,
  full_vehicle_visible boolean NOT NULL,
  cropped boolean NOT NULL,
  padding_pct double precision NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT reference_v2_framing_evidence_pkey PRIMARY KEY (workspace_id, asset_key),
  CONSTRAINT reference_v2_framing_evidence_asset_fk
    FOREIGN KEY (workspace_id, asset_key)
    REFERENCES public.reference_v2_assets (workspace_id, asset_key) ON DELETE CASCADE,
  CONSTRAINT reference_v2_framing_evidence_schema_version_v1 CHECK (schema_version = 1),
  CONSTRAINT reference_v2_framing_evidence_aspect_positive CHECK (
    source_aspect_ratio > 0 AND source_aspect_ratio < 'infinity'::double precision
  ),
  CONSTRAINT reference_v2_framing_evidence_padding_range CHECK (padding_pct >= 0 AND padding_pct <= 100)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.reference_v2_framing_evidence TO authenticated;
GRANT ALL ON public.reference_v2_framing_evidence TO service_role;

-- ---------------------------------------------------------------------------
-- Owner derivation + immutable anchors (SECURITY DEFINER, locked search_path)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.reference_v2_workspaces_derive_owner()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _owner uuid;
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF NEW.id <> OLD.id THEN
      RAISE EXCEPTION 'reference_v2_workspaces.id is immutable';
    END IF;
    IF NEW.vehicle_id <> OLD.vehicle_id THEN
      RAISE EXCEPTION 'reference_v2_workspaces.vehicle_id is immutable';
    END IF;
  END IF;

  SELECT v.user_id INTO _owner FROM public.vehicles v WHERE v.id = NEW.vehicle_id;
  IF _owner IS NULL THEN
    RAISE EXCEPTION 'reference_v2 workspace: vehicle % not found', NEW.vehicle_id;
  END IF;

  NEW.user_id := _owner;
  NEW.updated_at := now();
  IF TG_OP = 'UPDATE' THEN
    NEW.created_at := OLD.created_at;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER reference_v2_workspaces_derive_owner_trg
BEFORE INSERT OR UPDATE ON public.reference_v2_workspaces
FOR EACH ROW EXECUTE FUNCTION public.reference_v2_workspaces_derive_owner();

CREATE OR REPLACE FUNCTION public.reference_v2_assets_derive_owner()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _owner uuid;
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF NEW.id <> OLD.id THEN
      RAISE EXCEPTION 'reference_v2_assets.id is immutable';
    END IF;
    IF NEW.workspace_id <> OLD.workspace_id THEN
      RAISE EXCEPTION 'reference_v2_assets.workspace_id is immutable';
    END IF;
    IF NEW.asset_key <> OLD.asset_key THEN
      RAISE EXCEPTION 'reference_v2_assets.asset_key is immutable';
    END IF;
    IF NEW.storage_path <> OLD.storage_path THEN
      RAISE EXCEPTION 'reference_v2_assets.storage_path is immutable';
    END IF;
  END IF;

  SELECT w.user_id INTO _owner
  FROM public.reference_v2_workspaces w
  WHERE w.id = NEW.workspace_id;
  IF _owner IS NULL THEN
    RAISE EXCEPTION 'reference_v2 asset: workspace % not found', NEW.workspace_id;
  END IF;

  NEW.user_id := _owner;
  NEW.updated_at := now();
  IF TG_OP = 'UPDATE' THEN
    NEW.created_at := OLD.created_at;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER reference_v2_assets_derive_owner_trg
BEFORE INSERT OR UPDATE ON public.reference_v2_assets
FOR EACH ROW EXECUTE FUNCTION public.reference_v2_assets_derive_owner();

CREATE OR REPLACE FUNCTION public.reference_v2_framing_derive_owner()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _owner uuid;
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF NEW.workspace_id <> OLD.workspace_id THEN
      RAISE EXCEPTION 'reference_v2_framing_evidence.workspace_id is immutable';
    END IF;
    IF NEW.asset_key <> OLD.asset_key THEN
      RAISE EXCEPTION 'reference_v2_framing_evidence.asset_key is immutable';
    END IF;
  END IF;

  SELECT w.user_id INTO _owner
  FROM public.reference_v2_workspaces w
  WHERE w.id = NEW.workspace_id;
  IF _owner IS NULL THEN
    RAISE EXCEPTION 'reference_v2 framing evidence: workspace % not found', NEW.workspace_id;
  END IF;

  NEW.user_id := _owner;
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER reference_v2_framing_derive_owner_trg
BEFORE INSERT OR UPDATE ON public.reference_v2_framing_evidence
FOR EACH ROW EXECUTE FUNCTION public.reference_v2_framing_derive_owner();

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
ALTER TABLE public.reference_v2_workspaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reference_v2_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reference_v2_framing_evidence ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners manage their reference v2 workspaces"
ON public.reference_v2_workspaces FOR ALL TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins manage all reference v2 workspaces"
ON public.reference_v2_workspaces FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Owners manage their reference v2 assets"
ON public.reference_v2_assets FOR ALL TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins manage all reference v2 assets"
ON public.reference_v2_assets FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Owners manage their reference v2 framing evidence"
ON public.reference_v2_framing_evidence FOR ALL TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins manage all reference v2 framing evidence"
ON public.reference_v2_framing_evidence FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- ---------------------------------------------------------------------------
-- Indexes
-- ---------------------------------------------------------------------------
CREATE INDEX reference_v2_workspaces_user_idx ON public.reference_v2_workspaces (user_id);
CREATE INDEX reference_v2_assets_workspace_idx ON public.reference_v2_assets (workspace_id);
CREATE INDEX reference_v2_assets_user_idx ON public.reference_v2_assets (user_id);
CREATE INDEX reference_v2_assets_canonical_perspective_idx ON public.reference_v2_assets (canonical_perspective_id);
CREATE INDEX reference_v2_framing_evidence_workspace_idx ON public.reference_v2_framing_evidence (workspace_id);