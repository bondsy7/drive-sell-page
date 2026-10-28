import type { ExplainerVideoSource } from "@/components/ExplainerVideoButton";
import webmAsset from "@/assets/remaster-explanation.webm.asset.json";
import mp4Asset from "@/assets/remaster-explanation.mp4.asset.json";
import posterAsset from "@/assets/remaster-explanation-poster.jpg.asset.json";

/** Optimized explainer videos, loaded only when their player opens. */
export const EXPLAINER_VIDEOS: Record<"fotos", ExplainerVideoSource | null> = {
  fotos: {
    webm: webmAsset.url,
    mp4: mp4Asset.url,
    poster: posterAsset.url,
  },
};
