export type TemplateId = 'modern' | 'sportlich' | 'klassisch' | 'premium' | 'minimalist' | 'magazin';

export interface TemplateInfo {
  id: TemplateId;
  name: string;
  description: string;
  accent: string; // preview color
  previewStyle: 'light' | 'dark';
}

export const TEMPLATES: TemplateInfo[] = [
  { id: 'modern', name: 'Modern', description: 'Klar & aufgeräumt, helle Farbgebung', accent: '#e8a308', previewStyle: 'light' },
  { id: 'sportlich', name: 'Sportlich', description: 'Dunkles Design, dynamische Elemente', accent: '#ef4444', previewStyle: 'dark' },
  { id: 'klassisch', name: 'Klassisch', description: 'Traditionell & seriös mit Serifenschrift', accent: '#1e3a5f', previewStyle: 'light' },
  { id: 'premium', name: 'Premium', description: 'Luxuriös mit Gold-Akzenten', accent: '#d4a843', previewStyle: 'dark' },
  { id: 'minimalist', name: 'Minimalist', description: 'Reduziertestes Design, viel Weißraum', accent: '#111111', previewStyle: 'light' },
  { id: 'magazin', name: 'Magazin', description: 'Editorial-Stil wie ein Automagazin', accent: '#c026d3', previewStyle: 'light' },
];
