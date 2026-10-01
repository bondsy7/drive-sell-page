const EXTENSION_BY_MIME: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'video/mp4': 'mp4',
  'video/webm': 'webm',
};

function safeFilename(name: string, mimeType: string) {
  const cleaned = name
    .trim()
    .replace(/[\\/:*?"<>|]+/g, '-')
    .replace(/\s+/g, '_')
    .replace(/^\.+|\.+$/g, '') || 'download';
  const extension = EXTENSION_BY_MIME[mimeType.split(';')[0].toLowerCase()];
  const withoutExtension = cleaned.replace(/\.[a-z0-9]{2,5}$/i, '');
  return extension ? `${withoutExtension}.${extension}` : cleaned;
}

/**
 * Downloads remote and data-URL media through a local Blob URL.
 * This prevents mobile browsers from opening cross-origin images in a new tab.
 */
export async function downloadMediaFile(sourceUrl: string, filename: string) {
  const response = await fetch(sourceUrl);
  if (!response.ok) throw new Error(`Download fehlgeschlagen (${response.status})`);

  const blob = await response.blob();
  if (blob.size === 0) throw new Error('Die heruntergeladene Datei ist leer.');

  const blobUrl = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = blobUrl;
  anchor.download = safeFilename(filename, blob.type);
  anchor.rel = 'noopener';
  anchor.style.display = 'none';
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();

  window.setTimeout(() => URL.revokeObjectURL(blobUrl), 10_000);
}