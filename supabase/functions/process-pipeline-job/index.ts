import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function createServiceClient() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
}

// ─── Gemini image generation ───
async function callGemini(parts: any[], model: string, retries = 2): Promise<string | null> {
  const apiKey = Deno.env.get("GEMINI_API_KEY");
  if (!apiKey) throw new Error("GEMINI_API_KEY not configured");
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const response = await fetch(url, {
        method: "POST",
        headers: { "x-goog-api-key": apiKey, "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts }],
          generationConfig: { responseModalities: ["TEXT", "IMAGE"] },
        }),
      });
      if (!response.ok) {
        const errText = await response.text();
        console.error(`Gemini attempt ${attempt + 1}:`, response.status, errText);
        if (response.status === 429 && attempt < retries) {
          await new Promise(r => setTimeout(r, 3000 * (attempt + 1)));
          continue;
        }
        if (attempt < retries) { await new Promise(r => setTimeout(r, 2000)); continue; }
        throw new Error(`Gemini error: ${response.status}`);
      }
      const data = await response.json();
      const respParts = data.candidates?.[0]?.content?.parts;
      if (respParts) {
        for (const part of respParts) {
          if (part.inlineData?.data) {
            const mime = part.inlineData.mimeType || "image/png";
            return `data:${mime};base64,${part.inlineData.data}`;
          }
        }
      }
      if (attempt < retries) { await new Promise(r => setTimeout(r, 2000)); continue; }
    } catch (e) {
      if (attempt >= retries) throw e;
      await new Promise(r => setTimeout(r, 2000));
    }
  }
  return null;
}

// ─── Fetch URL → inline data (with size limit to prevent OOM) ───
async function urlToInlineData(url: string, maxSizeBytes = 4 * 1024 * 1024) {
  try {
    const resp = await fetch(url);
    if (!resp.ok) return null;
    const buf = await resp.arrayBuffer();
    if (buf.byteLength > maxSizeBytes) {
      console.warn(`Skipping image ${url.slice(0, 80)}… (${(buf.byteLength / 1024 / 1024).toFixed(1)} MB > limit)`);
      return null;
    }
    const bytes = new Uint8Array(buf);
    let binary = "";
    for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
    const b64 = btoa(binary);
    const ct = resp.headers.get("content-type") || "image/png";
    const mime = ct.includes("png") ? "image/png" : ct.includes("webp") ? "image/webp" : "image/jpeg";
    return { inlineData: { mimeType: mime, data: b64 } };
  } catch { return null; }
}

