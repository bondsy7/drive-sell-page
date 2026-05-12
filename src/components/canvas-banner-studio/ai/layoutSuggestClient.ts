import { supabase } from "@/integrations/supabase/client";
import type { OverlayDirection } from "../state/types";

export type LayoutPosition =
  | "top-left" | "top-right" | "top-center"
  | "center"
  | "bottom-left" | "bottom-right" | "bottom-center";

export type LayoutSuggestion = {
  recommendedOverlay: OverlayDirection;
  headlinePosition: LayoutPosition;
  pricePosition: LayoutPosition;
  ctaPosition: LayoutPosition;
  logoPosition: LayoutPosition;
  reason: string;
};

export async function suggestLayoutFromImage(imageDataUrl: string): Promise<LayoutSuggestion> {
  const { data, error } = await supabase.functions.invoke("suggest-banner-layout", {
    body: { imageDataUrl },
  });
  if (error) throw error;
  return data as LayoutSuggestion;
}

/**
 * Map a LayoutPosition + format dimensions to (x,y) coordinates with sensible padding.
 * width = layer width estimate (defaults to 50% of canvas).
 */
export function positionToCoords(
  pos: LayoutPosition,
  formatW: number,
  formatH: number,
  layerW: number,
  layerH: number,
) {
  const pad = Math.max(8, Math.round(Math.min(formatW, formatH) * 0.04));
  const cx = Math.round((formatW - layerW) / 2);
  const cy = Math.round((formatH - layerH) / 2);
  switch (pos) {
    case "top-left": return { x: pad, y: pad };
    case "top-right": return { x: formatW - layerW - pad, y: pad };
    case "top-center": return { x: cx, y: pad };
    case "center": return { x: cx, y: cy };
    case "bottom-left": return { x: pad, y: formatH - layerH - pad };
    case "bottom-right": return { x: formatW - layerW - pad, y: formatH - layerH - pad };
    case "bottom-center": return { x: cx, y: formatH - layerH - pad };
  }
}
