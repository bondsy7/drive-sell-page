import type Konva from "konva";
import type { BannerFormat } from "../state/types";
import { slugifyFormat } from "../data/formats";

export type ExportFormat = "png" | "jpg" | "webp";

export function exportStage(stage: Konva.Stage, format: BannerFormat, type: ExportFormat): string {
  const visualWidth = stage.width();
  const pixelRatio = visualWidth > 0 ? format.width / visualWidth : 1;
  const mime = type === "png" ? "image/png" : type === "jpg" ? "image/jpeg" : "image/webp";
  return stage.toDataURL({ mimeType: mime, pixelRatio, quality: 0.95 });
}

export function downloadDataUrl(dataUrl: string, filename: string) {
  const a = document.createElement("a");
  a.href = dataUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

export function buildFilename(format: BannerFormat, type: ExportFormat) {
  return `canvas-banner-studio-${slugifyFormat(format)}-${format.width}x${format.height}.${type}`;
}
