import { uploadToGeminiFiles, type GeminiFileRef } from './gemini-file-upload';
import type { V2Reference } from '@/prompts/nb21/v2';

/** Create once for one run, retain for retries, never share with another run. */
export class V2RunUploadCache {
  private readonly uploads = new Map<string, { image: string; result: Promise<GeminiFileRef | null> }>();

  async resolve(source: V2Reference): Promise<GeminiFileRef | null> {
    const key = `${source.sourceType}:${source.assetId ?? source.sourceId}`;
    const cached = this.uploads.get(key);
    if (cached && cached.image !== source.image) throw new Error('NB21 v2: Quellen-ID wurde innerhalb des Laufs für andere Bilddaten wiederverwendet.');
    if (source.fileUri?.uri) {
      this.uploads.set(key, { image: source.image, result: Promise.resolve(source.fileUri) });
      return source.fileUri;
    }
    if (cached) return cached.result;
    if (source.openAIFile?.fileId) return null;
    const result = uploadToGeminiFiles([{ id: source.sourceId, imageBase64: source.image }])
      .then(refs => refs?.[0] ?? null);
    // Pending promises deduplicate concurrent jobs as well as sequential ones.
    this.uploads.set(key, { image: source.image, result });
    return result;
  }
}