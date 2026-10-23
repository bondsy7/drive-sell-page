import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import {
  Download, Eye, Pencil, ArrowLeft, Upload, Sparkles, RefreshCw, Loader2, MessageSquare, Images, Monitor, Smartphone, Tablet, Plus, Car, Undo2,
} from 'lucide-react';
import { toast } from 'sonner';
import LandingRenderer from '@/components/landing/LandingRenderer';
import {
  buildLandingPageHTML,
  type LandingPageContent,
  type LandingPageSection,
  type LandingPageDealer,
  type LandingPageContactForm,
} from '@/lib/landing-page-builder';
import { downloadHTML } from '@/lib/templates/download';
import { uploadImageToStorage } from '@/lib/storage-utils';
import { invokeRemasterVehicleImage } from '@/lib/remaster-invoke';
import VehicleImagePicker from '@/components/landing/VehicleImagePicker';
import { buildScenePrompt } from '@/lib/landing-scene-prompts';
import LiveVehiclesBlock from '@/components/landing/LiveVehiclesBlock';
import {
  DEFAULT_LIVE_INVENTORY, resolveLiveVehicles,
  type LiveInventoryConfig, type LiveVehicle,
} from '@/lib/live-inventory';
import { fetchLiveInventory } from '@/lib/live-inventory-fetch';
import { useLandingEditorHistory } from '@/hooks/useLandingEditorHistory';
import { removeLandingElement } from '@/lib/landing-element-editing';
import { replaceLandingImage, LANDING_UPLOAD_DISCLOSURE_NOTICE } from '@/lib/landing-image-disclosure';
import { useLiveVehicleCardDesign } from '@/hooks/useLiveVehicleCardDesign';
import { defaultContactFormConfig, sanitizeContactFormConfig, type LandingContactFormConfig } from '@/lib/landing-contact-config';
import { ContactFormConfigDialog, ContactFormWidgetPreview } from '@/components/landing/LandingContactForm';

interface LandingPageEditorProps {
  projectId: string;
  vehicleId?: string | null;
  initialContent: LandingPageContent;
  initialImages: Record<string, string>;
  dealer: LandingPageDealer;
  brand: string;
  model: string;
  brandLogoUrl?: string;
  /** Gespeicherte Live-Fahrzeug-Regel aus vehicle_data (falls vorhanden). */
  initialLiveInventory?: LiveInventoryConfig | null;
  /** Kompletter vehicle_data-Wert, damit beim Speichern nichts verloren geht. */
  initialVehicleData?: Record<string, unknown>;
  onBack: () => void;
}

type Viewport = 'desktop' | 'tablet' | 'mobile';
const VIEWPORT_WIDTH: Record<Viewport, number | undefined> = {
  desktop: 1600,
  tablet: 820,
  mobile: 420,
};

const SECTION_TYPES: { value: string; label: string; description: string }[] = [
  { value: 'content', label: 'Text + Bild', description: 'Editorial-Split, Bild neben Text' },
  { value: 'gallery', label: 'Galerie', description: 'Großes Bild oben, Text darunter' },
  { value: 'specs', label: 'Spezifikationen', description: 'Technische Daten mit Bild' },
  { value: 'benefits', label: 'Vorteile', description: 'Aufzählung ohne Bild' },
  { value: 'steps', label: 'Ablauf', description: 'Schritt-für-Schritt' },
  { value: 'faq', label: 'FAQ', description: 'Fragen & Antworten' },
  { value: 'comparison', label: 'Vergleich', description: 'Vergleichstabelle' },
  { value: 'cta', label: 'CTA-Band', description: 'Farbiger Call-to-Action-Streifen' },
];

