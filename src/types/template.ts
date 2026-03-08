export type TemplateId = 'autohaus' | 'modern' | 'klassisch' | 'minimalist';

export interface TemplateInfo {
  id: TemplateId;
  name: string;
  description: string;
  accent: string;
  previewStyle: 'light' | 'dark';
}

export const TEMPLATES: TemplateInfo[] = [
  { id: 'autohaus', name: 'Autohaus', description: 'Professionelles Zweispalten-Layout mit fixierter Sidebar', accent: '#1a1a1a', previewStyle: 'light' },
  { id: 'modern', name: 'Modern', description: 'Klar & aufgeräumt mit blauem Akzent', accent: '#3366cc', previewStyle: 'light' },
  { id: 'klassisch', name: 'Klassisch', description: 'Elegant & seriös mit Serifenschrift', accent: '#1a365d', previewStyle: 'light' },
  { id: 'minimalist', name: 'Minimalist', description: 'Reduziertestes Design, viel Weißraum', accent: '#1a1a1a', previewStyle: 'light' },
];