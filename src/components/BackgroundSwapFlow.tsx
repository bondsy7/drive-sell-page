import React, { useState, useCallback, useRef, useMemo } from 'react';
import {
  Upload, X, Loader2, Check, ArrowLeft, Scissors, Download, ImageIcon,
  Palette, Sparkles, Layers, RotateCcw, ZoomIn,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Progress } from '@/components/ui/progress';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { fileToBase64, compressImageForAI } from '@/lib/image-compress';
import ImagePreviewLightbox from '@/components/ImagePreviewLightbox';
import AiDisclosureBadge from '@/components/AiDisclosureBadge';
import {
  BACKGROUND_TEMPLATES, SUBJECT_TYPES, SOLID_COLORS, MAX_IMAGES, MAX_SIZE_MB,
  COST_PER_IMAGE, COST_PER_IMAGE_AI_BG, templateToDataUrl,
  type BackgroundMode, type RemoveBgSubjectType,
} from '@/config/remove-bg';

interface BackgroundSwapFlowProps {
  onBack: () => void;
  onComplete: (images: string[]) => void;
}

interface SwapImage {
  id: string;
  originalBase64: string;
  resultBase64: string | null;
  status: 'pending' | 'processing' | 'done' | 'error';
  error?: string;
}

const MODE_OPTIONS: { value: BackgroundMode; label: string; icon: React.ReactNode; hint: string }[] = [
  { value: 'template', label: 'Vorlage', icon: <Layers className="w-4 h-4" />, hint: 'Fertige Szene wählen' },
  { value: 'upload', label: 'Eigenes Bild', icon: <ImageIcon className="w-4 h-4" />, hint: 'Eigener Hintergrund' },
  { value: 'color', label: 'Farbe', icon: <Palette className="w-4 h-4" />, hint: 'Einfarbige Fläche' },
  { value: 'transparent', label: 'Transparent', icon: <Scissors className="w-4 h-4" />, hint: 'Freigestelltes PNG' },
  { value: 'ai', label: 'KI-Hintergrund', icon: <Sparkles className="w-4 h-4" />, hint: 'Szene per Prompt' },
];

