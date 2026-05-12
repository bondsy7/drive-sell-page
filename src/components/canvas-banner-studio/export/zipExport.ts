import JSZip from "jszip";
import type { BannerTextFields, StudioState } from "../state/types";
import { getFormatById, slugifyFormat } from "../data/formats";
import { renderCompositionToBlob } from "./renderComposition";

export async function exportAllAsZip(state: StudioState, textFields: BannerTextFields, type: "png" | "jpg" | "webp" = "png") {
  const zip = new JSZip();
  for (const id of state.selectedFormatIds) {
    const format = getFormatById(id);
    const comp = state.compositions[id];
    if (!comp) continue;
    const blob = await renderCompositionToBlob(format, comp, textFields, type);
    zip.file(`canvas-banner-studio-${slugifyFormat(format)}-${format.width}x${format.height}.${type}`, blob);
  }
  const blob = await zip.generateAsync({ type: "blob" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `canvas-banner-studio-${state.selectedFormatIds.length}-banners.zip`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
