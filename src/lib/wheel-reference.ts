import { supabase } from '@/integrations/supabase/client';
import { uploadToGeminiFiles } from '@/lib/gemini-file-upload';
import type { WheelAnalysis, WheelConfidence, WheelReference } from '@/types/wheel-reference';

/**
 * Analysiert eine dedizierte Felgenreferenz über die Edge Function
 * `analyze-wheel-reference`. Fehler blockieren NIEMALS den Upload –
 * in dem Fall wird `analysis: null` / `confidence: 'unknown'` zurückgegeben.
 */
export async function analyzeWheelReference(imageBase64: string): Promise<WheelReference> {
  const fallback: WheelReference = { image: imageBase64, analysis: null, confidence: 'unknown' };
  try {
    // File API First – base64 nur als Fallback.
    const refs = await uploadToGeminiFiles([{ imageBase64, displayName: 'wheel-reference' }]);
    const body = refs?.[0] ? { imageFileUri: refs[0] } : { imageBase64 };

    const { data, error } = await supabase.functions.invoke('analyze-wheel-reference', { body });
    if (error || !data?.analysis) {
      console.warn('[wheel-reference] Analyse fehlgeschlagen, fahre ohne Analyse fort:', error?.message);
      return fallback;
    }
    return {
      image: imageBase64,
      analysis: data.analysis as WheelAnalysis,
      confidence: (data.confidence as WheelConfidence) || 'unknown',
    };
  } catch (e) {
    console.warn('[wheel-reference] Analyse-Fehler (nicht blockierend):', e);
    return fallback;
  }
}

/**
 * FALLBACK: Erzeugt eine Felgenreferenz aus einem normalen Fahrzeugfoto,
 * wenn der Nutzer KEINE dedizierte Felgenaufnahme hochgeladen hat.
 * Der Radbereich wird per Vision-Erkennung lokalisiert, ausgeschnitten und
 * hochskaliert. Fehler sind niemals blockierend -> null.
 */
export async function deriveWheelReferenceFromPhoto(photoBase64: string): Promise<WheelReference | null> {
  try {
    const { data, error } = await supabase.functions.invoke('analyze-wheel-reference', {
      body: { imageBase64: photoBase64, mode: 'detect' },
    });
    const box = data?.box as { x: number; y: number; w: number; h: number } | null | undefined;
    if (error || !box) {
      console.warn('[wheel-reference] kein Rad im Foto erkannt – kein Fallback-Crop');
      return null;
    }
    const cropped = await cropRegion(photoBase64, box);
    if (!cropped) return null;
    return {
      image: cropped,
      analysis: (data?.analysis as WheelAnalysis) ?? null,
      confidence: (data?.confidence as WheelConfidence) || 'unknown',
      derived: true,
    };
  } catch (e) {
    console.warn('[wheel-reference] Fallback-Crop fehlgeschlagen (nicht blockierend):', e);
    return null;
  }
}

/** Schneidet eine normalisierte Box (mit Rand) aus und skaliert auf ~768px hoch. */
async function cropRegion(
  base64: string,
  box: { x: number; y: number; w: number; h: number },
): Promise<string | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      try {
        const pad = 0.12;
        const x = Math.max(0, (box.x - box.w * pad)) * img.width;
        const y = Math.max(0, (box.y - box.h * pad)) * img.height;
        const w = Math.min(img.width - x, box.w * (1 + 2 * pad) * img.width);
        const h = Math.min(img.height - y, box.h * (1 + 2 * pad) * img.height);
        if (w < 24 || h < 24) return resolve(null);
        const target = 768;
        const scale = Math.min(3, Math.max(1, target / Math.max(w, h)));
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(w * scale);
        canvas.height = Math.round(h * scale);
        const ctx = canvas.getContext('2d');
        if (!ctx) return resolve(null);
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, x, y, w, h, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/jpeg', 0.95));
      } catch {
        resolve(null);
      }
    };
    img.onerror = () => resolve(null);
    img.src = base64;
  });
}

/** Kompakter, promptfreundlicher Analyse-Block. Bild bleibt primäre Wahrheit. */
export function formatWheelAnalysisBlock(ref: WheelReference | null | undefined): string {
  const a = ref?.analysis;
  if (!a) return '';
  const lines: string[] = [];
  const add = (label: string, value: unknown) => {
    if (value === null || value === undefined || value === '' || value === 'unknown') return;
    lines.push(`- ${label}: ${value}`);
  };
  add('spoke_count', a.spokeCount);
  add('spoke_style', a.spokeStyle);
  add('finish', a.finish);
  add('secondary_color', a.secondaryColor);
  add('concavity', a.concavity);
  add('center_cap', a.centerCap);
  add('tire_visible', a.tireVisible);
  add('brake_caliper_visible', a.brakeCaliperVisible);
  add('brake_caliper_color', a.brakeCaliperColor);
  add('description', a.description);
  if (lines.length === 0) return '';
  return `<WHEEL_ANALYSIS confidence="${ref?.confidence || 'unknown'}"${ref?.derived ? ' source="auto-crop from vehicle photo"' : ''}>
Structured read of the dedicated wheel reference photo. It is a SUPPORT hint only.
If anything here conflicts with the wheel reference IMAGE, the IMAGE always wins.
${lines.join('\n')}
</WHEEL_ANALYSIS>`;
}
