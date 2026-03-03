export type TemplateId = 'modern' | 'sportlich' | 'klassisch' | 'premium' | 'minimalist' | 'magazin';

export interface TemplateInfo {
  id: TemplateId;
  name: string;
  description: string;
  accent: string;
  previewStyle: 'light' | 'dark';
}

export const TEMPLATES: TemplateInfo[] = [
  { id: 'modern', name: 'Modern', description: 'Klar & aufgeräumt mit blauem Akzent', accent: '#3366cc', previewStyle: 'light' },
  { id: 'sportlich', name: 'Sportlich', description: 'Dunkles Design, dynamische Elemente', accent: '#e63946', previewStyle: 'dark' },
  { id: 'klassisch', name: 'Klassisch', description: 'Elegant & seriös mit Serifenschrift', accent: '#1a365d', previewStyle: 'light' },
  { id: 'premium', name: 'Premium', description: 'Luxuriös mit Gold-Akzenten', accent: '#c9a84c', previewStyle: 'dark' },
  { id: 'minimalist', name: 'Minimalist', description: 'Reduziertestes Design, viel Weißraum', accent: '#1a1a1a', previewStyle: 'light' },
  { id: 'magazin', name: 'Magazin', description: 'Editorial-Stil wie ein Automagazin', accent: '#2563eb', previewStyle: 'light' },
];