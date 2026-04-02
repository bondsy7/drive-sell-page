import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import {
  Accordion, AccordionContent, AccordionItem, AccordionTrigger,
} from '@/components/ui/accordion';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  Download, Eye, Pencil, ArrowLeft, Upload, Sparkles, RefreshCw, Loader2, ImageIcon, MessageSquare,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  buildLandingPageHTML,
  type LandingPageContent,
  type LandingPageDealer,
  type LandingPageContactForm,
} from '@/lib/landing-page-builder';
import { downloadHTML } from '@/lib/templates/download';
import { uploadImageToStorage } from '@/lib/storage-utils';
import { invokeRemasterVehicleImage } from '@/lib/remaster-invoke';

interface LandingPageEditorProps {
  projectId: string;
  initialContent: LandingPageContent;
  initialImages: Record<string, string>;
  dealer: LandingPageDealer;
  brand: string;
  model: string;
  brandLogoUrl?: string;
  onBack: () => void;
}

const LandingPageEditor: React.FC<LandingPageEditorProps> = ({
  projectId, initialContent, initialImages, dealer: initialDealer,
  brand, model, brandLogoUrl, onBack,
}) => {
  const { user } = useAuth();
  const [content, setContent] = useState<LandingPageContent>({
    meta: initialContent?.meta || { title: '', description: '', h1: '' },
    hero: initialContent?.hero || { headline: '', subheadline: '', ctaText: '' },
    sections: initialContent?.sections || [],
    seo: initialContent?.seo,
  });
  const [images, setImages] = useState<Record<string, string>>(initialImages);
  const [dealer, setDealer] = useState<LandingPageDealer>(initialDealer);
  const [viewMode, setViewMode] = useState<'preview' | 'edit'>('edit');
  const [imageDialogSection, setImageDialogSection] = useState<string | null>(null);
  const [imageLoading, setImageLoading] = useState<string | null>(null);
  const [contactFormEnabled, setContactFormEnabled] = useState(true);
  const [vehicleTitle, setVehicleTitle] = useState(`${brand} ${model}`);
  const saveTimer = useRef<ReturnType<typeof setTimeout>>();

  const contactForm: LandingPageContactForm | undefined = contactFormEnabled && user ? {
    dealerUserId: user.id,
    projectId,
    supabaseUrl: import.meta.env.VITE_SUPABASE_URL || '',
    vehicleTitle,
  } : undefined;

  const html = useMemo(
    () => buildLandingPageHTML(content, images, dealer, brand, model, brandLogoUrl, contactForm),
    [content, images, dealer, brand, model, brandLogoUrl, contactForm, contactFormEnabled, vehicleTitle],
  );

  // Debounced auto-save
  useEffect(() => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      await supabase.from('projects').update({
        vehicle_data: { type: 'landing-page', brand, model, pageContent: content, imageMap: images, dealer, brandLogoUrl } as any,
        html_content: html,
        updated_at: new Date().toISOString(),
      }).eq('id', projectId);
    }, 1500);
    return () => { if (saveTimer.current) clearTimeout(saveTimer.current); };
  }, [html, projectId]);

  const updateSection = (id: string, field: string, value: string) =>
    setContent(prev => ({
      ...prev,
      sections: prev.sections.map(s => s.id === id ? { ...s, [field]: value } : s),
    }));

  const updateHero = (field: string, value: string) =>
    setContent(prev => ({ ...prev, hero: { ...prev.hero, [field]: value } }));

  const updateMeta = (field: string, value: string) =>
    setContent(prev => ({ ...prev, meta: { ...prev.meta, [field]: value } }));

  const handleImageUpload = async (sectionId: string, file: File) => {
    if (!user) return;
    setImageLoading(sectionId);
    try {
      const base64 = await fileToBase64(file);
      const url = await uploadImageToStorage(base64, user.id, `landing/${projectId}/${sectionId}-${Date.now()}.png`);
      if (url) {
        setImages(prev => ({ ...prev, [sectionId]: url }));
        toast.success('Bild hochgeladen!');
      }
    } catch {
      toast.error('Upload fehlgeschlagen');
    } finally {
      setImageLoading(null);
      setImageDialogSection(null);
    }
  };

  const handleRegenerate = async (sectionId: string) => {
    const section = content.sections.find(s => s.id === sectionId);
    const prompt = sectionId === 'hero' ? content.hero.imagePrompt : section?.imagePrompt;
    if (!prompt) { toast.error('Kein Bildprompt vorhanden'); return; }
    setImageLoading(sectionId);
    try {
      const { data, error } = await supabase.functions.invoke('generate-vehicle-image', {
        body: {
          imagePrompt: `Professional automotive marketing photo: ${prompt}. Modern, clean, professional. 16:9 aspect ratio. No text overlays.`,
          modelTier: 'schnell',
        },
      });
      if (error || !data?.imageBase64) { toast.error('Generierung fehlgeschlagen'); return; }
      if (user) {
        const url = await uploadImageToStorage(data.imageBase64, user.id, `landing/${projectId}/${sectionId}-${Date.now()}.png`);
        if (url) {
          setImages(prev => ({ ...prev, [sectionId]: url }));
          toast.success('Bild neu generiert!');
        }
      }
    } catch {
      toast.error('Fehler bei der Generierung');
    } finally {
      setImageLoading(null);
      setImageDialogSection(null);
    }
  };

  const handleRemaster = async (sectionId: string, file: File) => {
    if (!user) return;
    setImageLoading(sectionId);
    try {
      const base64 = await fileToBase64(file);
      const { data, error } = await invokeRemasterVehicleImage({ imageBase64: base64, vehicleDescription: `${brand} ${model}`, modelTier: 'schnell' });
      if (error || !data?.imageBase64) { toast.error('Remastering fehlgeschlagen'); return; }
      const url = await uploadImageToStorage(data.imageBase64, user.id, `landing/${projectId}/${sectionId}-${Date.now()}.png`);
      if (url) {
        setImages(prev => ({ ...prev, [sectionId]: url }));
        toast.success('Bild remastered!');
      }
    } catch {
      toast.error('Fehler beim Remastering');
    } finally {
      setImageLoading(null);
      setImageDialogSection(null);
    }
  };

  const handleExport = () => {
    downloadHTML(html, `${brand}_${model}_Landing_Page.html`);
    toast.success('HTML heruntergeladen!');
  };

  const currentDialogPrompt = imageDialogSection === 'hero'
    ? content.hero.imagePrompt
    : content.sections.find(s => s.id === imageDialogSection)?.imagePrompt;

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={onBack} className="gap-2">
            <ArrowLeft className="w-4 h-4" /> Zurück
          </Button>
          <div className="flex items-center bg-muted rounded-lg p-0.5">
            <button
              onClick={() => setViewMode('edit')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${viewMode === 'edit' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
            >
              <Pencil className="w-3.5 h-3.5" /> Bearbeiten
            </button>
            <button
              onClick={() => setViewMode('preview')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${viewMode === 'preview' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
            >
              <Eye className="w-3.5 h-3.5" /> Vorschau
            </button>
          </div>
        </div>
        <Button size="sm" onClick={handleExport} className="gap-2">
          <Download className="w-4 h-4" /> HTML herunterladen
        </Button>
      </div>

      {viewMode === 'preview' ? (
        <div className="rounded-2xl border border-border overflow-hidden bg-card">
          <iframe srcDoc={html} className="w-full border-0" style={{ minHeight: '80vh' }} title="Landing Page Vorschau" />
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Editor Panel */}
          <div className="space-y-3 max-h-[80vh] overflow-y-auto pr-1">
            {/* Meta */}
            <div className="rounded-xl border border-border bg-card p-4 space-y-2">
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">SEO & Meta</h3>
              <Input value={content.meta.title} onChange={e => updateMeta('title', e.target.value)} placeholder="SEO Title" className="text-sm" />
              <Input value={content.meta.description} onChange={e => updateMeta('description', e.target.value)} placeholder="Meta Description" className="text-sm" />
            </div>

            {/* Hero */}
            <div className="rounded-xl border border-border bg-card p-4 space-y-2">
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Hero-Bereich</h3>
              <Input value={content.hero.headline} onChange={e => updateHero('headline', e.target.value)} placeholder="Headline" className="text-sm font-semibold" />
              <Input value={content.hero.subheadline} onChange={e => updateHero('subheadline', e.target.value)} placeholder="Subheadline" className="text-sm" />
              <Input value={content.hero.ctaText} onChange={e => updateHero('ctaText', e.target.value)} placeholder="CTA Text" className="text-sm" />
              {images.hero && (
                <ImageSlot src={images.hero} alt="Hero" loading={imageLoading === 'hero'} onReplace={() => setImageDialogSection('hero')} />
              )}
            </div>

            {/* Sections */}
            <Accordion type="multiple" className="space-y-1">
              {content.sections.map((section, idx) => (
                <AccordionItem key={section.id} value={section.id} className="rounded-xl border border-border bg-card px-4">
                  <AccordionTrigger className="text-sm font-semibold py-3 hover:no-underline">
                    {section.headline || `Abschnitt ${idx + 1}`}
                  </AccordionTrigger>
                  <AccordionContent className="space-y-2 pb-4">
                    <Input value={section.headline} onChange={e => updateSection(section.id, 'headline', e.target.value)} placeholder="Überschrift" className="text-sm" />
                    <Textarea value={section.content} onChange={e => updateSection(section.id, 'content', e.target.value)} rows={5} placeholder="Inhalt (HTML)" className="text-sm font-mono" />
                    <select
                      value={section.bgStyle}
                      onChange={e => updateSection(section.id, 'bgStyle', e.target.value)}
                      className="text-xs border border-border rounded-md px-2 py-1.5 bg-background text-foreground"
                    >
                      <option value="white">Weiß</option>
                      <option value="light">Hell</option>
                      <option value="dark">Dunkel</option>
                      <option value="accent">Akzent</option>
                    </select>
                    {images[section.id] ? (
                      <ImageSlot src={images[section.id]} alt={section.headline} loading={imageLoading === section.id} onReplace={() => setImageDialogSection(section.id)} />
                    ) : section.imagePrompt ? (
                      <Button size="sm" variant="outline" onClick={() => setImageDialogSection(section.id)} className="gap-2 text-xs">
                        <ImageIcon className="w-3.5 h-3.5" /> Bild hinzufügen
                      </Button>
                    ) : null}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>

            {/* Contact Form Toggle */}
            <div className="rounded-xl border border-border bg-card p-4 space-y-3">
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
                <MessageSquare className="w-3.5 h-3.5" /> Kontaktformular
              </h3>
              <div className="flex items-center justify-between">
                <span className="text-sm text-foreground">Kontaktformular anzeigen</span>
                <Switch checked={contactFormEnabled} onCheckedChange={setContactFormEnabled} />
              </div>
              {contactFormEnabled && (
                <Input value={vehicleTitle} onChange={e => setVehicleTitle(e.target.value)} placeholder="Fahrzeugtitel im Formular" className="text-sm" />
              )}
              <p className="text-[10px] text-muted-foreground">Anfragen landen im CRM und werden vom Sales-Bot verarbeitet.</p>
            </div>

            {/* Dealer Info */}
            <div className="rounded-xl border border-border bg-card p-4 space-y-2">
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Händler</h3>
              <Input value={dealer.name || ''} onChange={e => setDealer(prev => ({ ...prev, name: e.target.value }))} placeholder="Firmenname" className="text-sm" />
              <Input value={dealer.phone || ''} onChange={e => setDealer(prev => ({ ...prev, phone: e.target.value }))} placeholder="Telefon" className="text-sm" />
              <Input value={dealer.email || ''} onChange={e => setDealer(prev => ({ ...prev, email: e.target.value }))} placeholder="E-Mail" className="text-sm" />
              <Input value={dealer.website || ''} onChange={e => setDealer(prev => ({ ...prev, website: e.target.value }))} placeholder="Website" className="text-sm" />
            </div>
          </div>

          {/* Preview Panel */}
          <div className="hidden lg:block sticky top-0">
            <div className="rounded-xl border border-border overflow-hidden bg-card" style={{ height: '80vh' }}>
              <iframe srcDoc={html} className="w-full h-full border-0" title="Vorschau" />
            </div>
          </div>
        </div>
      )}

      {/* Image Replace Dialog */}
      <Dialog open={!!imageDialogSection} onOpenChange={open => !open && !imageLoading && setImageDialogSection(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Bild ersetzen</DialogTitle>
          </DialogHeader>
          {imageLoading ? (
            <div className="flex items-center justify-center gap-2 py-8">
              <Loader2 className="w-5 h-5 animate-spin text-accent" />
              <span className="text-sm text-muted-foreground">Wird verarbeitet...</span>
            </div>
          ) : (
            <div className="space-y-2">
              <label className="flex items-center gap-3 p-3 rounded-lg border border-border hover:border-accent/50 cursor-pointer transition-colors">
                <Upload className="w-5 h-5 text-muted-foreground shrink-0" />
                <div>
                  <p className="text-sm font-medium text-foreground">Bild hochladen</p>
                  <p className="text-xs text-muted-foreground">Ein eigenes Bild verwenden</p>
                </div>
                <input type="file" accept="image/*" className="hidden" onChange={e => {
                  const file = e.target.files?.[0];
                  if (file && imageDialogSection) handleImageUpload(imageDialogSection, file);
                }} />
              </label>

              {currentDialogPrompt && (
                <button
                  onClick={() => imageDialogSection && handleRegenerate(imageDialogSection)}
                  className="w-full flex items-center gap-3 p-3 rounded-lg border border-border hover:border-accent/50 transition-colors text-left"
                >
                  <Sparkles className="w-5 h-5 text-muted-foreground shrink-0" />
                  <div>
                    <p className="text-sm font-medium text-foreground">Neu generieren</p>
                    <p className="text-xs text-muted-foreground">KI erstellt ein neues Bild (1 Credit)</p>
                  </div>
                </button>
              )}

              <label className="flex items-center gap-3 p-3 rounded-lg border border-border hover:border-accent/50 cursor-pointer transition-colors">
                <RefreshCw className="w-5 h-5 text-muted-foreground shrink-0" />
                <div>
                  <p className="text-sm font-medium text-foreground">Foto remastern</p>
                  <p className="text-xs text-muted-foreground">Eigenes Foto in Profi-Qualität umwandeln</p>
                </div>
                <input type="file" accept="image/*" className="hidden" onChange={e => {
                  const file = e.target.files?.[0];
                  if (file && imageDialogSection) handleRemaster(imageDialogSection, file);
                }} />
              </label>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

/* ── Helpers ── */

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

const ImageSlot: React.FC<{ src: string; alt: string; loading: boolean; onReplace: () => void }> = ({ src, alt, loading, onReplace }) => (
  <div className="relative group rounded-lg overflow-hidden">
    <img src={src} alt={alt} className="w-full aspect-video object-cover" />
    <div className="absolute inset-0 bg-foreground/0 group-hover:bg-foreground/40 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
      <Button size="sm" variant="secondary" onClick={onReplace} disabled={loading}>
        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <><RefreshCw className="w-4 h-4 mr-1" /> Ersetzen</>}
      </Button>
    </div>
  </div>
);

export default LandingPageEditor;
