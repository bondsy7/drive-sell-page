import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Not authenticated");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const adminSupabase = createClient(supabaseUrl, serviceKey);

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) throw new Error("Not authenticated");

    const { documentId } = await req.json();
    if (!documentId) throw new Error("documentId required");

    // Load document
    const { data: doc, error: docError } = await supabase
      .from('sales_knowledge_documents')
      .select('*')
      .eq('id', documentId)
      .single();
    if (docError || !doc) throw new Error("Document not found");

    const document = doc as any;

    // Update status to processing
    await supabase.from('sales_knowledge_documents')
      .update({ embedding_status: 'processing' } as any)
      .eq('id', documentId);

    let fullText = document.content_text || '';

    // If no content_text, try to download and extract from storage
    if (!fullText && document.storage_path) {
      const { data: fileData, error: fileError } = await supabase.storage
        .from('sales-knowledge')
        .download(document.storage_path);

      if (!fileError && fileData) {
        const mimeType = document.mime_type || '';
        if (mimeType.includes('text') || document.storage_path.endsWith('.txt') || document.storage_path.endsWith('.md')) {
          fullText = await fileData.text();
        } else if (document.storage_path.endsWith('.json')) {
          const jsonContent = await fileData.text();
          try {
            const parsed = JSON.parse(jsonContent);
            fullText = JSON.stringify(parsed, null, 2);
          } catch {
            fullText = jsonContent;
          }
        } else {
          // For PDF/DOCX, store raw text note
          fullText = `[Datei: ${document.storage_path}] – Textextraktion für dieses Format wird in einer zukünftigen Version unterstützt. Bitte füge den Textinhalt manuell ein.`;
        }
      }
    }

    if (!fullText) {
      await supabase.from('sales_knowledge_documents')
        .update({ embedding_status: 'failed', content_text: '' } as any)
        .eq('id', documentId);
      return new Response(JSON.stringify({ error: 'No text content found' }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Chunk the text
    const CHUNK_SIZE = 1000;
    const CHUNK_OVERLAP = 200;
    const chunks: string[] = [];

    if (fullText.length <= CHUNK_SIZE) {
      chunks.push(fullText);
    } else {
      let start = 0;
      while (start < fullText.length) {
        const end = Math.min(start + CHUNK_SIZE, fullText.length);
        chunks.push(fullText.slice(start, end));
        start += CHUNK_SIZE - CHUNK_OVERLAP;
      }
    }

    // Delete existing chunks for this document
    await adminSupabase.from('sales_knowledge_chunks').delete().eq('document_id', documentId);

    // Insert new chunks
    const chunkRows = chunks.map((text, i) => ({
      document_id: documentId,
      user_id: user.id,
      chunk_index: i,
      chunk_text: text,
      token_count: Math.ceil(text.length / 4), // rough estimate
      metadata: {
        document_type: document.document_type,
        title: document.title,
        version_label: document.version_label,
      },
      is_active: true,
    }));

    await adminSupabase.from('sales_knowledge_chunks').insert(chunkRows);

    // Update document
    await supabase.from('sales_knowledge_documents').update({
      content_text: fullText,
      embedding_status: 'ready',
      chunk_count: chunks.length,
      updated_at: new Date().toISOString(),
    } as any).eq('id', documentId);

    return new Response(JSON.stringify({
      success: true,
      chunkCount: chunks.length,
      textLength: fullText.length,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (e) {
    console.error('ingest-sales-knowledge error:', e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : 'Unknown error' }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
