/**
 * Client-side image compression for AI pipeline.
 * Reduces image size before sending to edge functions,
 * cutting payload from ~12MB to ~100-200KB per image.
 */

/**
 * Read a File as a data URL (base64).
 */
export function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/**
 * Compress a base64 image (data URL) for AI processing.
 * Scales down to maxDim on the longest edge and converts to WebP at given quality.
 * Typical output: ~100-200KB instead of 5-12MB.
 */
export function compressImageForAI(
  dataUrl: string,
  maxDim = 1024,
  quality = 0.8,
): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      let { width, height } = img;
      if (width > maxDim || height > maxDim) {
        const scale = maxDim / Math.max(width, height);
        width = Math.round(width * scale);
        height = Math.round(height * scale);
      }

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Canvas not supported'));
        return;
      }

      ctx.drawImage(img, 0, 0, width, height);

      // Prefer WebP, fallback to JPEG
      let result = canvas.toDataURL('image/webp', quality);
      if (!result.startsWith('data:image/webp')) {
        result = canvas.toDataURL('image/jpeg', quality);
      }
      resolve(result);
    };
    img.onerror = () => reject(new Error('Image load failed'));
    img.src = dataUrl;
  });
}

/**
 * Compress a File directly for AI processing.
 * Convenience wrapper: File → base64 → compressed.
 */
export async function compressFileForAI(
  file: File,
  maxDim = 1024,
  quality = 0.8,
): Promise<string> {
  const raw = await fileToBase64(file);
  return compressImageForAI(raw, maxDim, quality).catch(() => raw);
}
