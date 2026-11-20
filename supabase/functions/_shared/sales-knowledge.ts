export const SALES_EMBEDDING_MODEL = "gemini-embedding-2";
export const SALES_EMBEDDING_DIMENSIONS = 3072;

const GEMINI_MODELS_URL = "https://generativelanguage.googleapis.com/v1beta/models";
const MAX_BATCH_ITEMS = 20;

export type SalesKnowledgeSource = {
  chunkId: string;
  documentId: string;
  title: string;
  documentType: string;
  sourceType: string;
  text: string;
  snippet: string;
  similarity: number;
  isDemo: boolean;
};

export function chunkSalesKnowledge(input: string, maxChars = 1400, overlapChars = 180): string[] {
  const text = input.replace(/\r\n?/g, "\n").trim();
  if (!text) return [];
  if (!Number.isInteger(maxChars) || maxChars < 400 || overlapChars < 0 || overlapChars >= maxChars / 2) {
    throw new Error("Ungültige Chunk-Grenzen");
  }

  const chunks: string[] = [];
  let start = 0;
  while (start < text.length) {
    let end = Math.min(start + maxChars, text.length);
    if (end < text.length) {
      const minimumEnd = start + Math.floor(maxChars * 0.55);
      const paragraphEnd = text.lastIndexOf("\n\n", end);
      const sentenceEnd = text.lastIndexOf(". ", end);
      const wordEnd = text.lastIndexOf(" ", end);
      const preferredEnd = Math.max(paragraphEnd, sentenceEnd > minimumEnd ? sentenceEnd + 1 : -1, wordEnd);
      if (preferredEnd >= minimumEnd) end = preferredEnd + (preferredEnd === paragraphEnd ? 2 : 1);
    }

    const chunk = text.slice(start, end).trim();
    if (chunk) chunks.push(chunk);
    if (end >= text.length) break;

    let next = Math.max(start + 1, end - overlapChars);
    if (next > start) {
      const whitespace = text.slice(next, end).search(/\s/);
      if (whitespace > 0) next += whitespace + 1;
    }
    start = next;
  }
  return chunks;
}

async function embedBatch(
  apiKey: string,
  texts: readonly string[],
  taskType: "RETRIEVAL_DOCUMENT" | "RETRIEVAL_QUERY",
  title?: string,
): Promise<number[][]> {
  let lastError = "";
  for (let attempt = 1; attempt <= 3; attempt++) {
    const response = await fetch(`${GEMINI_MODELS_URL}/${SALES_EMBEDDING_MODEL}:batchEmbedContents?key=${apiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        requests: texts.map((text) => ({
          model: `models/${SALES_EMBEDDING_MODEL}`,
          content: { parts: [{ text }] },
          taskType,
          outputDimensionality: SALES_EMBEDDING_DIMENSIONS,
          ...(taskType === "RETRIEVAL_DOCUMENT" && title ? { title } : {}),
        })),
      }),
    });

    if (response.ok) {
      const result = await response.json();
      const vectors = (result.embeddings || []).map((entry: any) => entry.values as number[]);
      if (vectors.length !== texts.length || vectors.some((vector: number[]) => vector.length !== SALES_EMBEDDING_DIMENSIONS)) {
        throw new Error("Embedding-Antwort ist unvollständig oder hat eine falsche Dimension");
      }
      return vectors;
    }

    lastError = `Embedding API ${response.status}: ${(await response.text()).slice(0, 500)}`;
    if ((response.status !== 429 && response.status < 500) || attempt === 3) break;
    const retryAfter = Number(response.headers.get("Retry-After"));
    const delay = retryAfter > 0 ? retryAfter * 1000 : 500 * 2 ** attempt;
    await new Promise((resolve) => setTimeout(resolve, delay + Math.random() * 250));
  }
  throw new Error(lastError || "Embedding-Anfrage fehlgeschlagen");
}

export async function embedSalesKnowledge(
  apiKey: string,
  texts: readonly string[],
  taskType: "RETRIEVAL_DOCUMENT" | "RETRIEVAL_QUERY",
  title?: string,
): Promise<number[][]> {
  if (texts.some((text) => !text.trim())) throw new Error("Leere Texte können nicht eingebettet werden");
  const vectors: number[][] = [];
  for (let start = 0; start < texts.length; start += MAX_BATCH_ITEMS) {
    vectors.push(...await embedBatch(apiKey, texts.slice(start, start + MAX_BATCH_ITEMS), taskType, title));
  }
  return vectors;
}

export function isDemoKnowledgeSource(sourceType?: string | null, title?: string | null): boolean {
  return sourceType === "demo_seed" || (title || "").trim().toUpperCase().startsWith("[DEMO]");
}

export async function retrieveSalesKnowledge(options: {
  adminSupabase: any;
  apiKey: string;
  userId: string;
  query: string;
  selectedDocumentIds?: string[];
  limit?: number;
}): Promise<SalesKnowledgeSource[]> {
  const { adminSupabase, apiKey, userId, query, selectedDocumentIds, limit = 8 } = options;
  if (!query.trim()) return [];

  let documentQuery = adminSupabase.from("sales_knowledge_documents")
    .select("id")
    .eq("user_id", userId)
    .eq("is_active", true)
    .eq("embedding_status", "ready")
    .limit(1);
  if (selectedDocumentIds?.length) documentQuery = documentQuery.in("id", selectedDocumentIds);
  const { data: availableDocuments, error: documentsError } = await documentQuery;
  if (documentsError) throw documentsError;
  if (!availableDocuments?.length) return [];

  const [queryEmbedding] = await embedSalesKnowledge(apiKey, [query], "RETRIEVAL_QUERY");
  const { data, error } = await adminSupabase.rpc("match_sales_knowledge_chunks", {
    query_embedding: JSON.stringify(queryEmbedding),
    match_user_id: userId,
    match_count: Math.min(Math.max(limit, 1), 12),
    selected_document_ids: selectedDocumentIds?.length ? selectedDocumentIds : null,
  });
  if (error) throw error;

  return (data || []).map((row: any) => ({
    chunkId: row.chunk_id,
    documentId: row.document_id,
    title: row.title,
    documentType: row.document_type,
    sourceType: row.source_type,
    text: row.chunk_text,
    snippet: row.chunk_text.replace(/\s+/g, " ").trim().slice(0, 260),
    similarity: Number(row.similarity),
    isDemo: isDemoKnowledgeSource(row.source_type, row.title),
  }));
}

export function buildSalesKnowledgeContext(sources: readonly SalesKnowledgeSource[]): string {
  return sources.map((source, index) =>
    `[Q${index + 1}] ${source.title} (${source.documentType}, Ähnlichkeit ${source.similarity.toFixed(3)})\n${source.text}`
  ).join("\n\n");
}

export function toUsedKnowledgeContext(sources: readonly SalesKnowledgeSource[]) {
  return sources.slice(0, 6).map((source, index) => ({
    source: `Q${index + 1}`,
    title: source.title,
    snippet: source.snippet,
    documentId: source.documentId,
    documentType: source.documentType,
    similarity: source.similarity,
    isDemo: source.isDemo,
  }));
}

export function formatKnowledgeSourcesForChat(sources: readonly SalesKnowledgeSource[]): string {
  if (!sources.length) return "";
  const lines = sources.slice(0, 4).map((source, index) =>
    `- **Q${index + 1}: ${source.title}** — ${source.snippet}`
  );
  return `\n\n---\n**Verwendete Wissensquellen:**\n${lines.join("\n")}`;
}
