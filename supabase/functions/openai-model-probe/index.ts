// TEMP diagnostic: OpenAI image model availability + /v1/images/edits compatibility probe.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { getSecret } from "../_shared/get-secret.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const key = await getSecret("OPENAI_API_KEY");
  if (!key) return new Response(JSON.stringify({ error: "no key" }), { status: 500, headers: corsHeaders });

  const body = await req.json().catch(() => ({}));
  const model = body.model ?? "gpt-image-2.5-flare";
  const size = body.size ?? "1536x1024";
  const quality = body.quality ?? "high";
  const imageUrl = body.imageUrl ?? "https://picsum.photos/id/111/1024/768";

  const src = await fetch(imageUrl);
  const bytes = new Uint8Array(await src.arrayBuffer());

  const form = new FormData();
  form.append("model", model);
  form.append("size", size);
  form.append("quality", quality);
  form.append("n", "1");
  form.append("prompt", "Place this exact vehicle in a clean bright dealership showroom. Keep geometry, wheels and trim identical.");
  form.append("image", new Blob([bytes], { type: "image/jpeg" }), "ref_0.jpg");

  const t0 = Date.now();
  const r = await fetch("https://api.openai.com/v1/images/edits", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}` },
    body: form,
  });
  const txt = await r.text();
  let parsed: any = null;
  try { parsed = JSON.parse(txt); } catch { /* ignore */ }
  const b64 = parsed?.data?.[0]?.b64_json;

  return new Response(JSON.stringify({
    model, size, quality,
    status: r.status,
    ms: Date.now() - t0,
    gotImage: !!b64,
    imageBytes: b64 ? Math.floor(b64.length * 0.75) : 0,
    usage: parsed?.usage ?? null,
    error: parsed?.error ?? (r.ok ? null : txt.slice(0, 500)),
  }, null, 2), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
});
