/**
 * Pre-renders images (showrooms, logos) to base64 and caches them
 * in memory + localStorage so they're instantly available for API calls.
 */

const CACHE_KEY = 'img_b64_cache';
const CACHE_VERSION = 3; // v3: logos cached as PNG for AI compatibility

interface CacheEntry {
  url: string;
  base64: string;
  cachedAt: number;
}

interface CacheStore {
  version: number;
  entries: Record<string, CacheEntry>;
}

// In-memory mirror for instant access
let memoryCache: Record<string, string> = {};

function loadStore(): CacheStore {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return { version: CACHE_VERSION, entries: {} };
    const parsed = JSON.parse(raw) as CacheStore;
    if (parsed.version !== CACHE_VERSION) return { version: CACHE_VERSION, entries: {} };
    return parsed;
  } catch {
    return { version: CACHE_VERSION, entries: {} };
  }
}

function saveStore(store: CacheStore) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(store));
  } catch {
    // localStorage full – clear old entries
    try {
      localStorage.removeItem(CACHE_KEY);
      localStorage.setItem(CACHE_KEY, JSON.stringify({ version: CACHE_VERSION, entries: {} }));
    } catch { /* ignore */ }
  }
}

/** Convert a URL to base64 data URL */
async function fetchAsBase64(url: string): Promise<string> {
  const res = await fetch(url);
  const blob = await res.blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

/**
 * Convert a URL to a PNG base64 data URL via canvas.
 * This ensures logos are always sent as PNG (best AI compatibility).
 */
async function fetchAsPngBase64(url: string): Promise<string> {
  const res = await fetch(url);
  const blob = await res.blob();
  const bitmap = await createImageBitmap(blob);
  const canvas = document.createElement('canvas');
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas not supported');
  ctx.drawImage(bitmap, 0, 0);
  bitmap.close();
  return canvas.toDataURL('image/png');
}

/**
 * Get a cached base64 for a URL. Returns null if not cached yet.
 */
export function getCachedBase64(url: string): string | null {
  if (!url) return null;
  // Already base64
  if (url.startsWith('data:')) return url;
  return memoryCache[url] || null;
}

/**
 * Ensure a URL is cached as base64. Returns the base64 string.
 * Uses memory first, then localStorage, then fetches.
 */
export async function ensureCachedBase64(url: string): Promise<string> {
  if (!url) return url;
  if (url.startsWith('data:')) return url;

  // 1. Memory
  if (memoryCache[url]) return memoryCache[url];

  // 2. localStorage
  const store = loadStore();
  if (store.entries[url]) {
    memoryCache[url] = store.entries[url].base64;
    return store.entries[url].base64;
  }

  // 3. Fetch & cache
  try {
    const base64 = await fetchAsBase64(url);
    memoryCache[url] = base64;
    store.entries[url] = { url, base64, cachedAt: Date.now() };
    saveStore(store);
    return base64;
  } catch (err) {
    console.warn('[image-cache] Failed to cache:', url, err);
    return url; // fallback to URL
  }
}

/**
 * Pre-warm cache for multiple URLs in parallel.
 * Call this on component mount with all showroom/logo URLs.
 */
export async function prewarmCache(urls: string[]): Promise<void> {
  const uncached = urls.filter(u => u && !u.startsWith('data:') && !memoryCache[u]);
  if (uncached.length === 0) return;

  console.log(`[image-cache] Pre-warming ${uncached.length} images...`);
  await Promise.allSettled(uncached.map(ensureCachedBase64));
  console.log(`[image-cache] Cache warm. Total cached: ${Object.keys(memoryCache).length}`);
}

/**
 * Pre-warm all built-in showroom images.
 */
export async function prewarmShowrooms(): Promise<void> {
  const showroomUrls = [
    '/images/showrooms/showroom-1.webp',
    '/images/showrooms/showroom-2.webp',
    '/images/showrooms/showroom-3.webp',
  ];
  await prewarmCache(showroomUrls);
}

/**
 * Ensure a logo URL is cached as PNG base64 (converted via canvas for AI compatibility).
 * WebP/SVG logos are converted to PNG to ensure Gemini processes them correctly.
 */
export async function ensureLogoCachedAsPng(url: string): Promise<string> {
  if (!url) return url;
  if (url.startsWith('data:image/png')) return url;

  const cacheKey = `logo_png:${url}`;

  // 1. Memory
  if (memoryCache[cacheKey]) return memoryCache[cacheKey];

  // 2. localStorage
  const store = loadStore();
  if (store.entries[cacheKey]) {
    memoryCache[cacheKey] = store.entries[cacheKey].base64;
    return store.entries[cacheKey].base64;
  }

  // 3. Fetch, convert to PNG via canvas, cache
  try {
    const pngBase64 = await fetchAsPngBase64(url);
    memoryCache[cacheKey] = pngBase64;
    store.entries[cacheKey] = { url, base64: pngBase64, cachedAt: Date.now() };
    saveStore(store);
    console.log(`[image-cache] Logo converted to PNG and cached: ${url} (${Math.round(pngBase64.length / 1024)}KB)`);
    return pngBase64;
  } catch (err) {
    console.warn('[image-cache] Failed to convert logo to PNG, falling back to regular cache:', url, err);
    return ensureCachedBase64(url);
  }
}

/**
 * Clear the entire cache.
 */
export function clearImageCache() {
  memoryCache = {};
  localStorage.removeItem(CACHE_KEY);
}

/**
 * Initialize cache on app start – loads localStorage entries into memory.
 */
export function initImageCache() {
  const store = loadStore();
  for (const [url, entry] of Object.entries(store.entries)) {
    memoryCache[url] = entry.base64;
  }
  console.log(`[image-cache] Loaded ${Object.keys(memoryCache).length} cached images from storage.`);
}
