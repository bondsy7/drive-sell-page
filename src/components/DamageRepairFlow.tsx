import React, { useState, useCallback, useRef } from 'react';
import { Upload, X, Loader2, Check, AlertCircle, Wrench, RotateCcw, ZoomIn, ArrowLeft, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Progress } from '@/components/ui/progress';
import { toast } from 'sonner';
import { invokeRemasterVehicleImage } from '@/lib/remaster-invoke';
import { compressImageForAI, fileToBase64 } from '@/lib/image-compress';
import { uploadToGeminiFiles, type GeminiFileRef } from '@/lib/gemini-file-upload';
import ImagePreviewLightbox from '@/components/ImagePreviewLightbox';
import ProcessTimer from '@/components/ProcessTimer';

interface DamageRepairFlowProps {
  onBack: () => void;
  onComplete: (images: string[]) => void;
}

interface UploadedImage {
  id: string;
  originalBase64: string;
  fileRef?: GeminiFileRef | null;
  repairedBase64: string | null;
  status: 'pending' | 'processing' | 'done' | 'error';
  error?: string;
}

const MAX_IMAGES = 10;
const MAX_SIZE_MB = 10;

const DAMAGE_REPAIR_PROMPT = `<TASK>
You are an expert automotive damage repair retoucher. Repair ALL visible damage on the vehicle in the provided photo so it looks factory-new and showroom-ready.
</TASK>

<DAMAGE_REPAIR_MANDATE>
Identify and fully repair every defect:
- Dents, dings, creases, deformations on body panels
- Scratches, scuffs, swirl marks, paint chips, key marks
- Cracks, chips, stars on glass (windshield, windows)
- Cracked, broken, or missing headlight / taillight lenses
- Bent / damaged bumpers, fenders, doors, mirrors, trim
- Curb-rash, scratches, and bends on wheel rims
- Missing or broken badges, emblems, antennae, mirrors, trim pieces
- Rust, oxidation, fading, water spots, dirt, mud, road grime
- Bird droppings, tree sap, tar, brake-dust, salt residue
- Faded plastic trim, faded headlight covers (restore clarity)
- Tire damage (sidewall scuffs) – restore to clean black sidewalls
- Interior damage if visible: torn / worn upholstery, scuffed plastics, cracked dashboard
Restore the panel geometry to factory specification, refinish the paint perfectly, polish all surfaces, and clean every detail. The vehicle must look like it just left the manufacturer.
</DAMAGE_REPAIR_MANDATE>

<IDENTITY_LOCK>
- Reproduce the EXACT same vehicle: same make, model, trim, body shape, paint color and finish (metallic / matte / pearl), wheel design, badges, equipment.
- Do NOT change the camera angle, perspective, framing, composition, focal length, or distance.
- Do NOT change the license plate text or the vehicle's position.
- Same lighting direction. Same time of day.
</IDENTITY_LOCK>

<QUALITY>
- Photorealistic, high resolution, sharp focus, correct reflections and shadows, no plastic / CGI look.
- No watermarks, no text overlays, no borders.
</QUALITY>`;

const SHOWROOM_ADDON = `

<SCENE_RELOCATION>
Place the now-repaired vehicle into a modern, bright, premium car-dealership showroom:
- Polished light grey concrete or epoxy floor with subtle reflections of the car
- Clean, minimal architecture, large floor-to-ceiling windows letting in soft daylight
- Soft overhead LED lighting creating gentle highlights on the paint, hood, roof and shoulder line
- Empty, distraction-free background – no people, no other cars, no logos, no text
- Re-render ALL reflections on paint, glass, mirrors, chrome and rims so they match this NEW showroom environment. PURGE every reflection from the original scene.
- Realistic ground shadow under the vehicle.
</SCENE_RELOCATION>`;

