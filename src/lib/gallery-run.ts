/**
 * Galerie-Läufe: Jeder neu angestoßene Erstellungsprozess (z. B. „Bilder erstellen")
 * bekommt einen eigenen Startzeitpunkt. Retries/Neu-Generierungen bleiben im Lauf.
 */
let activeRunAt: string | null = null;

export function beginGalleryRun(): string {
  activeRunAt = new Date().toISOString();
  return activeRunAt;
}

export function currentGalleryRun(): string {
  return activeRunAt ?? beginGalleryRun();
}

/** Dateisystemtauglicher Pfadabschnitt, damit neue Läufe nichts überschreiben. */
export function galleryRunSegment(runAt: string): string {
  return `run-${runAt.replace(/[^0-9]/g, '').slice(0, 14)}`;
}

export interface GalleryRunImage {
  id: string;
  gallery_folder: string | null;
  created_at?: string | null;
  pipeline_run_at?: string | null;
}

export function galleryRunKey(img: GalleryRunImage): string {
  return `${img.gallery_folder || 'Ohne Ordner'}::${img.pipeline_run_at || ''}`;
}

export function formatGalleryRunDate(runAt: string | null | undefined): string {
  if (!runAt) return '';
  const d = new Date(runAt);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) + ' Uhr';
}
