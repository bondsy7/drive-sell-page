import { supabase } from '@/integrations/supabase/client';

const BUCKET = 'vehicle-images';

/**
 * Generate a gallery folder name based on VIN or fallback to date-based name.
 */
export function getGalleryFolderName(vin?: string | null): string {
  if (vin && vin.trim().length >= 5) return vin.trim().toUpperCase();
  const now = new Date();
  const date = now.toISOString().slice(0, 10); // YYYY-MM-DD
  const time = `${String(now.getHours()).padStart(2, '0')}-${String(now.getMinutes()).padStart(2, '0')}`;
  return `NO_VIN_${date}_${time}`;
}

/**
 * Save images to gallery (project_images table) with folder grouping.
 * Does NOT create a project – only stores images in the gallery.
 */
export async function saveImagesToGallery(
  images: string[],
  userId: string,
  galleryFolder: string,
  perspectives?: string[],
  projectId?: string | null,
): Promise<string[]> {
  const urls: string[] = [];
  for (let i = 0; i < images.length; i++) {
    const url = await uploadImageToStorage(
      images[i],
      userId,
      `gallery/${galleryFolder}/${i}.png`,
    );
    if (url) urls.push(url);
  }
  if (urls.length > 0) {
    const imageRows = urls.map((url, i) => ({
      project_id: projectId || null,
      user_id: userId,
      image_url: url,
      image_base64: '',
      perspective: perspectives?.[i] || `Bild ${i + 1}`,
      sort_order: i,
      gallery_folder: galleryFolder,
    }));
    await supabase.from('project_images').insert(imageRows as any);
  }
  return urls;
}

/**
 * Upload a base64 image to the vehicle-images bucket.
 * Returns the public URL.
 */
export async function uploadImageToStorage(
  base64: string,
  userId: string,
  fileName: string,
): Promise<string | null> {
  try {
    // Strip data URL prefix if present
    const isDataUrl = base64.startsWith('data:');
    const mimeMatch = isDataUrl ? base64.match(/^data:(image\/\w+);base64,/) : null;
    const contentType = mimeMatch ? mimeMatch[1] : 'image/png';
    const raw = isDataUrl ? base64.split(',')[1] : base64;

    // Convert base64 to Uint8Array
    const bytes = Uint8Array.from(atob(raw), c => c.charCodeAt(0));

    const path = `${userId}/${fileName}`;

    const { error } = await supabase.storage
      .from(BUCKET)
      .upload(path, bytes, { contentType, upsert: true });

    if (error) {
      console.error('Storage upload error:', error);
      return null;
    }

    const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(path);
    return urlData.publicUrl;
  } catch (err) {
    console.error('Upload to storage failed:', err);
    return null;
  }
}

/**
 * Upload multiple base64 images and return their public URLs.
 */
export async function uploadImagesToStorage(
  images: string[],
  userId: string,
  projectId: string,
): Promise<string[]> {
  const urls: string[] = [];
  for (let i = 0; i < images.length; i++) {
    const url = await uploadImageToStorage(
      images[i],
      userId,
      `${projectId}/${i}.png`,
    );
    if (url) urls.push(url);
  }
  return urls;
}

/**
 * Get an image source that works for both URLs and base64.
 * Used during the transition period.
 */
export function getImageSrc(value: string | null | undefined): string | null {
  if (!value) return null;
  if (value.startsWith('http')) return value;
  if (value.startsWith('data:')) return value;
  return `data:image/png;base64,${value}`;
}

/**
 * Fetch an image URL and return as base64 data URL (for HTML export).
 */
export async function urlToBase64(url: string): Promise<string> {
  if (!url.startsWith('http')) return url; // already base64
  try {
    const res = await fetch(url);
    const blob = await res.blob();
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch {
    return url;
  }
}

/**
 * Convert multiple image URLs to base64 for HTML export.
 */
export async function urlsToBase64(urls: string[]): Promise<string[]> {
  return Promise.all(urls.map(urlToBase64));
}

/**
 * Compress an image (URL or base64) to WebP using canvas.
 * Returns a data:image/webp;base64,... string.
 */
export async function compressToWebP(src: string, quality = 0.75, maxWidth = 1600): Promise<string> {
  // Ensure we have a usable src
  const imgSrc = src.startsWith('http') || src.startsWith('data:') ? src : `data:image/png;base64,${src}`;
  
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const scale = img.width > maxWidth ? maxWidth / img.width : 1;
      const w = Math.round(img.width * scale);
      const h = Math.round(img.height * scale);
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(img, 0, 0, w, h);
      resolve(canvas.toDataURL('image/webp', quality));
    };
    img.onerror = () => resolve(imgSrc); // fallback to original
    img.src = imgSrc;
  });
}

/**
 * Compress multiple images to WebP.
 */
export async function compressAllToWebP(srcs: string[], quality = 0.75): Promise<string[]> {
  return Promise.all(srcs.map(s => compressToWebP(s, quality)));
}
