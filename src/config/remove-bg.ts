/**
 * Konfiguration für den Workflow "Hintergrund tauschen" (remove.bg).
 * Das Fahrzeug bleibt pixelgenau das Original – nur der Hintergrund wechselt.
 */

export type BackgroundMode = 'transparent' | 'color' | 'template' | 'upload' | 'ai';

/** remove.bg Motivtyp – verbessert die Kantenqualität deutlich. */
export type RemoveBgSubjectType = 'auto' | 'car' | 'transportation' | 'product' | 'person';

export interface BackgroundTemplate {
  id: string;
  label: string;
  description: string;
  /** Pfad im public-Ordner */
  url: string;
}

export const BACKGROUND_TEMPLATES: BackgroundTemplate[] = [
  {
    id: 'showroom',
    label: 'Showroom',
    description: 'Heller Premium-Showroom mit poliertem Boden',
    url: '/images/backgrounds/showroom.jpg',
  },
  {
    id: 'fahrzeugplatz',
    label: 'Fahrzeugplatz',
    description: 'Leerer Betonplatz, neutrale Halle im Hintergrund',
    url: '/images/backgrounds/fahrzeugplatz.jpg',
  },
  {
    id: 'lagerhalle',
    label: 'Lagerhalle',
    description: 'Industriehalle, Betonboden – ideal für Lkw',
    url: '/images/backgrounds/lagerhalle.jpg',
  },
  {
    id: 'studio-weiss',
    label: 'Studio Weiß',
    description: 'Nahtlose Studio-Fläche für Anzeigen & Banner',
    url: '/images/backgrounds/studio-weiss.jpg',
  },
];

export const SUBJECT_TYPES: { value: RemoveBgSubjectType; label: string }[] = [
  { value: 'car', label: 'Pkw' },
  { value: 'transportation', label: 'Lkw / Nutzfahrzeug' },
  { value: 'product', label: 'Motorrad / Objekt' },
  { value: 'auto', label: 'Automatisch erkennen' },
];

export const SOLID_COLORS: { value: string; label: string }[] = [
  { value: '#ffffff', label: 'Weiß' },
  { value: '#f4f1ec', label: 'Creme' },
  { value: '#e5e7eb', label: 'Hellgrau' },
  { value: '#174f6b', label: 'Petrol' },
  { value: '#212121', label: 'Anthrazit' },
  { value: '#000000', label: 'Schwarz' },
];

/** Kosten in App-Credits pro Bild. */
export const COST_PER_IMAGE = 1;
export const COST_PER_IMAGE_AI_BG = 3;

export const MAX_IMAGES = 10;
export const MAX_SIZE_MB = 12;

export interface RemoveBackgroundRequest {
  image: string;
  mode: BackgroundMode;
  bgColor?: string;
  bgImage?: string;
  aiPrompt?: string;
  type?: RemoveBgSubjectType;
  addShadow?: boolean;
  semitransparency?: boolean;
  size?: 'preview' | 'full' | 'auto';
  crop?: boolean;
  cropMargin?: string;
  scale?: string;
  position?: string;
}

/** Lädt ein Vorlagenbild aus /public und konvertiert es zu einer Data-URL. */
export async function templateToDataUrl(url: string): Promise<string> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Vorlage konnte nicht geladen werden (${res.status})`);
  const blob = await res.blob();
  return await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('Vorlage konnte nicht gelesen werden'));
    reader.readAsDataURL(blob);
  });
}
