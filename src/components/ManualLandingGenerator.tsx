import React, { useState, useMemo } from 'react';
import { ArrowLeft, Sparkles, Loader2, FileText, Target, Palette, Users, MessageSquare, ImageIcon, Upload, X, Euro } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useCredits } from '@/hooks/useCredits';
import { toast } from 'sonner';
import VehicleBrandModelPicker from '@/components/VehicleBrandModelPicker';

const PAGE_TYPES = [
  { value: 'leasing', label: 'Leasing-Angebot', desc: 'Monatliche Rate, Flexibilität', icon: '📋' },
  { value: 'finanzierung', label: 'Finanzierung', desc: 'Ratenkauf mit Konditionen', icon: '💰' },
  { value: 'barkauf', label: 'Barkauf / Neuwagen', desc: 'Direktkauf mit Preisvorteil', icon: '🚗' },
  { value: 'massenangebot', label: 'Massenangebot / Aktion', desc: 'Zeitlich begrenzte Aktion', icon: '🔥' },
  { value: 'autoabo', label: 'Auto-Abo', desc: 'All-inclusive, flexibel', icon: '🔄' },
  { value: 'event', label: 'Event im Autohaus', desc: 'Einladung zu Veranstaltung', icon: '🎉' },
  { value: 'release', label: 'Fahrzeug-Release', desc: 'Premiere & Vorbestellung', icon: '✨' },
];

const TARGET_AUDIENCES = [
  { value: 'privat', label: 'Privatkunden' },
  { value: 'gewerbe', label: 'Gewerbekunden' },
  { value: 'jung', label: 'Junge Fahrer' },
  { value: 'familien', label: 'Familien' },
  { value: 'premium', label: 'Premium / Luxus' },
];

const TONES = [
  { value: 'professionell', label: 'Professionell' },
  { value: 'emotional', label: 'Emotional' },
  { value: 'sportlich', label: 'Sportlich' },
  { value: 'premium', label: 'Premium / Luxus' },
  { value: 'jugendlich', label: 'Jugendlich / Modern' },
];

const IMAGE_STYLES = [
  { value: 'studio', label: 'Studio / Showroom', desc: 'Sauberer weißer Hintergrund' },
  { value: 'outdoor', label: 'Outdoor / Natur', desc: 'Landschaft, Berge, Küste' },
  { value: 'urban', label: 'Urban / Stadt', desc: 'Skyline, Architektur' },
  { value: 'dynamic', label: 'Dynamisch / Fahrt', desc: 'In Bewegung, Speed' },
];

interface ManualLandingGeneratorProps {
  onBack: () => void;
  onComplete: (projectId: string) => void;
}

