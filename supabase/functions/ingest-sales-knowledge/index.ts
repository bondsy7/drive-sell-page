import { blockedAccountResponse } from "../_shared/blocked-accounts.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getSecret } from "../_shared/get-secret.ts";
import {
  chunkSalesKnowledge,
  embedSalesKnowledge,
  SALES_EMBEDDING_DIMENSIONS,
  SALES_EMBEDDING_MODEL,
} from "../_shared/sales-knowledge.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  { const __blocked = blockedAccountResponse(req); if (__blocked) return __blocked; }
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  let documentId: string | null = null;
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Not authenticated");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const geminiKey = await getSecret("GEMINI_API_KEY");
    if (!geminiKey) throw new Error("GEMINI_API_KEY not configured");

    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const adminSupabase = createClient(supabaseUrl, serviceKey);

    const token = authHeader.replace("Bearer ", "");
    const { data: claims, error: authError } = await supabase.auth.getClaims(token);
    if (authError || !claims?.claims?.sub) throw new Error("Not authenticated");
    const userId = claims.claims.sub;

    const body = await req.json();
    documentId = typeof body?.documentId === "string" ? body.documentId : null;
    if (!documentId || !/^[0-9a-f-]{36}$/i.test(documentId)) throw new Error("Gültige documentId erforderlich");

    const { data: doc, error: docError } = await supabase
      .from("sales_knowledge_documents")
      .select("*")
      .eq("id", documentId)
      .single();
    if (docError || !doc) throw new Error("Document not found");
    const document = doc as any;

    await supabase.from("sales_knowledge_documents")
      .update({ embedding_status: "processing", ingestion_error: null } as any)
      .eq("id", documentId);

    let fullText = (document.content_text || "").trim();
    if (!fullText && document.storage_path) {
      const { data: fileData, error: fileError } = await supabase.storage
        .from("sales-knowledge")
        .download(document.storage_path);
      if (fileError || !fileData) throw new Error("Wissensdatei konnte nicht gelesen werden");

      const mimeType = document.mime_type || "";
      if (mimeType.includes("text") || document.storage_path.endsWith(".txt") || document.storage_path.endsWith(".md")) {
        fullText = (await fileData.text()).trim();
      } else if (document.storage_path.endsWith(".json")) {
        const jsonContent = await fileData.text();
        try {
          fullText = JSON.stringify(JSON.parse(jsonContent), null, 2);
        } catch {
          fullText = jsonContent;
        }
      } else {
        throw new Error("PDF/DOCX-Textextraktion ist noch nicht verfügbar. Bitte TXT, MD oder JSON verwenden.");
      }
    }

    if (!fullText) throw new Error("No text content found");
    if (fullText.length > 200_000) throw new Error("Dokument ist mit mehr als 200.000 Zeichen zu groß");

    const chunks = chunkSalesKnowledge(fullText);
    if (!chunks.length) throw new Error("No text content found");
    const embeddings = await embedSalesKnowledge(geminiKey, chunks, "RETRIEVAL_DOCUMENT", document.title);

    const chunkRows = chunks.map((text, index) => ({
      document_id: documentId,
      user_id: userId,
      chunk_index: index,
      chunk_text: text,
      token_count: Math.ceil(text.length / 4),
      embedding_v2: JSON.stringify(embeddings[index]),
      metadata: {
        document_type: document.document_type,
        title: document.title,
        version_label: document.version_label,
        embedding_model: SALES_EMBEDDING_MODEL,
      },
      is_active: true,
    }));

    const { error: deleteError } = await adminSupabase.from("sales_knowledge_chunks").delete().eq("document_id", documentId);
    if (deleteError) throw deleteError;
    const { error: insertError } = await adminSupabase.from("sales_knowledge_chunks").insert(chunkRows);
    if (insertError) throw insertError;

    await supabase.from("sales_knowledge_documents").update({
      content_text: fullText,
      embedding_status: "ready",
      embedding_model: SALES_EMBEDDING_MODEL,
      ingestion_error: null,
      chunk_count: chunks.length,
      updated_at: new Date().toISOString(),
    } as any).eq("id", documentId);

    console.log(`[ingest-sales-knowledge] event=ready user=${userId} document=${documentId} chunks=${chunks.length} model=${SALES_EMBEDDING_MODEL}`);
    return new Response(JSON.stringify({
      success: true,
      chunkCount: chunks.length,
      embeddedCount: embeddings.length,
      embeddingModel: SALES_EMBEDDING_MODEL,
      dimensions: SALES_EMBEDDING_DIMENSIONS,
      textLength: fullText.length,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (error) {
    console.error("ingest-sales-knowledge error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    if (documentId) {
      try {
        const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
        await admin.from("sales_knowledge_documents").update({
          embedding_status: "failed",
          ingestion_error: message.slice(0, 800),
          updated_at: new Date().toISOString(),
        }).eq("id", documentId);
      } catch (updateError) {
        console.error("ingest-sales-knowledge status update failed", updateError);
      }
    }
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
