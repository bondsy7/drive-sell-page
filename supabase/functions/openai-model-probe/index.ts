// TEMP diagnostic: lists OpenAI image models available to the configured key.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { getSecret } from "../_shared/get-secret.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const key = await getSecret("OPENAI_API_KEY");
  if (!key) {
    return new Response(JSON.stringify({ error: "no key" }), { status: 500, headers: corsHeaders });
  }
  const r = await fetch("https://api.openai.com/v1/models", {
    headers: { Authorization: `Bearer ${key}` },
  });
  const j = await r.json();
  const ids: string[] = (j?.data ?? []).map((m: any) => m.id);
  return new Response(
    JSON.stringify({
      status: r.status,
      imageModels: ids.filter((i) => /image|flare|dall/i.test(i)).sort(),
      total: ids.length,
      error: j?.error ?? null,
    }, null, 2),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
});
