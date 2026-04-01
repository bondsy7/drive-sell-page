/**
 * Client-side image compression utility for AI pipeline.
 * Compresses images to reduce payload size before sending to Edge Functions.
 * AI models don't need 12-megapixel images – 1024px max dimension is sufficient.
 */

/**
 * Compress an image (File or data URL) for AI processing.
 * Scales to max 1024px longest edge, converts to WebP at 80% quality.
 * Reduces typical smartphone photos from 5-10MB to ~100-200KB.
 */
export function compressImageForAI(
  input: string,
  maxDim = 1024,
  quality = 0.8
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

      // Prefer WebP for smaller size, fallback to JPEG
      const webp = canvas.toDataURL('image/webp', quality);
      if (webp.startsWith('data:image/webp')) {
        resolve(webp);
      } else {
        resolve(canvas.toDataURL('image/jpeg', quality));
      }
    };
    img.onerror = () => reject(new Error('Image load failed'));
    img.src = input;
  });
}

/**
 * Convert a File to a compressed base64 data URL for AI processing.
 * Combines file reading + compression in one step.
 */
export async function compressFileForAI(
  file: File,
  maxDim = 1024,
  quality = 0.8
): Promise<string> {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
  return compressImageForAI(dataUrl, maxDim, quality);
}

/**
 * Compress multiple images in parallel for AI pipeline.
 */
export async function compressImagesForAI(
  images: string[],
  maxDim = 1024,
  quality = 0.8
): Promise<string[]> {
  return Promise.all(images.map(img => compressImageForAI(img, maxDim, quality)));
}
