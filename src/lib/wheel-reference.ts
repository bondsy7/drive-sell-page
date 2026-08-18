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
  return `<WHEEL_ANALYSIS confidence="${ref?.confidence || 'unknown'}">
Structured read of the dedicated wheel reference photo. It is a SUPPORT hint only.
If anything here conflicts with the wheel reference IMAGE, the IMAGE always wins.
${lines.join('\n')}
</WHEEL_ANALYSIS>`;
}