// ─── Upload base64 to storage ───
async function uploadToStorage(sb: any, base64: string, userId: string, path: string): Promise<string | null> {
  try {
    const isDataUrl = base64.startsWith("data:");
    const raw = isDataUrl ? base64.split(",")[1] : base64;
    const mimeMatch = isDataUrl ? base64.match(/^data:(image\/\w+);base64,/) : null;
    const contentType = mimeMatch ? mimeMatch[1] : "image/png";
    const bytes = Uint8Array.from(atob(raw), c => c.charCodeAt(0));
    const fullPath = `${userId}/${path}`;
    const { error } = await sb.storage.from("vehicle-images").upload(fullPath, bytes, { contentType, upsert: true });
    if (error) { console.error("Upload error:", error); return null; }
    const { data } = sb.storage.from("vehicle-images").getPublicUrl(fullPath);
    return data.publicUrl;
  } catch (e) { console.error("Upload failed:", e); return null; }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const sb = createServiceClient();

  try {
    const { jobId } = await req.json();
    if (!jobId) throw new Error("jobId required");

    // Fetch job
    const { data: job, error: fetchErr } = await sb
      .from("image_generation_jobs")
      .select("*")
      .eq("id", jobId)
      .single();

    if (fetchErr || !job) {
      return new Response(JSON.stringify({ error: "Job not found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Already completed or cancelled?
    if (job.status === "completed" || job.status === "cancelled" || job.status === "failed") {
      return new Response(JSON.stringify({ status: job.status }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Mark as running
    if (job.status === "pending") {
      await sb.from("image_generation_jobs").update({ status: "running", updated_at: new Date().toISOString() }).eq("id", jobId);
    }

    const tasks = job.tasks as any[];
    const config = job.config as any;

    // Find next pending task
    const taskIndex = tasks.findIndex((t: any) => t.status === "pending");
    if (taskIndex === -1) {
      // All tasks processed - finalize
      const completed = tasks.filter((t: any) => t.status === "done").length;
      const failed = tasks.filter((t: any) => t.status === "error").length;
      await sb.from("image_generation_jobs").update({
        status: failed === tasks.length ? "failed" : "completed",
        completed_tasks: completed,
        failed_tasks: failed,
        updated_at: new Date().toISOString(),
      }).eq("id", jobId);

      return new Response(JSON.stringify({ status: "completed", completed, failed }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Process this task
    const task = tasks[taskIndex];
    task.status = "running";
    await sb.from("image_generation_jobs").update({
      tasks: tasks,
      updated_at: new Date().toISOString(),
    }).eq("id", jobId);

    try {
      // Build Gemini parts
      const geminiModel = job.model_tier === "pro" ? "gemini-3-pro-image-preview" : "gemini-3.1-flash-image-preview";

      // Universal detailing prefix – ensures every generated image looks professionally detailed
      const detailingPrefix = 'MANDATORY PROFESSIONAL DETAILING: The vehicle MUST look as if it has undergone a full professional detailing. EXTERIOR: Paint must be flawless, high-gloss polished, free of any dirt, dust, water spots, scratches, bird droppings or road grime. All chrome, windows, headlights and rims must be spotlessly polished. Tires must look black and well-maintained. INTERIOR: The entire cabin must be clean and tidy. REMOVE any trash, paper, paper rolls, bottles, bags, clothing, charging cables, phones, notes, parking discs or any personal items that are NOT part of the vehicle\'s factory equipment. Seats, steering wheel, dashboard and center console must be immaculate. Floor mats clean, no crumbs or dirt. IMPORTANT: Do NOT add anything new – only remove dirt and foreign objects. The result must look like a perfectly detailed showroom-ready vehicle.\n\n';

      const parts: any[] = [{ text: detailingPrefix + task.prompt }];

      // Add only the first 2 input reference images to stay within memory limits
      const inputUrls = job.original_image_urls?.length > 0 ? job.original_image_urls : job.input_image_urls;
      for (const url of (inputUrls || []).slice(0, 2)) {
        const inlineData = await urlToInlineData(url);
        if (inlineData) parts.push(inlineData);
      }

      // Add showroom reference
      if (config.customShowroomUrl) {
        const d = await urlToInlineData(config.customShowroomUrl);
        if (d) parts.push(d);
      }
      // Add plate reference
      if (config.customPlateUrl) {
        const d = await urlToInlineData(config.customPlateUrl);
        if (d) parts.push(d);
      }
      // Add manufacturer logo
      if (config.manufacturerLogoUrl) {
        const d = await urlToInlineData(config.manufacturerLogoUrl);
        if (d) {
          parts.push({ text: "Das folgende Bild ist das HERSTELLER-LOGO (Manufacturer Logo). Verwende EXAKT dieses Logo im Hintergrund:" });
          parts.push(d);
        }
      }
      // Add dealer logo
      if (config.dealerLogoUrl) {
        const d = await urlToInlineData(config.dealerLogoUrl);
        if (d) {
          parts.push({ text: "Das folgende Bild ist das AUTOHAUS-LOGO (Dealer Logo). Verwende dieses Logo als sekundäres Branding:" });
          parts.push(d);
        }
      }

      console.log(`[Job ${jobId}] Processing task ${taskIndex + 1}/${tasks.length}: ${task.key}`);
      const resultImage = await callGemini(parts, geminiModel);

      if (resultImage) {
        // Upload to storage
        const projectId = job.project_id || "standalone";
        const url = await uploadToStorage(sb, resultImage, job.user_id, `${projectId}/pipeline_${task.key}_${task.subIndex || 0}.png`);

        task.status = "done";
        task.result_url = url;

        // Save to project_images if we have a project
        if (url && job.project_id) {
          await sb.from("project_images").insert({
            project_id: job.project_id,
            user_id: job.user_id,
            image_url: url,
            image_base64: "",
            perspective: `Pipeline: ${task.label}`,
            sort_order: 100 + taskIndex,
          });
        }
      } else {
        task.status = "error";
        task.error = "Kein Bild generiert";
      }
    } catch (e) {
      console.error(`[Job ${jobId}] Task ${taskIndex} error:`, e);
      task.status = "error";
      task.error = e instanceof Error ? e.message : "Unbekannter Fehler";
    }

    // Update job
    const completedCount = tasks.filter((t: any) => t.status === "done").length;
    const failedCount = tasks.filter((t: any) => t.status === "error").length;
    const remainingCount = tasks.filter((t: any) => t.status === "pending").length;

    await sb.from("image_generation_jobs").update({
      tasks: tasks,
      completed_tasks: completedCount,
      failed_tasks: failedCount,
      updated_at: new Date().toISOString(),
      ...(remainingCount === 0 ? {
        status: failedCount === tasks.length ? "failed" : "completed",
      } : {}),
    }).eq("id", jobId);

    // Self-invoke for next task if there are remaining tasks
    if (remainingCount > 0) {
      // Fire up to CONCURRENCY (4) parallel workers for remaining tasks
      const CONCURRENCY = 4;
      const pendingCount = tasks.filter((t: any) => t.status === "pending").length;
      const workersToSpawn = Math.min(CONCURRENCY - 1, pendingCount); // -1 because we just finished one

      const selfUrl = `${Deno.env.get("SUPABASE_URL")}/functions/v1/process-pipeline-job`;
      const headers = {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
      };

      for (let i = 0; i < workersToSpawn; i++) {
        fetch(selfUrl, {
          method: "POST",
          headers,
          body: JSON.stringify({ jobId }),
        }).catch(e => console.error("Self-invoke error:", e));
      }

      // Also continue in this invocation
      // But actually we should return and let the spawned workers handle it
      // to avoid timeout. We'll invoke one more for ourselves.
      if (pendingCount > workersToSpawn) {
        fetch(selfUrl, {
          method: "POST",
          headers,
          body: JSON.stringify({ jobId }),
        }).catch(e => console.error("Self-invoke error:", e));
      }
    }

    return new Response(JSON.stringify({
      status: remainingCount > 0 ? "running" : "completed",
      completed: completedCount,
      failed: failedCount,
      remaining: remainingCount,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (e) {
    console.error("process-pipeline-job error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
