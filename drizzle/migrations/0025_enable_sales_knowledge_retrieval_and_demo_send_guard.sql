ALTER TABLE public.sales_knowledge_documents
  ADD COLUMN IF NOT EXISTS embedding_model text,
  ADD COLUMN IF NOT EXISTS ingestion_error text;

ALTER TABLE public.sales_knowledge_chunks
  ADD COLUMN IF NOT EXISTS embedding_v2 extensions.vector(3072);

COMMENT ON COLUMN public.sales_knowledge_chunks.embedding IS 'DEPRECATED: empty legacy 768-dimensional column; new retrieval uses embedding_v2.';

CREATE INDEX IF NOT EXISTS sales_knowledge_chunks_embedding_v2_hnsw_idx
  ON public.sales_knowledge_chunks
  USING hnsw ((embedding_v2::halfvec(3072)) halfvec_cosine_ops);

CREATE INDEX IF NOT EXISTS sales_knowledge_chunks_user_document_idx
  ON public.sales_knowledge_chunks (user_id, document_id)
  WHERE is_active = true;

ALTER TABLE public.sales_email_outbox
  ADD COLUMN IF NOT EXISTS is_demo boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS sales_email_outbox_demo_queue_idx
  ON public.sales_email_outbox (status, is_demo);

CREATE OR REPLACE FUNCTION public.match_sales_knowledge_chunks(
  query_embedding extensions.vector(3072),
  match_user_id uuid,
  match_count integer DEFAULT 8,
  selected_document_ids uuid[] DEFAULT NULL
)
RETURNS TABLE (
  chunk_id uuid,
  document_id uuid,
  title text,
  document_type text,
  source_type text,
  chunk_text text,
  similarity double precision
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public, extensions
AS $$
  SELECT
    c.id AS chunk_id,
    d.id AS document_id,
    d.title,
    d.document_type,
    d.source_type,
    c.chunk_text,
    1.0 - (c.embedding_v2::halfvec(3072) <=> query_embedding::halfvec(3072)) AS similarity
  FROM public.sales_knowledge_chunks AS c
  JOIN public.sales_knowledge_documents AS d ON d.id = c.document_id
  WHERE c.user_id = match_user_id
    AND d.user_id = match_user_id
    AND c.is_active = true
    AND d.is_active = true
    AND d.embedding_status = 'ready'
    AND c.embedding_v2 IS NOT NULL
    AND (selected_document_ids IS NULL OR d.id = ANY(selected_document_ids))
  ORDER BY c.embedding_v2::halfvec(3072) <=> query_embedding::halfvec(3072)
  LIMIT LEAST(GREATEST(COALESCE(match_count, 8), 1), 12);
$$;

REVOKE ALL ON FUNCTION public.match_sales_knowledge_chunks(extensions.vector(3072), uuid, integer, uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.match_sales_knowledge_chunks(extensions.vector(3072), uuid, integer, uuid[]) TO authenticated, service_role;