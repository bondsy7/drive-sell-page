CREATE TABLE public.storage_export_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_user_id uuid NOT NULL,
  secret_hash text NOT NULL,
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz,
  last_used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

REVOKE ALL ON public.storage_export_sessions FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.storage_export_sessions TO service_role;
ALTER TABLE public.storage_export_sessions ENABLE ROW LEVEL SECURITY;

CREATE INDEX storage_export_sessions_expires_at_idx
  ON public.storage_export_sessions (expires_at);

COMMENT ON TABLE public.storage_export_sessions IS
  'Isolierte, kurzlebige Admin-Exportsitzungen. Keine Storage-Inhalte; nur Secret-Hash und Sitzungsmetadaten.';

CREATE OR REPLACE FUNCTION public.storage_export_db_buckets()
RETURNS TABLE(
  id text,
  name text,
  is_public boolean,
  created_at timestamptz,
  updated_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, storage
AS $$
  SELECT b.id, b.name, b.public, b.created_at, b.updated_at
  FROM storage.buckets AS b
  ORDER BY b.id;
$$;

REVOKE ALL ON FUNCTION public.storage_export_db_buckets() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.storage_export_db_buckets() TO service_role;

CREATE OR REPLACE FUNCTION public.storage_export_db_inventory(
  _bucket_id text,
  _offset integer DEFAULT 0,
  _limit integer DEFAULT 1000
)
RETURNS TABLE(
  id uuid,
  bucket_id text,
  name text,
  size_bytes bigint,
  mimetype text,
  etag text,
  created_at timestamptz,
  updated_at timestamptz,
  total_count bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, storage
AS $$
  SELECT
    o.id,
    o.bucket_id,
    o.name,
    COALESCE(NULLIF(o.metadata->>'size', '')::bigint, 0) AS size_bytes,
    o.metadata->>'mimetype' AS mimetype,
    o.metadata->>'eTag' AS etag,
    o.created_at,
    o.updated_at,
    COUNT(*) OVER ()::bigint AS total_count
  FROM storage.objects AS o
  WHERE o.bucket_id = _bucket_id
  ORDER BY o.name
  LIMIT LEAST(GREATEST(COALESCE(_limit, 1000), 1), 1000)
  OFFSET GREATEST(COALESCE(_offset, 0), 0);
$$;

REVOKE ALL ON FUNCTION public.storage_export_db_inventory(text, integer, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.storage_export_db_inventory(text, integer, integer) TO service_role;

COMMENT ON FUNCTION public.storage_export_db_buckets() IS
  'Read-only Bucketabgleich für die isolierte Admin-Storage-Exportfunktion.';
COMMENT ON FUNCTION public.storage_export_db_inventory(text, integer, integer) IS
  'Read-only Objektbestand aus storage.objects für den Admin-Exportabgleich; kein Direktzugriff durch App-Rollen.';