const BackgroundSwapFlow: React.FC<BackgroundSwapFlowProps> = ({ onBack, onComplete }) => {
  const [images, setImages] = useState<SwapImage[]>([]);
  const [mode, setMode] = useState<BackgroundMode>('template');
  const [templateId, setTemplateId] = useState(BACKGROUND_TEMPLATES[0].id);
  const [customBg, setCustomBg] = useState<string | null>(null);
  const [bgColor, setBgColor] = useState('#ffffff');
  const [aiPrompt, setAiPrompt] = useState('Moderner heller Premium-Showroom mit poliertem Betonboden');
  const [subjectType, setSubjectType] = useState<RemoveBgSubjectType>('car');
  const [addShadow, setAddShadow] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const bgInputRef = useRef<HTMLInputElement>(null);

  const costPerImage = mode === 'ai' ? COST_PER_IMAGE_AI_BG : COST_PER_IMAGE;
  const doneImages = useMemo(
    () => images.filter((i) => i.status === 'done' && i.resultBase64).map((i) => i.resultBase64!),
    [images],
  );

  const handleFiles = useCallback(async (files: FileList | File[]) => {
    const remaining = MAX_IMAGES - images.length;
    if (remaining <= 0) {
      toast.error(`Maximal ${MAX_IMAGES} Bilder.`);
      return;
    }
    const toAdd: SwapImage[] = [];
    for (const file of Array.from(files).slice(0, remaining)) {
      if (!file.type.startsWith('image/')) continue;
      if (file.size > MAX_SIZE_MB * 1024 * 1024) {
        toast.error(`${file.name} ist zu groß (max ${MAX_SIZE_MB} MB).`);
        continue;
      }
      const raw = await fileToBase64(file);
      const base64 = await compressImageForAI(raw).catch(() => raw);
      toAdd.push({ id: crypto.randomUUID(), originalBase64: base64, resultBase64: null, status: 'pending' });
    }
    if (toAdd.length) setImages((prev) => [...prev, ...toAdd]);
  }, [images.length]);

  const handleBgFile = useCallback(async (file?: File | null) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) return;
    const raw = await fileToBase64(file);
    setCustomBg(raw);
    setMode('upload');
  }, []);

  const removeImage = (id: string) => setImages((prev) => prev.filter((i) => i.id !== id));

  const resolveBackground = async (): Promise<string | undefined> => {
    if (mode === 'template') {
      const tpl = BACKGROUND_TEMPLATES.find((t) => t.id === templateId) || BACKGROUND_TEMPLATES[0];
      return await templateToDataUrl(tpl.url);
    }
    if (mode === 'upload') {
      if (!customBg) throw new Error('Bitte ein Hintergrundbild hochladen.');
      return customBg;
    }
    return undefined;
  };

  const swapOne = async (img: SwapImage, bgImage?: string) => {
    try {
      const { data, error } = await supabase.functions.invoke('remove-background', {
        body: {
          image: img.originalBase64,
          mode,
          bgImage,
          bgColor: mode === 'color' ? bgColor : undefined,
          aiPrompt: mode === 'ai' ? aiPrompt : undefined,
          type: subjectType,
          addShadow,
          size: 'auto',
        },
      });
      const errMsg = (data as any)?.error || error?.message;
      if (errMsg || !(data as any)?.image) {
        const msg = errMsg === 'insufficient_credits' ? 'Nicht genügend Credits' : (errMsg || 'Verarbeitung fehlgeschlagen');
        setImages((prev) => prev.map((x) => (x.id === img.id ? { ...x, status: 'error', error: msg } : x)));
        return;
      }
      setImages((prev) => prev.map((x) => (x.id === img.id ? { ...x, status: 'done', resultBase64: (data as any).image } : x)));
    } catch {
      setImages((prev) => prev.map((x) => (x.id === img.id ? { ...x, status: 'error', error: 'Netzwerkfehler' } : x)));
    }
  };

  const start = async () => {
    const pending = images.filter((i) => i.status === 'pending' || i.status === 'error');
    if (pending.length === 0) return;
    setIsProcessing(true);
    setProgress({ current: 0, total: pending.length });

    let bgImage: string | undefined;
    try {
      bgImage = await resolveBackground();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Hintergrund konnte nicht geladen werden');
      setIsProcessing(false);
      return;
    }

    setImages((prev) => prev.map((x) => (pending.some((p) => p.id === x.id) ? { ...x, status: 'processing', error: undefined } : x)));

    for (let i = 0; i < pending.length; i++) {
      await swapOne(pending[i], bgImage);
      setProgress({ current: i + 1, total: pending.length });
    }

    setIsProcessing(false);
    toast.success('Hintergrund-Bearbeitung abgeschlossen.');
  };

  const download = (src: string, index: number) => {
    const a = document.createElement('a');
    a.href = src;
    a.download = `hintergrund-${index + 1}.${src.startsWith('data:image/png') ? 'png' : 'jpg'}`;
    a.click();
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={onBack}>
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <div>
          <h2 className="font-display text-2xl font-bold text-foreground">Hintergrund tauschen</h2>
          <p className="text-sm text-muted-foreground">
            Fahrzeug bleibt pixelgenau das Original – nur der Hintergrund wird ersetzt.
          </p>
        </div>
      </div>

      {/* Upload */}
      <div>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => e.target.files && handleFiles(e.target.files)}
        />
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="w-full p-6 rounded-xl border-2 border-dashed border-border hover:border-accent/60 transition-colors flex flex-col items-center gap-2 text-muted-foreground"
        >
          <Upload className="w-6 h-6" />
          <span className="text-sm font-medium text-foreground">Fahrzeugfotos hochladen</span>
          <span className="text-xs">bis {MAX_IMAGES} Bilder, max. {MAX_SIZE_MB} MB pro Bild</span>
        </button>
      </div>

      {/* Thumbnails */}
      {images.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {images.map((img, idx) => (
            <div key={img.id} className="relative rounded-lg overflow-hidden border border-border bg-card">
              <img
                src={img.resultBase64 || img.originalBase64}
                alt={`Bild ${idx + 1}`}
                loading="lazy"
                className="w-full aspect-[4/3] object-cover bg-[linear-gradient(45deg,#eee_25%,transparent_25%,transparent_75%,#eee_75%),linear-gradient(45deg,#eee_25%,transparent_25%,transparent_75%,#eee_75%)] bg-[length:16px_16px] bg-[position:0_0,8px_8px]"
              />
              {img.status === 'done' && mode === 'ai' && <AiDisclosureBadge context="banner" overlay />}
              <div className="absolute top-1.5 right-1.5 flex gap-1">
                {img.status === 'done' && (
                  <>
                    <button
                      className="p-1.5 rounded-full bg-black/60 text-white"
                      onClick={() => { setLightboxIndex(idx); setLightboxOpen(true); }}
                      aria-label="Vorschau"
                    >
                      <ZoomIn className="w-3.5 h-3.5" />
                    </button>
                    <button
                      className="p-1.5 rounded-full bg-black/60 text-white"
                      onClick={() => download(img.resultBase64!, idx)}
                      aria-label="Herunterladen"
                    >
                      <Download className="w-3.5 h-3.5" />
                    </button>
                  </>
                )}
                {!isProcessing && (
                  <button
                    className="p-1.5 rounded-full bg-black/60 text-white"
                    onClick={() => removeImage(img.id)}
                    aria-label="Entfernen"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
              <div className="px-2 py-1.5 text-[11px] flex items-center gap-1.5">
                {img.status === 'processing' && <><Loader2 className="w-3 h-3 animate-spin" /> Wird bearbeitet…</>}
                {img.status === 'done' && <><Check className="w-3 h-3 text-accent" /> Fertig</>}
                {img.status === 'error' && <span className="text-destructive">{img.error}</span>}
                {img.status === 'pending' && <span className="text-muted-foreground">Bereit</span>}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Background chooser */}
      <div className="rounded-xl border border-border bg-card p-4 space-y-4">
        <div className="flex flex-wrap gap-2">
          {MODE_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setMode(opt.value)}
              className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg border text-xs font-medium transition-colors ${
                mode === opt.value
                  ? 'border-accent bg-accent/10 text-accent'
                  : 'border-border text-muted-foreground hover:border-accent/50'
              }`}
            >
              {opt.icon}
              {opt.label}
            </button>
          ))}
        </div>

        {mode === 'template' && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {BACKGROUND_TEMPLATES.map((tpl) => (
              <button
                key={tpl.id}
                onClick={() => setTemplateId(tpl.id)}
                className={`text-left rounded-lg overflow-hidden border-2 transition-colors ${
                  templateId === tpl.id ? 'border-accent' : 'border-transparent hover:border-border'
                }`}
              >
                <img src={tpl.url} alt={tpl.label} loading="lazy" className="w-full aspect-[16/9] object-cover" />
                <div className="p-2">
                  <div className="text-xs font-semibold text-foreground">{tpl.label}</div>
                  <div className="text-[10px] text-muted-foreground leading-tight">{tpl.description}</div>
                </div>
              </button>
            ))}
          </div>
        )}

        {mode === 'upload' && (
          <div className="space-y-2">
            <input
              ref={bgInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={(e) => handleBgFile(e.target.files?.[0])}
            />
            {customBg ? (
              <div className="flex items-center gap-3">
                <img src={customBg} alt="Hintergrund" className="w-24 aspect-[16/9] object-cover rounded" />
                <Button size="sm" variant="outline" onClick={() => bgInputRef.current?.click()}>Ersetzen</Button>
                <Button size="sm" variant="ghost" onClick={() => setCustomBg(null)}>Entfernen</Button>
              </div>
            ) : (
              <Button variant="outline" size="sm" onClick={() => bgInputRef.current?.click()}>
                <Upload className="w-4 h-4 mr-2" /> Hintergrundbild wählen
              </Button>
            )}
          </div>
        )}

        {mode === 'color' && (
          <div className="flex flex-wrap items-center gap-2">
            {SOLID_COLORS.map((c) => (
              <button
                key={c.value}
                onClick={() => setBgColor(c.value)}
                title={c.label}
                className={`w-8 h-8 rounded-full border-2 ${bgColor === c.value ? 'border-accent' : 'border-border'}`}
                style={{ backgroundColor: c.value }}
              />
            ))}
            <Input
              type="text"
              value={bgColor}
              onChange={(e) => setBgColor(e.target.value)}
              className="w-28 h-9 text-xs"
              placeholder="#ffffff"
            />
          </div>
        )}

        {mode === 'transparent' && (
          <p className="text-xs text-muted-foreground">
            Ausgabe als PNG mit transparentem Hintergrund – ideal für Banner, Anzeigen und Weiterverarbeitung.
          </p>
        )}

        {mode === 'ai' && (
          <div className="space-y-2">
            <Label className="text-xs">Szene beschreiben</Label>
            <Textarea
              value={aiPrompt}
              onChange={(e) => setAiPrompt(e.target.value)}
              rows={3}
              className="text-sm"
              placeholder="z. B. leerer Betonhof bei Abenddämmerung, warmes Licht"
            />
            <p className="text-[11px] text-muted-foreground">
              Der Hintergrund wird per KI erzeugt und sichtbar als KI-Inhalt gekennzeichnet.
            </p>
          </div>
        )}

        <div className="grid sm:grid-cols-2 gap-4 pt-2 border-t border-border">
          <div className="space-y-1.5">
            <Label className="text-xs">Motivtyp</Label>
            <div className="flex flex-wrap gap-1.5">
              {SUBJECT_TYPES.map((t) => (
                <button
                  key={t.value}
                  onClick={() => setSubjectType(t.value)}
                  className={`px-2.5 py-1.5 rounded-md border text-[11px] ${
                    subjectType === t.value ? 'border-accent bg-accent/10 text-accent' : 'border-border text-muted-foreground'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>
          <div className="flex items-center justify-between gap-3">
            <div>
              <Label className="text-xs">Schlagschatten</Label>
              <p className="text-[11px] text-muted-foreground">Realistischer Bodenschatten unter dem Fahrzeug</p>
            </div>
            <Switch checked={addShadow} onCheckedChange={setAddShadow} />
          </div>
        </div>
      </div>

      {/* Action */}
      {isProcessing && (
        <div className="space-y-2">
          <Progress value={progress.total ? (progress.current / progress.total) * 100 : 0} />
          <p className="text-xs text-muted-foreground text-center">
            {progress.current} von {progress.total} Bildern bearbeitet
          </p>
        </div>
      )}

      <div className="flex flex-col sm:flex-row gap-3">
        <Button
          onClick={start}
          disabled={isProcessing || images.length === 0 || (mode === 'upload' && !customBg)}
          className="flex-1"
        >
          {isProcessing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Scissors className="w-4 h-4 mr-2" />}
          Hintergrund tauschen ({costPerImage} Credit{costPerImage > 1 ? 's' : ''} pro Bild)
        </Button>
        {doneImages.length > 0 && (
          <>
            <Button variant="outline" onClick={() => setImages((prev) => prev.map((i) => ({ ...i, status: 'pending', resultBase64: null })))}>
              <RotateCcw className="w-4 h-4 mr-2" /> Neu anwenden
            </Button>
            <Button variant="secondary" onClick={() => onComplete(doneImages)}>
              <Check className="w-4 h-4 mr-2" /> In Galerie speichern
            </Button>
          </>
        )}
      </div>

      <ImagePreviewLightbox
        images={images.filter((i) => i.resultBase64).map((i) => ({ id: i.id, src: i.resultBase64!, originalSrc: i.originalBase64 }))}
        initialIndex={lightboxIndex}
        open={lightboxOpen}
        onClose={() => setLightboxOpen(false)}
      />
    </div>
  );
};

export default BackgroundSwapFlow;