const ManualLandingGenerator: React.FC<ManualLandingGeneratorProps> = ({ onBack, onComplete }) => {
  const { user } = useAuth();
  const { balance } = useCredits();
  
  // Step 1: Vehicle
  const [brand, setBrand] = useState('');
  const [model, setModel] = useState('');
  const [variant, setVariant] = useState('');
  const [color, setColor] = useState('');
  
  // Step 2: Offer
  const [pageType, setPageType] = useState('');
  const [price, setPrice] = useState('');
  const [targetAudience, setTargetAudience] = useState('');
  
  // Step 3: Style
  const [tone, setTone] = useState('professionell');
  const [imageStyle, setImageStyle] = useState('studio');
  const [highlights, setHighlights] = useState('');
  
  // Image uploads
  const [uploadedImages, setUploadedImages] = useState<{ file: File; preview: string }[]>([]);
  
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState('');

  const canGenerate = brand.trim() && model.trim() && pageType;
  const cost = 3;

  const handleImageAdd = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (uploadedImages.length + files.length > 3) {
      toast.error('Maximal 3 eigene Bilder');
      return;
    }
    const newImages = files.map(file => ({
      file,
      preview: URL.createObjectURL(file),
    }));
    setUploadedImages(prev => [...prev, ...newImages]);
    e.target.value = '';
  };

  const removeImage = (idx: number) => {
    setUploadedImages(prev => {
      URL.revokeObjectURL(prev[idx].preview);
      return prev.filter((_, i) => i !== idx);
    });
  };

  const fileToBase64 = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });

  const handleGenerate = async () => {
    if (!canGenerate || !user) return;

    if (balance < cost) {
      toast.error(`Nicht genügend Credits. Benötigt: ${cost}, Guthaben: ${balance}`);
      return;
    }

    setLoading(true);
    setProgress('Lade Händlerprofil...');

    try {
      const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single();
      const dealer = profile ? {
        name: (profile as any).company_name || '',
        address: (profile as any).address || '',
        postalCode: (profile as any).postal_code || '',
        city: (profile as any).city || '',
        phone: (profile as any).phone || '',
        email: (profile as any).email || '',
        website: (profile as any).website || '',
        logoUrl: (profile as any).logo_url || '',
        whatsappNumber: (profile as any).whatsapp_number || '',
        facebookUrl: (profile as any).facebook_url || '',
        instagramUrl: (profile as any).instagram_url || '',
        youtubeUrl: (profile as any).youtube_url || '',
        tiktokUrl: (profile as any).tiktok_url || '',
        defaultLegalText: (profile as any).default_legal_text || '',
      } : {};

      // Upload user images
      setProgress('Bilder werden vorbereitet...');
      const uploadedBase64: string[] = [];
      for (const img of uploadedImages) {
        const b64 = await fileToBase64(img.file);
        uploadedBase64.push(b64);
      }

      setProgress('KI generiert Inhalte & Bilder...');

      const { data, error } = await supabase.functions.invoke('generate-landing-page', {
        body: {
          brand, model, pageType,
          variant, color, price, targetAudience, tone, imageStyle,
          additionalInfo: highlights,
          dealer,
          uploadedImages: uploadedBase64,
        },
      });

      if (error) {
        toast.error('Fehler bei der Generierung.');
        console.error(error);
        return;
      }

      if (data?.error) {
        if (data.error === 'insufficient_credits') {
          toast.error(`Nicht genügend Credits. Guthaben: ${data.balance}, benötigt: ${data.cost}`);
        } else {
          toast.error(data.error);
        }
        return;
      }

      if (data?.html) {
        const { data: project, error: saveError } = await supabase.from('projects').insert({
          user_id: user.id,
          title: `${brand} ${model}${variant ? ` ${variant}` : ''} – Landing Page`,
          vehicle_data: {
            type: 'landing-page',
            brand, model, variant,
            pageType, targetAudience, tone, imageStyle, color, price,
            pageContent: data.pageContent,
            imageMap: data.imageMap || {},
            dealer,
            brandLogoUrl: data.brandLogoUrl || '',
          } as any,
          template_id: 'landing-page',
          html_content: data.html,
        }).select('id').single();

        if (saveError || !project) {
          console.error('Save project error:', saveError);
          toast.error('Projekt konnte nicht gespeichert werden.');
          return;
        }

        toast.success(`Landing Page erstellt! ${data.imageCount || 0} Bilder generiert.`);
        onComplete(project.id);
      } else {
        toast.error('Keine HTML-Daten erhalten.');
      }
    } catch (e) {
      console.error('Generate error:', e);
      toast.error('Ein Fehler ist aufgetreten.');
    } finally {
      setLoading(false);
      setProgress('');
    }
  };

  const selectedType = useMemo(() => PAGE_TYPES.find(t => t.value === pageType), [pageType]);

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={onBack}>
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <div>
          <h2 className="font-display text-2xl font-bold text-foreground">Landing Page Generator</h2>
          <p className="text-sm text-muted-foreground">KI erstellt eine komplette, SEO-optimierte Angebotsseite</p>
        </div>
      </div>

      {/* Section 1: Vehicle */}
      <div className="rounded-xl border border-border bg-card p-5 space-y-4">
        <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <span className="flex items-center justify-center w-6 h-6 rounded-full bg-accent/10 text-accent text-xs font-bold">1</span>
          Fahrzeug
        </div>

        <VehicleBrandModelPicker
          brand={brand}
          model={model}
          onBrandChange={setBrand}
          onModelChange={setModel}
          compact
        />

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Variante (optional)</label>
            <Input placeholder="z.B. Competition, AMG, GTI..." value={variant} onChange={e => setVariant(e.target.value)} disabled={loading} />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground flex items-center gap-1">
              <Palette className="w-3 h-3" /> Farbe (optional)
            </label>
            <Input placeholder="z.B. Alpinweiß, Schwarz..." value={color} onChange={e => setColor(e.target.value)} disabled={loading} />
          </div>
        </div>
      </div>

      {/* Section 2: Offer */}
      <div className="rounded-xl border border-border bg-card p-5 space-y-4">
        <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <span className="flex items-center justify-center w-6 h-6 rounded-full bg-accent/10 text-accent text-xs font-bold">2</span>
          Angebot
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
            <Target className="w-3.5 h-3.5" /> Seitentyp
          </label>
          <Select value={pageType} onValueChange={setPageType} disabled={loading}>
            <SelectTrigger><SelectValue placeholder="Wofür ist die Seite?" /></SelectTrigger>
            <SelectContent>
              {PAGE_TYPES.map(t => (
                <SelectItem key={t.value} value={t.value}>
                  <span className="flex items-center gap-2">
                    <span>{t.icon}</span>
                    <span>{t.label}</span>
                    <span className="text-muted-foreground text-xs">– {t.desc}</span>
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground flex items-center gap-1">
              <Euro className="w-3 h-3" /> Preis / Rate (optional)
            </label>
            <Input placeholder="z.B. ab 299€/mtl. oder 45.900€" value={price} onChange={e => setPrice(e.target.value)} disabled={loading} />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground flex items-center gap-1">
              <Users className="w-3 h-3" /> Zielgruppe
            </label>
            <Select value={targetAudience} onValueChange={setTargetAudience} disabled={loading}>
              <SelectTrigger><SelectValue placeholder="Alle" /></SelectTrigger>
              <SelectContent>
                {TARGET_AUDIENCES.map(a => (
                  <SelectItem key={a.value} value={a.value}>{a.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {selectedType && (
          <div className="rounded-lg bg-accent/5 border border-accent/20 p-3 flex items-start gap-3">
            <span className="text-2xl">{selectedType.icon}</span>
            <div>
              <p className="text-sm font-semibold text-foreground">{selectedType.label}</p>
              <p className="text-xs text-muted-foreground">{selectedType.desc}</p>
            </div>
          </div>
        )}
      </div>

      {/* Section 3: Style */}
      <div className="rounded-xl border border-border bg-card p-5 space-y-4">
        <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <span className="flex items-center justify-center w-6 h-6 rounded-full bg-accent/10 text-accent text-xs font-bold">3</span>
          Stil & Inhalte
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground flex items-center gap-1">
              <MessageSquare className="w-3 h-3" /> Tonalität
            </label>
            <Select value={tone} onValueChange={setTone} disabled={loading}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {TONES.map(t => (
                  <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground flex items-center gap-1">
              <ImageIcon className="w-3 h-3" /> Bild-Stil
            </label>
            <Select value={imageStyle} onValueChange={setImageStyle} disabled={loading}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {IMAGE_STYLES.map(s => (
                  <SelectItem key={s.value} value={s.value}>
                    <span className="flex items-center gap-1.5">
                      <span>{s.label}</span>
                      <span className="text-muted-foreground text-xs">– {s.desc}</span>
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
            <FileText className="w-3.5 h-3.5" /> Highlights & USPs
            <span className="text-muted-foreground/60">(optional)</span>
          </label>
          <Textarea
            placeholder="z.B. Sonderausstattung, Aktionszeitraum, besondere Vorteile, Alleinstellungsmerkmale..."
            value={highlights} onChange={e => setHighlights(e.target.value)}
            disabled={loading} rows={3}
          />
        </div>

        {/* Image Upload */}
        <div className="space-y-2">
          <label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
            <Upload className="w-3.5 h-3.5" /> Eigene Bilder
            <span className="text-muted-foreground/60">(optional, max. 3)</span>
          </label>
          <div className="flex flex-wrap gap-2">
            {uploadedImages.map((img, idx) => (
              <div key={idx} className="relative w-20 h-20 rounded-lg overflow-hidden border border-border group">
                <img src={img.preview} alt="" className="w-full h-full object-cover" />
                <button
                  onClick={() => removeImage(idx)}
                  className="absolute top-0.5 right-0.5 w-5 h-5 bg-foreground/70 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <X className="w-3 h-3 text-background" />
                </button>
              </div>
            ))}
            {uploadedImages.length < 3 && (
              <label className="w-20 h-20 rounded-lg border-2 border-dashed border-border hover:border-accent/50 flex items-center justify-center cursor-pointer transition-colors">
                <Upload className="w-5 h-5 text-muted-foreground" />
                <input type="file" accept="image/*" className="hidden" onChange={handleImageAdd} disabled={loading} multiple />
              </label>
            )}
          </div>
          <p className="text-[10px] text-muted-foreground">Eigene Bilder werden priorisiert, fehlende werden KI-generiert.</p>
        </div>
      </div>

      {/* Generate Button */}
      <div className="rounded-xl border border-border bg-card p-5 space-y-3">
        <Button onClick={handleGenerate} disabled={!canGenerate || loading} className="w-full h-12 text-base font-semibold">
          {loading ? (
            <><Loader2 className="w-4 h-4 mr-2 animate-spin" />{progress}</>
          ) : (
            <><Sparkles className="w-4 h-4 mr-2" />Landing Page generieren</>
          )}
        </Button>
        <div className="flex items-center justify-center gap-1">
          <span className="text-xs text-muted-foreground">
            Kosten: <strong className="text-accent">{cost} Credits</strong> — Guthaben: <strong className="text-foreground">{balance} Credits</strong>
          </span>
        </div>
      </div>

      {/* Info */}
      <div className="rounded-xl border border-border bg-card/50 p-5">
        <h3 className="text-sm font-semibold text-foreground mb-3">Was wird generiert?</h3>
        <div className="grid grid-cols-2 gap-3">
          {[
            { icon: '📝', text: 'SEO-optimierte Texte' },
            { icon: '🖼️', text: 'KI-generierte Bilder' },
            { icon: '📊', text: 'Strukturierte Daten (JSON-LD)' },
            { icon: '📱', text: 'Responsive Design' },
            { icon: '🏢', text: 'Deine Händlerdaten integriert' },
            { icon: '📞', text: 'Kontaktformular + CTA' },
          ].map(item => (
            <div key={item.text} className="flex items-center gap-2 text-xs text-muted-foreground">
              <span>{item.icon}</span><span>{item.text}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default ManualLandingGenerator;