const DamageRepairFlow: React.FC<DamageRepairFlowProps> = ({ onBack, onComplete }) => {
  const [images, setImages] = useState<UploadedImage[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [putInShowroom, setPutInShowroom] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);
  const [regeneratingIds, setRegeneratingIds] = useState<Set<string>>(new Set());

  const handleFiles = useCallback(async (files: FileList | File[]) => {
    const fileArray = Array.from(files);
    const remaining = MAX_IMAGES - images.length;
    if (remaining <= 0) {
      toast.error(`Maximal ${MAX_IMAGES} Bilder.`);
      return;
    }
    const toAdd = fileArray.slice(0, remaining);
    const newImages: UploadedImage[] = [];
    for (const file of toAdd) {
      if (!file.type.startsWith('image/')) continue;
      if (file.size > MAX_SIZE_MB * 1024 * 1024) {
        toast.error(`${file.name} ist zu groß (max ${MAX_SIZE_MB}MB).`);
        continue;
      }
      const raw = await fileToBase64(file);
      const base64 = await compressImageForAI(raw).catch(() => raw);
      newImages.push({
        id: crypto.randomUUID(),
        originalBase64: base64,
        repairedBase64: null,
        status: 'pending',
      });
    }
    setImages(prev => [...prev, ...newImages]);
  }, [images.length]);

  const removeImage = (id: string) =>
    setImages(prev => prev.filter(img => img.id !== id));

  const buildPrompt = () => DAMAGE_REPAIR_PROMPT + (putInShowroom ? SHOWROOM_ADDON : '');

  const repairOne = async (img: UploadedImage) => {
    try {
      const { data, error } = await invokeRemasterVehicleImage({
        imageBase64: img.originalBase64,
        mainImageFileUri: img.fileRef || null,
        vehicleDescription: 'Damaged vehicle to be repaired',
        modelTier: 'qualitaet',
        dynamicPrompt: buildPrompt(),
      });
      if (error || !data?.imageBase64) {
        const msg = data?.error || error?.message || 'Reparatur fehlgeschlagen';
        setImages(prev => prev.map(x => x.id === img.id ? { ...x, status: 'error', error: msg } : x));
      } else {
        setImages(prev => prev.map(x => x.id === img.id ? { ...x, status: 'done', repairedBase64: data.imageBase64 } : x));
      }
    } catch {
      setImages(prev => prev.map(x => x.id === img.id ? { ...x, status: 'error', error: 'Netzwerkfehler' } : x));
    }
  };

  const startRepair = async () => {
    const pending = images.filter(i => i.status === 'pending' || i.status === 'error');
    if (pending.length === 0) return;
    setIsProcessing(true);
    setProgress({ current: 0, total: pending.length });
    setImages(prev => prev.map(x => pending.some(p => p.id === x.id) ? { ...x, status: 'processing' } : x));

    // Upload images that don't yet have a fileRef to Gemini File API (parallel batch)
    const needUpload = pending.filter(p => !p.fileRef);
    if (needUpload.length > 0) {
      const refs = await uploadToGeminiFiles(
        needUpload.map(p => ({ id: p.id, imageBase64: p.originalBase64 })),
      );
      if (refs && refs.length === needUpload.length) {
        setImages(prev => prev.map(x => {
          const idx = needUpload.findIndex(p => p.id === x.id);
          return idx >= 0 ? { ...x, fileRef: refs[idx] } : x;
        }));
        // attach to local pending list too
        for (let i = 0; i < needUpload.length; i++) {
          const p = pending.find(pp => pp.id === needUpload[i].id);
          if (p) p.fileRef = refs[i];
        }
      }
    }

    let done = 0;
    const CONCURRENCY = 3;
    const queue = [...pending];
    const workers = Array.from({ length: Math.min(CONCURRENCY, queue.length) }, async () => {
      while (queue.length > 0) {
        const img = queue.shift()!;
        await repairOne(img);
        done++;
        setProgress({ current: done, total: pending.length });
      }
    });
    await Promise.all(workers);
    setIsProcessing(false);
    toast.success('Reparatur abgeschlossen.');
  };

  const retrySingle = async (id: string) => {
    const img = images.find(x => x.id === id);
    if (!img) return;
    setImages(prev => prev.map(x => x.id === id ? { ...x, status: 'processing', error: undefined } : x));
    setRegeneratingIds(prev => new Set(prev).add(id));
    await repairOne(img);
    setRegeneratingIds(prev => { const n = new Set(prev); n.delete(id); return n; });
  };

  const finishUp = () => {
    const done = images.filter(i => i.status === 'done' && i.repairedBase64).map(i => i.repairedBase64!);
    if (done.length === 0) {
      toast.error('Keine reparierten Bilder.');
      return;
    }
    onComplete(done);
  };

  const doneCount = images.filter(i => i.status === 'done').length;
  const allDone = images.length > 0 && images.every(i => i.status === 'done' || i.status === 'error') && !isProcessing;

  const lightboxImages = images
    .filter(i => i.status === 'done' && i.repairedBase64)
    .map(i => ({ id: i.id, src: i.repairedBase64!, label: 'Repariert', originalSrc: i.originalBase64 }));

  return (
    <div className="w-full max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={onBack} disabled={isProcessing}>
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <div>
          <h2 className="font-display text-2xl font-bold text-foreground">Schadensreparatur</h2>
          <p className="text-sm text-muted-foreground">
            Bilder hochladen – KI repariert Dellen, Kratzer, Steinschläge & mehr.
          </p>
        </div>
      </div>

      {/* Showroom toggle */}
      <div className="flex items-center justify-between p-4 rounded-xl border border-border bg-card">
        <div className="flex items-start gap-3">
          <Sparkles className="w-5 h-5 text-accent mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-foreground">In Showroom stellen</p>
            <p className="text-xs text-muted-foreground">Repariertes Fahrzeug zusätzlich in einen modernen Showroom platzieren.</p>
          </div>
        </div>
        <Switch checked={putInShowroom} onCheckedChange={setPutInShowroom} disabled={isProcessing} />
      </div>

      {/* Drop zone */}
      {images.length < MAX_IMAGES && !isProcessing && (
        <div
          onDrop={(e) => { e.preventDefault(); handleFiles(e.dataTransfer.files); }}
          onDragOver={(e) => e.preventDefault()}
          onClick={() => fileInputRef.current?.click()}
          className="border-2 border-dashed border-border hover:border-accent rounded-2xl p-8 text-center cursor-pointer transition-colors bg-muted/30 hover:bg-muted/50"
        >
          <Upload className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">
            Bilder hierhin ziehen oder <span className="text-accent font-medium">klicken zum Auswählen</span>
          </p>
          <p className="text-xs text-muted-foreground/60 mt-1">Max. {MAX_IMAGES} Bilder, je max. {MAX_SIZE_MB}MB</p>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={(e) => e.target.files && handleFiles(e.target.files)}
          />
        </div>
      )}

      {/* Image grid */}
      {images.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
          {images.map((img) => (
            <div key={img.id} className="relative group rounded-xl overflow-hidden border border-border bg-muted aspect-[4/3]">
              <img
                src={img.repairedBase64 || img.originalBase64}
                alt="Fahrzeug"
                className="w-full h-full object-cover cursor-pointer"
                onClick={() => {
                  if (img.status === 'done') {
                    const idx = lightboxImages.findIndex(l => l.id === img.id);
                    if (idx >= 0) { setLightboxIndex(idx); setLightboxOpen(true); }
                  }
                }}
              />
              {img.status === 'done' && !isProcessing && (
                <button
                  onClick={() => {
                    const idx = lightboxImages.findIndex(l => l.id === img.id);
                    if (idx >= 0) { setLightboxIndex(idx); setLightboxOpen(true); }
                  }}
                  className="absolute top-1.5 left-1.5 w-7 h-7 rounded-full bg-background/80 hover:bg-accent hover:text-accent-foreground flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <ZoomIn className="w-3.5 h-3.5" />
                </button>
              )}
              {img.status === 'processing' && (
                <div className="absolute inset-0 bg-background/70 flex items-center justify-center">
                  <Loader2 className="w-6 h-6 text-accent animate-spin" />
                </div>
              )}
              {img.status === 'error' && (
                <div className="absolute inset-0 bg-destructive/20 flex flex-col items-center justify-center gap-2 px-2">
                  <AlertCircle className="w-5 h-5 text-destructive" />
                  <p className="text-[10px] text-destructive text-center">{img.error}</p>
                  <button
                    onClick={() => retrySingle(img.id)}
                    className="flex items-center gap-1 bg-background/90 hover:bg-background text-foreground text-[10px] font-semibold px-2.5 py-1.5 rounded-lg shadow"
                  >
                    <RotateCcw className="w-3 h-3" /> Erneut
                  </button>
                </div>
              )}
              {img.status === 'done' && !isProcessing && (
                <button
                  onClick={() => retrySingle(img.id)}
                  className="absolute bottom-1.5 right-1.5 w-7 h-7 rounded-full bg-background/80 hover:bg-accent hover:text-accent-foreground flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                  title="Erneut reparieren"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                </button>
              )}
              {!isProcessing && (
                <button
                  onClick={() => removeImage(img.id)}
                  className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full bg-background/80 hover:bg-destructive hover:text-destructive-foreground flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
              {img.status === 'done' && (
                <div className="absolute bottom-1.5 left-1.5 bg-accent text-accent-foreground text-[9px] font-semibold px-1.5 py-0.5 rounded-md">
                  Repariert
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Progress */}
      {isProcessing && (
        <div className="space-y-2">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Reparatur läuft…</span>
            <div className="flex items-center gap-2">
              <ProcessTimer running={isProcessing} label="Gesamt" />
              <span>Bild {progress.current} von {progress.total}</span>
            </div>
          </div>
          <Progress value={(progress.current / progress.total) * 100} className="h-1.5" />
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center justify-between">
        <Button variant="outline" size="sm" onClick={onBack} disabled={isProcessing}>
          Zurück
        </Button>
        <div className="flex items-center gap-3">
          {images.length > 0 && (
            <span className="text-xs text-muted-foreground">
              {images.length} Bild{images.length !== 1 ? 'er' : ''}{doneCount > 0 ? `, ${doneCount} fertig` : ''}
            </span>
          )}
          {!allDone ? (
            <Button
              onClick={startRepair}
              disabled={images.length === 0 || isProcessing}
              className="gap-2 gradient-accent text-accent-foreground font-semibold"
            >
              {isProcessing ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> Repariere…</>
              ) : (
                <><Wrench className="w-4 h-4" /> Schaden reparieren</>
              )}
            </Button>
          ) : (
            <Button
              onClick={finishUp}
              disabled={doneCount === 0}
              className="gap-2 gradient-accent text-accent-foreground font-semibold"
            >
              <Check className="w-4 h-4" /> In Galerie speichern
            </Button>
          )}
        </div>
      </div>

      <ImagePreviewLightbox
        images={lightboxImages}
        initialIndex={lightboxIndex}
        open={lightboxOpen}
        onClose={() => setLightboxOpen(false)}
        onRegenerate={(id) => retrySingle(id)}
        regeneratingIds={regeneratingIds}
      />
    </div>
  );
};

export default DamageRepairFlow;