const LandingPageEditor: React.FC<LandingPageEditorProps> = ({
  projectId, vehicleId, initialContent, initialImages, dealer: initialDealer,
  brand, model, brandLogoUrl, initialLiveInventory, initialVehicleData, onBack,
}) => {
  const { user } = useAuth();
  const { data: profileCardDesign } = useLiveVehicleCardDesign();
  const { state: editorState, update: updateEditor, change, undo, canUndo } = useLandingEditorHistory({
    content: {
      ...initialContent,
      meta: initialContent?.meta || { title: '', description: '', h1: '' },
      hero: initialContent?.hero || { headline: '', subheadline: '', ctaText: '' },
      sections: (initialContent?.sections || []).map(s => ({ ...s, enabled: s.enabled !== false })),
    } as LandingPageContent,
    images: initialImages,
    liveInventory: initialLiveInventory?.enabled ? { ...DEFAULT_LIVE_INVENTORY, ...initialLiveInventory } : DEFAULT_LIVE_INVENTORY,
    contactFormEnabled: initialVehicleData?.contactFormEnabled !== false,
    contactFormConfig: sanitizeContactFormConfig(
      initialVehicleData?.contactFormConfig,
      defaultContactFormConfig(`${brand} ${model}`.trim(), initialDealer?.email || ''),
    ),
  });
  const contactFormConfig = editorState.contactFormConfig;
  const setContactFormConfig = useCallback((value: LandingContactFormConfig) => updateEditor('contactFormConfig', value), [updateEditor]);
  const [contactConfigOpen, setContactConfigOpen] = useState(false);
  const [bulkConfirmOpen, setBulkConfirmOpen] = useState(false);
  const { content, images, contactFormEnabled } = editorState;
  const liveInventory = useMemo(() => ({ ...editorState.liveInventory, cardDesign: profileCardDesign || undefined }), [editorState.liveInventory, profileCardDesign]);
  const setContent = useCallback((value: React.SetStateAction<LandingPageContent>) => updateEditor('content', value), [updateEditor]);
  const replaceImage = useCallback((id: string, url: string, kind: 'upload' | 'ai') => change(state => replaceLandingImage(state, id, url, kind)), [change]);
  const setLiveInventory = useCallback((value: React.SetStateAction<LiveInventoryConfig>) => updateEditor('liveInventory', value), [updateEditor]);
  const setContactFormEnabled = useCallback((value: React.SetStateAction<boolean>) => updateEditor('contactFormEnabled', value), [updateEditor]);
  const deleteElement = useCallback((id: string) => setContent(previous => removeLandingElement(previous, id)), [setContent]);
  const [dealer] = useState<LandingPageDealer>(initialDealer);
  const [viewMode, setViewMode] = useState<'preview' | 'edit'>('edit');
  const [viewport, setViewport] = useState<Viewport>('desktop');
  const [imageDialogSection, setImageDialogSection] = useState<string | null>(null);
  const [pickFromGallery, setPickFromGallery] = useState(false);
  const [addAfterId, setAddAfterId] = useState<string | null | undefined>(undefined);
  const [imageLoading, setImageLoading] = useState<string | null>(null);
  const [vehicleTitle] = useState(`${brand} ${model}`);
  const saveTimer = useRef<ReturnType<typeof setTimeout>>();

  // ── Live-Fahrzeuge: die Regel kommt aus dem Projekt, die Fahrzeuge immer aus dem aktuellen Bestand ──
  const [liveItems, setLiveItems] = useState<LiveVehicle[] | null>(null);
  const [liveUrl, setLiveUrl] = useState('');
  const [liveLoading, setLiveLoading] = useState(false);
  const [liveError, setLiveError] = useState<string | null>(null);
  const [liveDialogOpen, setLiveDialogOpen] = useState(false);

  const loadLive = useCallback(async () => {
    setLiveLoading(true); setLiveError(null);
    const res = await fetchLiveInventory();
    setLiveLoading(false);
    if (res.error) { setLiveError(res.error); return; }
    setLiveItems(res.items);
    setLiveUrl(res.inventoryUrl);
  }, []);

  useEffect(() => { if (liveInventory.enabled && !liveItems && !liveLoading) loadLive(); /* eslint-disable-next-line */ }, [liveInventory.enabled]);

  const liveVehicles = useMemo(() => resolveLiveVehicles(liveItems || [], liveInventory), [liveItems, liveInventory]);

  const contactForm: LandingPageContactForm | undefined = contactFormEnabled && user ? {
    dealerUserId: user.id,
    projectId,
    vehicleId,
    supabaseUrl: import.meta.env.VITE_SUPABASE_URL || '',
    vehicleTitle,
    heading: contactFormConfig.heading,
    intro: contactFormConfig.intro,
  } : undefined;

  const html = useMemo(
    () => buildLandingPageHTML(
      content, images, dealer, brand, model, brandLogoUrl, contactForm,
      liveInventory.enabled ? { config: liveInventory, vehicles: liveVehicles, inventoryUrl: liveUrl } : undefined,
    ),
    [content, images, dealer, brand, model, brandLogoUrl, contactForm, liveInventory, liveVehicles, liveUrl],
  );

  // Debounced auto-save
  useEffect(() => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      await supabase.from('projects').update({
        vehicle_data: {
          ...(initialVehicleData || {}),
          type: 'landing-page',
          brand,
          model,
          pageContent: content,
          imageMap: images,
          dealer,
          brandLogoUrl,
          liveInventory: liveInventory.enabled ? liveInventory : null,
          contactFormEnabled,
          contactFormConfig,
        } as any,
        html_content: html,
        updated_at: new Date().toISOString(),
      }).eq('id', projectId);
    }, 1500);
    return () => { if (saveTimer.current) clearTimeout(saveTimer.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [html, projectId]);

  const updateHero = useCallback((field: 'headline' | 'subheadline' | 'ctaText', value: string) => {
    setContent(prev => ({ ...prev, hero: { ...prev.hero, [field]: value } }));
  }, []);

  const updateSection = useCallback((id: string, field: 'headline' | 'content', value: string) => {
    setContent(prev => ({ ...prev, sections: prev.sections.map(s => s.id === id ? { ...s, [field]: value } : s) }));
  }, []);

  const moveSection = useCallback((id: string, dir: 'up' | 'down') => {
    setContent(prev => {
      const idx = prev.sections.findIndex(s => s.id === id);
      if (idx < 0) return prev;
      const swapIdx = dir === 'up' ? idx - 1 : idx + 1;
      if (swapIdx < 0 || swapIdx >= prev.sections.length) return prev;
      const next = [...prev.sections];
      [next[idx], next[swapIdx]] = [next[swapIdx], next[idx]];
      return { ...prev, sections: next };
    });
  }, []);

  const toggleSection = useCallback((id: string) => {
    setContent(prev => ({ ...prev, sections: prev.sections.map(s => s.id === id ? { ...s, enabled: !(s.enabled !== false) } : s) }));
  }, []);

  const deleteSection = useCallback((id: string) => {
    setContent(prev => ({ ...prev, sections: prev.sections.filter(s => s.id !== id) }));
  }, []);

  const insertSection = useCallback((afterId: string | null, type: string) => {
    const newSection: LandingPageSection = {
      id: `s-${Date.now()}`,
      type,
      headline: 'Neue Überschrift',
      content: '<p>Hier klicken, um den Text zu bearbeiten…</p>',
      imagePrompt: ['content', 'gallery', 'specs'].includes(type) ? `Automotive photo of a ${brand} ${model}` : null,
      bgStyle: 'white',
      enabled: true,
    };
    setContent(prev => {
      if (afterId === null || afterId === 'hero') {
        return { ...prev, sections: [newSection, ...prev.sections] };
      }
      const idx = prev.sections.findIndex(s => s.id === afterId);
      if (idx < 0) return { ...prev, sections: [...prev.sections, newSection] };
      const next = [...prev.sections];
      next.splice(idx + 1, 0, newSection);
      return { ...prev, sections: next };
    });
    setAddAfterId(undefined);
  }, [brand, model]);

  const handleImageUpload = async (sectionId: string, file: File) => {
    if (!user) return;
    setImageLoading(sectionId);
    try {
      const base64 = await fileToBase64(file);
      const url = await uploadImageToStorage(base64, user.id, `landing/${projectId}/${sectionId}-${Date.now()}.png`);
      if (url) {
        replaceImage(sectionId, url, 'upload');
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
    const headline = sectionId === 'hero' ? content.hero.headline : section?.headline;
    const { prompt } = buildScenePrompt({
      brand, model,
      sectionId,
      sectionType: section?.type,
      headline,
    });
    setImageLoading(sectionId);
    try {
      const { data, error } = await supabase.functions.invoke('generate-vehicle-image', {
        body: { imagePrompt: prompt, modelTier: 'schnell' },
      });
      if (error || !data?.imageBase64) { toast.error('Generierung fehlgeschlagen'); return; }
      if (user) {
        const url = await uploadImageToStorage(data.imageBase64, user.id, `landing/${projectId}/${sectionId}-${Date.now()}.png`);
        if (url) {
          replaceImage(sectionId, url, 'ai');
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

  const handleGenerateAllScenes = async () => {
    if (!user) return;
    const targets: { id: string; type?: string; headline?: string }[] = [
      { id: 'hero', headline: content.hero.headline },
      ...content.sections
        .filter(s => s.enabled !== false && ['content', 'gallery', 'specs'].includes(s.type))
        .map(s => ({ id: s.id, type: s.type, headline: s.headline })),
    ];
    setImageLoading('__bulk__');
    let ok = 0;
    for (const t of targets) {
      const { prompt } = buildScenePrompt({ brand, model, sectionId: t.id, sectionType: t.type, headline: t.headline });
      try {
        const { data } = await supabase.functions.invoke('generate-vehicle-image', {
          body: { imagePrompt: prompt, modelTier: 'schnell' },
        });
        if (data?.imageBase64) {
          const url = await uploadImageToStorage(data.imageBase64, user.id, `landing/${projectId}/${t.id}-${Date.now()}.png`);
          if (url) {
            replaceImage(t.id, url, 'ai');
            ok++;
          }
        }
      } catch (e) { console.warn('scene gen failed', t.id, e); }
    }
    setImageLoading(null);
    toast.success(`${ok} von ${targets.length} Szenen generiert`);
  };

  const handleRemaster = async (sectionId: string, file: File) => {
    if (!user) return;
    setImageLoading(sectionId);
    try {
      const base64 = await fileToBase64(file);
      const { data, error } = await invokeRemasterVehicleImage({
        imageBase64: base64,
        vehicleDescription: `${brand} ${model}`,
        modelTier: 'schnell',
      });
      if (error || !data?.imageBase64) { toast.error('Remastering fehlgeschlagen'); return; }
      const url = await uploadImageToStorage(data.imageBase64, user.id, `landing/${projectId}/${sectionId}-${Date.now()}.png`);
      if (url) {
        replaceImage(sectionId, url, 'ai');
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

  const canvasWidth = VIEWPORT_WIDTH[viewport];

  return (
    <div className="flex flex-col h-full min-h-screen bg-muted/30">
      {/* Toolbar */}
      <div className="sticky top-0 z-30 flex items-center justify-between gap-3 flex-wrap px-4 py-3 border-b bg-background/95 backdrop-blur">
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

          <div className="hidden sm:flex items-center bg-muted rounded-lg p-0.5 ml-1">
            <button onClick={() => setViewport('desktop')} className={`p-1.5 rounded-md ${viewport === 'desktop' ? 'bg-background shadow-sm' : 'text-muted-foreground'}`} title="Desktop">
              <Monitor className="w-3.5 h-3.5" />
            </button>
            <button onClick={() => setViewport('tablet')} className={`p-1.5 rounded-md ${viewport === 'tablet' ? 'bg-background shadow-sm' : 'text-muted-foreground'}`} title="Tablet">
              <Tablet className="w-3.5 h-3.5" />
            </button>
            <button onClick={() => setViewport('mobile')} className={`p-1.5 rounded-md ${viewport === 'mobile' ? 'bg-background shadow-sm' : 'text-muted-foreground'}`} title="Mobile">
              <Smartphone className="w-3.5 h-3.5" />
            </button>
          </div>
          <Button variant="outline" size="icon" onClick={undo} disabled={!canUndo} title="Letzte Änderung rückgängig machen" aria-label="Letzte Änderung rückgängig machen">
            <Undo2 className="w-4 h-4" />
          </Button>
        </div>

        <div className="flex items-center gap-2">
          <div className="hidden md:flex items-center gap-2 text-xs text-muted-foreground mr-2">
            <MessageSquare className="w-3.5 h-3.5" />
            <span>Kontaktformular</span>
            <Switch checked={contactFormEnabled} onCheckedChange={setContactFormEnabled} />
            {contactFormEnabled && (
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setContactConfigOpen(true)} title="Kontaktformular einstellen" aria-label="Kontaktformular einstellen">
                <Pencil className="w-3.5 h-3.5" />
              </Button>
            )}
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setBulkConfirmOpen(true)}
            disabled={imageLoading === '__bulk__'}
            className="gap-2"
            title="Für jeden Abschnitt ein neues KI-Bild generieren (Texte bleiben unverändert)"
          >
            {imageLoading === '__bulk__' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
            Alle Bilder generieren
          </Button>
          <Button size="sm" variant="outline" onClick={() => setLiveDialogOpen(true)} className="gap-2" title="Fahrzeuge aus dem Live-Bestand in die Seite einblenden">
            <Car className="w-4 h-4" /> Live-Fahrzeuge
          </Button>
          <Button size="sm" onClick={handleExport} className="gap-2">
            <Download className="w-4 h-4" /> HTML herunterladen
          </Button>
        </div>
      </div>

      {viewMode === 'edit' && (
        <div className="px-4 py-2 border-b bg-background/60 backdrop-blur text-xs text-muted-foreground flex items-center gap-2">
          <Sparkles className="w-3.5 h-3.5 text-primary" />
          <span>Klicke direkt in Texte, um sie zu bearbeiten. Bilder werden per Hover ausgetauscht. Zwischen Sections erscheint ein <span className="inline-flex items-center gap-0.5 px-1 py-0.5 rounded bg-muted"><Plus className="w-3 h-3" /></span> zum Einfügen neuer Abschnitte.</span>
        </div>
      )}

      <ContactFormConfigDialog open={contactConfigOpen} onOpenChange={setContactConfigOpen} value={contactFormConfig} onConfirm={setContactFormConfig} />
      <Dialog open={bulkConfirmOpen} onOpenChange={setBulkConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Alle Bilder neu generieren?</DialogTitle>
            <DialogDescription>
              Für den Header und jeden Abschnitt wird ein neues KI-Bild erstellt. Bereits vorhandene Bilder – auch eigene Uploads – werden dabei ersetzt. Texte und übrige Inhalte bleiben unverändert.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBulkConfirmOpen(false)}>Abbrechen</Button>
            <Button onClick={() => { setBulkConfirmOpen(false); handleGenerateAllScenes(); }}>Ja, Bilder generieren</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {contactFormEnabled && viewMode === 'edit' && <ContactFormWidgetPreview config={contactFormConfig} accent={dealer.secondaryColor} />}

      {/* Canvas */}
      <div className="flex-1 overflow-auto p-4 sm:p-6 flex justify-center">
        <div
          className="rounded-2xl border border-border overflow-hidden bg-white shadow-sm transition-all duration-200 w-full"
          style={{ maxWidth: canvasWidth }}
        >
          {viewMode === 'edit' ? (
            <LandingRenderer
              content={content}
              images={images}
              dealer={dealer}
              brand={brand}
              model={model}
              brandLogoUrl={brandLogoUrl}
              editable
              onUpdateHero={updateHero}
              onUpdateSection={updateSection}
              onReplaceImage={(id) => setImageDialogSection(id)}
              onMoveSection={moveSection}
              onToggleSection={toggleSection}
              onDeleteSection={deleteSection}
              onDeleteElement={deleteElement}
              onResizeLogo={(id, height) => setContent(previous => ({ ...previous, logoSizes: { ...previous.logoSizes, [id]: height } }))}
              frameEditing={viewport === 'desktop'}
              onFrameChange={(imageId, frame) => setContent(previous => {
                const next = { ...(previous.imageFrames || {}) };
                if (frame) next[imageId] = frame; else delete next[imageId];
                return { ...previous, imageFrames: next };
              })}
              onAddSection={(afterId) => setAddAfterId(afterId)}
              imageLoading={imageLoading}
              liveInventory={liveInventory.enabled
                ? { config: liveInventory, vehicles: liveVehicles, inventoryUrl: liveUrl, loading: liveLoading, error: liveError }
                : null}
            />
          ) : (
            <iframe
              srcDoc={html}
              className="w-full border-0"
              style={{ minHeight: '85vh' }}
              title="Landing Page Vorschau"
            />
          )}
        </div>
      </div>

      {/* Image Replace Dialog */}
      <Dialog open={!!imageDialogSection} onOpenChange={open => !open && !imageLoading && setImageDialogSection(null)}>
        <DialogContent className={pickFromGallery ? "sm:max-w-2xl" : "sm:max-w-md"}>
          <DialogHeader>
            <DialogTitle>Bild ändern</DialogTitle>
          </DialogHeader>
          {imageLoading ? (
            <div className="flex items-center justify-center gap-2 py-8">
              <Loader2 className="w-5 h-5 animate-spin text-primary" />
              <span className="text-sm text-muted-foreground">Wird verarbeitet…</span>
            </div>
          ) : (
            <div className="space-y-2">
              {pickFromGallery ? (
                <div className="space-y-2">
                  <button onClick={() => setPickFromGallery(false)} className="text-xs text-muted-foreground hover:text-foreground">← Zurück</button>
                  <VehicleImagePicker
                    defaultVehicleId={vehicleId}
                    onPick={(url) => {
                      if (imageDialogSection) replaceImage(imageDialogSection, url, 'ai');
                      setPickFromGallery(false);
                      setImageDialogSection(null);
                      toast.success('Bild übernommen');
                    }}
                  />
                </div>
              ) : (<>
              <button
                onClick={() => setPickFromGallery(true)}
                className="w-full flex items-center gap-3 p-3 rounded-lg border border-border hover:border-primary/50 transition-colors text-left"
              >
                <Images className="w-5 h-5 text-muted-foreground shrink-0" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-foreground">Aus Fahrzeugbildern wählen</p>
                  <p className="text-xs text-muted-foreground">Bereits in autohaus.ai generierte Bilder verwenden</p>
                </div>
              </button>

              <label className="flex items-center gap-3 p-3 rounded-lg border border-border hover:border-primary/50 cursor-pointer transition-colors">
                <Upload className="w-5 h-5 text-muted-foreground shrink-0" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-foreground">Eigene Bilder</p>
                  <p className="text-xs text-muted-foreground">Ein eigenes Bild verwenden</p>
                  <p className="text-xs text-muted-foreground mt-1">{LANDING_UPLOAD_DISCLOSURE_NOTICE}</p>
                </div>
                <input type="file" accept="image/*" className="hidden" onChange={e => {
                  const file = e.target.files?.[0];
                  if (file && imageDialogSection) handleImageUpload(imageDialogSection, file);
                }} />
              </label>

              <button
                onClick={() => imageDialogSection && handleRegenerate(imageDialogSection)}
                className="w-full flex items-center gap-3 p-3 rounded-lg border border-border hover:border-primary/50 transition-colors text-left"
              >
                <Sparkles className="w-5 h-5 text-muted-foreground shrink-0" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-foreground">Neu generieren</p>
                  <p className="text-xs text-muted-foreground">KI erstellt ein neues Bild passend zur Section</p>
                </div>
              </button>

              <label className="flex items-center gap-3 p-3 rounded-lg border border-border hover:border-primary/50 cursor-pointer transition-colors">
                <RefreshCw className="w-5 h-5 text-muted-foreground shrink-0" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-foreground">Foto remastern</p>
                  <p className="text-xs text-muted-foreground">Eigenes Foto in Profi-Qualität umwandeln</p>
                </div>
                <input type="file" accept="image/*" className="hidden" onChange={e => {
                  const file = e.target.files?.[0];
                  if (file && imageDialogSection) handleRemaster(imageDialogSection, file);
                }} />
              </label>
              </>)}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Live-Fahrzeuge Dialog */}
      <Dialog open={liveDialogOpen} onOpenChange={setLiveDialogOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Live-Fahrzeuge</DialogTitle>
          </DialogHeader>
          <LiveVehiclesBlock value={liveInventory} onChange={setLiveInventory} suggestedBrand={brand} />
          <p className="text-xs text-muted-foreground">
            Die Auswahl wird automatisch gespeichert und erscheint auf der Seite direkt vor dem Kontaktbereich.
          </p>
        </DialogContent>
      </Dialog>

      {/* Add-Section Dialog */}
      <Dialog open={addAfterId !== undefined} onOpenChange={open => !open && setAddAfterId(undefined)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Neue Section einfügen</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {SECTION_TYPES.map(t => (
              <button
                key={t.value}
                onClick={() => insertSection(addAfterId ?? null, t.value)}
                className="text-left p-3 rounded-lg border border-border hover:border-primary/50 hover:bg-muted/50 transition-colors"
              >
                <p className="text-sm font-semibold text-foreground">{t.label}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{t.description}</p>
              </button>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export default LandingPageEditor;
