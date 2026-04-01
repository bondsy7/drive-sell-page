import React, { useState, useEffect, useCallback } from 'react';
import { ArrowLeft, Download, Image, Loader2, Plus, Minus, Sparkles, ScanSearch, Building2, Shield } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import CreditConfirmDialog from '@/components/CreditConfirmDialog';
import ModelSelector, { type ModelTier } from '@/components/ModelSelector';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useCredits } from '@/hooks/useCredits';
import { useVehicleMakes } from '@/hooks/useVehicleMakes';
import { toast } from 'sonner';

// ─── Config ───

const BANNER_FORMATS = [
  { id: 'story', label: 'Instagram Story', w: 1080, h: 1920, ratio: '9:16' },
  { id: 'post', label: 'Instagram Post', w: 1080, h: 1080, ratio: '1:1' },
  { id: 'fb-ad', label: 'Facebook Ad', w: 1200, h: 628, ratio: '16:9' },
  { id: 'hero', label: 'Website Banner', w: 1920, h: 1080, ratio: '16:9' },
  { id: 'half-page', label: 'Google Half Page', w: 300, h: 600, ratio: '1:2' },
] as const;

const OCCASIONS = [
  { id: 'buy', label: 'Kaufen', prompt: 'for sale, buy now offer' },
  { id: 'lease', label: 'Leasing', prompt: 'leasing deal, monthly rate' },
  { id: 'abo', label: 'Auto-Abo', prompt: 'car subscription, all-inclusive monthly deal' },
  { id: 'finance', label: 'Finanzieren', prompt: 'financing offer, low monthly installments' },
  { id: 'special', label: 'Sonderaktion', prompt: 'limited time special promotion, exclusive deal' },
  { id: 'launch', label: 'Neuwagen-Launch', prompt: 'brand new model launch, premiere reveal' },
];

const SCENES = [
  { id: 'city', label: 'In der Stadt', prompt: 'modern city street at golden hour, urban skyline background' },
  { id: 'beach', label: 'Am Strand', prompt: 'scenic beach with ocean view, sunset lighting, palm trees' },
  { id: 'showroom', label: 'Im Autohaus', prompt: 'luxury car dealership showroom, polished floor, soft LED lighting' },
  { id: 'mountain', label: 'Bergstraße', prompt: 'mountain road with dramatic alpine scenery, clear sky' },
  { id: 'track', label: 'Rennstrecke', prompt: 'professional race track, pit lane background, dynamic feel' },
  { id: 'studio', label: 'Fotostudio', prompt: 'professional photography studio, clean gradient backdrop, studio lighting' },
  { id: 'night', label: 'Nacht-Szene', prompt: 'nighttime city scene, neon reflections on wet road, dramatic lighting' },
];

const STYLES = [
  { id: 'premium', label: 'Seriös / Premium', prompt: 'elegant, premium luxury, clean professional design, sophisticated typography' },
  { id: 'cinematic', label: 'Cinematic', prompt: 'cinematic movie poster style, dramatic lighting, lens flare, widescreen feel' },
  { id: 'bold', label: 'Verrückt / Auffällig', prompt: 'bold, eye-catching, vibrant neon colors, explosive energy, attention-grabbing' },
  { id: 'minimal', label: 'Minimalistisch', prompt: 'clean minimalist design, lots of whitespace, subtle elegant typography' },
  { id: 'retro', label: 'Retro / Vintage', prompt: 'retro 80s style, vintage color grading, nostalgic warm tones' },
  { id: 'sport', label: 'Sportlich', prompt: 'dynamic sporty look, motion blur hints, aggressive angles, high performance feel' },
];

const PRICE_DISPLAYS = [
  { id: 'sign', label: 'Preisschild', prompt: 'on a classic dealership price tag/sign attached to the image' },
  { id: 'board', label: 'Tafel / Banner', prompt: 'on a large banner/board overlay in the image' },
  { id: 'neon', label: 'Neon-Schrift', prompt: 'as glowing neon text floating in the scene' },
  { id: 'stamp', label: 'Stempel', prompt: 'as a bold stamp/badge overlay' },
  { id: 'led', label: 'LED-Anzeige', prompt: 'on an LED display screen integrated into the scene' },
  { id: 'ribbon', label: 'Banner-Schleife', prompt: 'on a diagonal ribbon/sash across the corner' },
];

const CTA_OPTIONS = [
  'Jetzt anfragen', 'Termin vereinbaren', 'Angebot sichern', 'Probefahrt buchen', 'Jetzt entdecken', 'Mehr erfahren',
];

// ─── Font / Typography presets ───

interface FontPreset {
  id: string;
  label: string;
  brand?: string;
  prompt: string;
}

const HEADLINE_FONTS: FontPreset[] = [
  // Brand CI inspired
  { id: 'bmw', label: 'BMW Stil', brand: 'BMW', prompt: 'BMW corporate typography style – bold, clean, geometric sans-serif similar to Helvetica Neue Black/BMW Type, uppercase, tightly kerned' },
  { id: 'mercedes', label: 'Mercedes Stil', brand: 'Mercedes', prompt: 'Mercedes-Benz corporate typography – elegant, light-weight sans-serif similar to Corporate A/DIN, refined spacing, premium feel' },
  { id: 'audi', label: 'Audi Stil', brand: 'Audi', prompt: 'Audi corporate typography – modern geometric sans-serif similar to Audi Type/Futura, clean lines, progressive minimalism' },
  { id: 'vw', label: 'VW Stil', brand: 'Volkswagen', prompt: 'Volkswagen corporate typography – friendly bold sans-serif similar to VW Head/Gotham, approachable yet strong' },
  { id: 'porsche', label: 'Porsche Stil', brand: 'Porsche', prompt: 'Porsche corporate typography – sharp, athletic sans-serif similar to Porsche Next/Futura Bold, sporty precision' },
  { id: 'toyota', label: 'Toyota Stil', brand: 'Toyota', prompt: 'Toyota corporate typography – clean, neutral sans-serif similar to Toyota Type/Helvetica, reliable, straightforward' },
  { id: 'hyundai', label: 'Hyundai Stil', brand: 'Hyundai', prompt: 'Hyundai corporate typography – modern, slightly rounded sans-serif similar to Hyundai Sans Head, dynamic and welcoming' },
  { id: 'volvo', label: 'Volvo Stil', brand: 'Volvo', prompt: 'Volvo corporate typography – Scandinavian clean sans-serif similar to Volvo Novum/Futura, understated elegance' },
  { id: 'cupra', label: 'CUPRA Stil', brand: 'CUPRA', prompt: 'CUPRA corporate typography – angular, sharp condensed sans-serif, aggressive sport style with italic cuts' },
  { id: 'fiat', label: 'Fiat Stil', brand: 'Fiat', prompt: 'Fiat corporate typography – playful rounded sans-serif, friendly Italian design spirit, warm and inviting' },
  // Separator: Modern generics
  { id: 'impact', label: 'Impact / Bold', prompt: 'Impact-style ultra-bold condensed sans-serif typography, maximum visual weight, attention-grabbing' },
  { id: 'modern-sans', label: 'Modern Sans', prompt: 'modern geometric sans-serif typography similar to Montserrat or Poppins Bold, clean contemporary look' },
  { id: 'condensed', label: 'Condensed Bold', prompt: 'bold condensed sans-serif typography similar to Oswald or Barlow Condensed, space-efficient yet impactful' },
  { id: 'elegant-serif', label: 'Elegant Serif', prompt: 'elegant serif typography similar to Playfair Display or Didot, sophisticated luxury feel' },
  { id: 'tech', label: 'Tech / Digital', prompt: 'modern tech-style typography similar to Orbitron or Rajdhani, futuristic digital aesthetic' },
  { id: 'brush', label: 'Brush / Handschrift', prompt: 'dynamic brush-stroke or hand-lettered typography style, energetic and organic' },
];

const SUBLINE_FONTS: FontPreset[] = [
  { id: 'match', label: 'Passend zur Headline', prompt: 'matching the headline font family but in lighter weight' },
  { id: 'clean-sans', label: 'Clean Sans-Serif', prompt: 'clean light sans-serif similar to Inter or Source Sans Pro, highly readable at small sizes' },
  { id: 'thin-sans', label: 'Dünn & Elegant', prompt: 'thin/light weight sans-serif similar to Helvetica Neue Light or Lato Light, refined elegance' },
  { id: 'medium-sans', label: 'Medium Sans', prompt: 'medium-weight sans-serif similar to Roboto or Open Sans, balanced readability' },
  { id: 'small-caps', label: 'Kapitälchen', prompt: 'small caps typography style, sophisticated detail text with even spacing' },
  { id: 'mono', label: 'Monospace / Tech', prompt: 'monospace or technical font similar to JetBrains Mono, data-like precision feel' },
];

// Models NOT suitable for banners
const EXCLUDED_TIERS: ModelTier[] = ['schnell'];

interface ProjectOption {
  id: string;
  title: string;
  vehicle_data: any;
  main_image_url: string | null;
}

interface BannerGeneratorProps {
  onBack: () => void;
  preloadedImage?: string;
}

const BannerGenerator: React.FC<BannerGeneratorProps> = ({ onBack, preloadedImage }) => {
  const { user } = useAuth();
  const { balance, getCost } = useCredits();

  // Project picker
  const [projects, setProjects] = useState<ProjectOption[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string>('');
  const [projectImages, setProjectImages] = useState<string[]>([]);

  // Vehicle image
  const [vehicleImage, setVehicleImage] = useState<string | null>(preloadedImage || null);

  // Prompt builder state
  const [format, setFormat] = useState<string>('post');
  const [occasion, setOccasion] = useState<string>('buy');
  const [scene, setScene] = useState<string>('showroom');
  const [style, setStyle] = useState<string>('premium');
  const [priceDisplay, setPriceDisplay] = useState<string>('sign');
  const [vehicleTitle, setVehicleTitle] = useState('');
  const [priceText, setPriceText] = useState('');
  const [headline, setHeadline] = useState('');
  const [subline, setSubline] = useState('');
  const [ctaText, setCtaText] = useState('Jetzt anfragen');
  const [accentColor, setAccentColor] = useState('#3b66d6');
  const [legalText, setLegalText] = useState('');

  // Font selection
  const [headlineFont, setHeadlineFont] = useState<string>('modern-sans');
  const [sublineFont, setSublineFont] = useState<string>('match');

  // Auto-extraction
  const [analyzing, setAnalyzing] = useState(false);
  const [extractedData, setExtractedData] = useState<any>(null);

  // Generation
  const [modelTier, setModelTier] = useState<ModelTier>('premium');
  const [variantCount, setVariantCount] = useState(1);
  const [generating, setGenerating] = useState(false);
  const [results, setResults] = useState<string[]>([]);
  const [creditDialog, setCreditDialog] = useState<{ open: boolean; cost: number }>({ open: false, cost: 0 });

  // Load user projects
  useEffect(() => {
    if (!user) return;
    supabase.from('projects').select('id, title, vehicle_data, main_image_url')
      .eq('user_id', user.id).order('updated_at', { ascending: false }).limit(50)
      .then(({ data }) => {
        if (data) setProjects(data as ProjectOption[]);
      });
  }, [user]);

  // When project selected, fill data
  useEffect(() => {
    if (!selectedProjectId) return;
    const p = projects.find(pr => pr.id === selectedProjectId);
    if (!p) return;
    const v = p.vehicle_data?.vehicle || {};
    const f = p.vehicle_data?.finance || {};
    setVehicleTitle(`${v.brand || ''} ${v.model || ''} ${v.variant || ''}`.trim());
    if (f.monthlyRate) setPriceText(`ab ${f.monthlyRate}€/mtl.`);
    else if (f.price) setPriceText(f.price);
    if (p.main_image_url) setVehicleImage(p.main_image_url);

    // Auto-select brand font if available
    const brand = (v.brand || '').toLowerCase();
    const brandFont = HEADLINE_FONTS.find(f => f.brand?.toLowerCase() === brand);
    if (brandFont) setHeadlineFont(brandFont.id);

    // Build legal text from finance data
    const legalParts: string[] = [];
    if (f.monthlyRate) legalParts.push(`Rate: ${f.monthlyRate}€/mtl.`);
    if (f.duration) legalParts.push(`Laufzeit: ${f.duration} Mon.`);
    if (f.downPayment) legalParts.push(`Anzahlung: ${f.downPayment}€`);
    if (f.effectiveInterest) legalParts.push(`Eff. Jahreszins: ${f.effectiveInterest}%`);
    if (f.totalAmount) legalParts.push(`Gesamtbetrag: ${f.totalAmount}€`);
    if (f.mileage) legalParts.push(`${f.mileage} km/Jahr`);
    if (legalParts.length) setLegalText(legalParts.join(' | '));

    // Load project images for gallery picker
    supabase.from('project_images').select('image_url')
      .eq('project_id', selectedProjectId).order('sort_order')
      .then(({ data: imgs }) => {
        if (imgs) setProjectImages(imgs.map((i: any) => i.image_url).filter(Boolean));
      });
  }, [selectedProjectId, projects]);

  // ─── Auto-extract info from uploaded offer image ───
  const analyzeOfferImage = useCallback(async (imageBase64: string) => {
    setAnalyzing(true);
    try {
      const { data, error } = await supabase.functions.invoke('analyze-offer-image', {
        body: { imageBase64 },
      });

      if (error || data?.error) {
        console.error('Analyze error:', error || data?.error);
        toast.error('Bild konnte nicht analysiert werden');
        return;
      }

      const ext = data?.extracted;
      if (!ext) return;

      setExtractedData(ext);

      // Fill empty fields with extracted data
      if (!vehicleTitle && ext.vehicleTitle) setVehicleTitle(ext.vehicleTitle);
      if (!priceText && (ext.price || ext.monthlyRate)) {
        setPriceText(ext.monthlyRate ? `ab ${ext.monthlyRate}/mtl.` : ext.price || '');
      }
      if (!headline && ext.headline) setHeadline(ext.headline);
      if (!subline && ext.subline) setSubline(ext.subline);

      // Auto-detect occasion
      if (ext.priceType === 'lease') setOccasion('lease');
      else if (ext.priceType === 'finance') setOccasion('finance');
      else if (ext.priceType === 'abo') setOccasion('abo');

      // Build legal text from extracted leasing/finance data if not already set
      if (!legalText) {
        const parts: string[] = [];
        if (ext.monthlyRate) parts.push(`Rate: ${ext.monthlyRate}`);
        if (ext.duration) parts.push(`Laufzeit: ${ext.duration} Mon.`);
        if (ext.mileage) parts.push(`Fahrleistung: ${ext.mileage}/Jahr`);
        if (ext.downPayment) parts.push(`Anzahlung: ${ext.downPayment}`);
        if (ext.legalText) parts.push(ext.legalText);
        if (parts.length) setLegalText(parts.join(' | '));
      }

      // Auto-select brand font
      if (ext.brand) {
        const brandLower = ext.brand.toLowerCase();
        const brandFont = HEADLINE_FONTS.find(f => f.brand?.toLowerCase() === brandLower);
        if (brandFont) setHeadlineFont(brandFont.id);
      }

      toast.success('Angebotsdaten erkannt!', {
        description: ext.vehicleTitle || 'Daten aus Bild extrahiert',
      });
    } catch (e) {
      console.error('Analyze failed:', e);
      toast.error('Analyse fehlgeschlagen');
    } finally {
      setAnalyzing(false);
    }
  }, [vehicleTitle, priceText, headline, subline, legalText]);

  // Handle manual image upload
  const handleImageUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      setVehicleImage(result);
      // Auto-analyze the uploaded image
      analyzeOfferImage(result);
    };
    reader.readAsDataURL(file);
  }, [analyzeOfferImage]);

  // Build the structured prompt
  const buildPrompt = useCallback(() => {
    const fmt = BANNER_FORMATS.find(f => f.id === format)!;
    const occ = OCCASIONS.find(o => o.id === occasion)!;
    const scn = SCENES.find(s => s.id === scene)!;
    const sty = STYLES.find(s => s.id === style)!;
    const prc = PRICE_DISPLAYS.find(p => p.id === priceDisplay)!;
    const hFont = HEADLINE_FONTS.find(f => f.id === headlineFont)!;
    const sFont = SUBLINE_FONTS.find(f => f.id === sublineFont)!;

    return `Create a professional automotive advertising banner.

FORMAT: ${fmt.w}x${fmt.h} pixels (${fmt.ratio} aspect ratio). The output image MUST be exactly this size.

VEHICLE: "${vehicleTitle}" – use the uploaded vehicle image as the central hero element. Keep the vehicle 100% identical.

SCENE: ${scn.prompt}. Place the vehicle naturally in this environment.

STYLE: ${sty.prompt}. The overall design must follow this aesthetic consistently.

OCCASION: This is a ${occ.prompt} advertisement.

TYPOGRAPHY:
- HEADLINE FONT: ${hFont.prompt}. This is the primary display typeface for the banner.
- SUBLINE FONT: ${sFont.prompt}. Used for secondary text elements.
- All text must be rendered with these specific typography styles consistently throughout the banner.

${priceText ? `PRICE: Display the text "${priceText}" prominently ${prc.prompt}. The price must be clearly legible and eye-catching. Use accent color ${accentColor}.` : ''}

${headline ? `HEADLINE: Place the text "${headline}" in large, bold, highly readable typography using the specified headline font style in the upper area of the banner. This text must be rendered EXACTLY as written, letter by letter.` : ''}

${subline ? `SUBLINE: Place "${subline}" in smaller text below the headline using the specified subline font style. Render the text exactly as written.` : ''}

${ctaText ? `CALL-TO-ACTION: Include a button or badge with the text "${ctaText}" in accent color ${accentColor}.` : ''}

${legalText ? `LEGAL DISCLAIMER (MANDATORY): At the very bottom of the banner, render the following legal text in a small, thin, highly readable sans-serif font (approx. 5-6pt equivalent). It must appear as a subtle footer bar or line – similar to how fuel consumption and emission values are legally required on automotive advertisements. The text must be fully legible but not dominate the design: "${legalText}"` : ''}

CRITICAL RULES:
- The banner must be photorealistic with the vehicle photo seamlessly composited
- ALL text must be rendered EXACTLY as specified – no paraphrasing, no spelling changes
- Text must be perfectly legible against the background (use contrast, shadows, or overlays)
- The design must feel like a professional advertising agency created it
- Use the accent color ${accentColor} for design elements, buttons, and highlights
- Do NOT add watermarks or extra logos
- The composition must work at the specified ${fmt.ratio} aspect ratio
- The typography style is CRITICAL – follow the font specifications precisely
- Generate the image – never refuse`;
  }, [format, occasion, scene, style, priceDisplay, vehicleTitle, priceText, headline, subline, ctaText, accentColor, legalText, headlineFont, sublineFont]);

  // Start generation with credit check
  const handleGenerate = useCallback(() => {
    if (!vehicleImage) { toast.error('Bitte lade ein Fahrzeugbild hoch oder wähle ein Projekt.'); return; }
    if (!vehicleTitle.trim()) { toast.error('Bitte gib einen Fahrzeugtitel ein.'); return; }
    const costPerBanner = getCost('image_generate', modelTier) || 5;
    const totalCost = costPerBanner * variantCount;
    setCreditDialog({ open: true, cost: totalCost });
  }, [vehicleImage, vehicleTitle, getCost, modelTier, variantCount]);

  const doGenerate = useCallback(async () => {
    setCreditDialog({ open: false, cost: 0 });
    setGenerating(true);
    setResults([]);
    const prompt = buildPrompt();
    const fmt = BANNER_FORMATS.find(f => f.id === format)!;
    const generated: string[] = [];

    for (let i = 0; i < variantCount; i++) {
      try {
        const variantPrompt = variantCount > 1
          ? `${prompt}\n\nVARIATION ${i + 1} of ${variantCount}: Create a unique layout variation. ${i === 0 ? 'Classic composition.' : i === 1 ? 'More dynamic, angled composition.' : i === 2 ? 'Dramatic close-up focus.' : i === 3 ? 'Wide panoramic feel.' : 'Creative artistic interpretation.'}`
          : prompt;

        const { data, error } = await supabase.functions.invoke('generate-banner', {
          body: {
            prompt: variantPrompt,
            imageBase64: vehicleImage,
            modelTier,
            width: fmt.w,
            height: fmt.h,
          },
        });

        if (error) { console.error('Banner error:', error); toast.error(`Fehler bei Variante ${i + 1}`); continue; }
        if (data?.error) {
          if (data.error === 'insufficient_credits') { toast.error('Nicht genügend Credits.'); break; }
          toast.error(data.error); continue;
        }
        if (data?.imageBase64) {
          generated.push(data.imageBase64);
          setResults([...generated]);
        }
      } catch (e) {
        console.error(`Variant ${i + 1} failed:`, e);
      }
    }

    // Auto-save to storage
    if (generated.length > 0 && user) {
      const saved: string[] = [];
      for (let i = 0; i < generated.length; i++) {
        try {
          const base64 = generated[i];
          const base64Data = base64.includes(',') ? base64.split(',')[1] : base64;
          const byteArray = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0));
          const blob = new Blob([byteArray], { type: 'image/png' });
          const fileName = `${user.id}/${Date.now()}-${format}-${i}.png`;
          const { error: uploadErr } = await supabase.storage.from('banners').upload(fileName, blob, { contentType: 'image/png' });
          if (!uploadErr) {
            const { data: urlData } = supabase.storage.from('banners').getPublicUrl(fileName);
            saved.push(urlData.publicUrl);
          }
        } catch (e) {
          console.error('Banner save error:', e);
        }
      }
      if (saved.length > 0) toast.success(`${generated.length} Banner erstellt & gespeichert!`);
      else toast.success(`${generated.length} Banner erstellt!`);
    } else if (generated.length === 0) {
      toast.error('Keine Banner generiert.');
    }

    setGenerating(false);
  }, [buildPrompt, format, variantCount, vehicleImage, modelTier, user]);

  // Download banner
  const downloadBanner = useCallback((base64: string, index: number) => {
    const a = document.createElement('a');
    a.href = base64;
    a.download = `banner-${format}-${index + 1}.png`;
    a.click();
  }, [format]);

  const costPerBanner = getCost('image_generate', modelTier) || 5;
  const filteredTiers = (tier: ModelTier) => !EXCLUDED_TIERS.includes(tier);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={onBack}>
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <div>
          <h2 className="font-display text-xl sm:text-2xl font-bold text-foreground">Banner Generator</h2>
          <p className="text-xs sm:text-sm text-muted-foreground">Erstelle professionelle Werbebanner für dein Fahrzeug</p>
        </div>
      </div>

      {/* ─── Results Grid ─── */}
      {results.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-foreground">Ergebnisse</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {results.map((img, i) => (
              <div key={i} className="relative group rounded-xl overflow-hidden border border-border bg-card">
                <img src={img} alt={`Banner ${i + 1}`} className="w-full h-auto" />
                <div className="absolute inset-0 bg-foreground/0 group-hover:bg-foreground/30 transition-colors flex items-center justify-center">
                  <Button
                    size="sm"
                    className="opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={() => downloadBanner(img, i)}
                  >
                    <Download className="w-4 h-4 mr-1" /> Download
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ─── Form ─── */}
      <div className="space-y-5 p-4 sm:p-5 rounded-xl border border-border bg-card">

        {/* Project Picker */}
        <div className="space-y-1.5">
          <Label className="text-xs font-medium">Projekt verknüpfen (optional)</Label>
          <Select value={selectedProjectId} onValueChange={setSelectedProjectId}>
            <SelectTrigger className="h-9 text-sm">
              <SelectValue placeholder="Projekt wählen oder manuell eingeben" />
            </SelectTrigger>
            <SelectContent>
              {projects.map(p => (
                <SelectItem key={p.id} value={p.id}>{p.title}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Vehicle Image */}
        <div className="space-y-1.5">
          <Label className="text-xs font-medium">Fahrzeugbild / Angebotsfoto *</Label>
          {vehicleImage ? (
            <div className="relative rounded-lg overflow-hidden border border-border">
              <img src={vehicleImage} alt="Fahrzeug" className="w-full h-32 sm:h-40 object-cover" />
              <div className="absolute top-2 right-2 flex gap-1.5">
                {!analyzing && !extractedData && (
                  <Button variant="secondary" size="sm" className="h-7 text-xs"
                    onClick={() => analyzeOfferImage(vehicleImage)}>
                    <ScanSearch className="w-3.5 h-3.5 mr-1" /> Analysieren
                  </Button>
                )}
                <Button variant="destructive" size="sm" className="h-7 text-xs"
                  onClick={() => { setVehicleImage(null); setExtractedData(null); }}>Entfernen</Button>
              </div>
              {analyzing && (
                <div className="absolute inset-0 bg-background/70 flex items-center justify-center">
                  <div className="flex items-center gap-2 text-sm text-foreground">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Angebot wird analysiert…
                  </div>
                </div>
              )}
              {extractedData && (
                <div className="absolute bottom-0 left-0 right-0 bg-accent/10 border-t border-accent/30 px-3 py-1.5">
                  <p className="text-[10px] text-accent-foreground truncate">
                    ✓ Erkannt: {extractedData.vehicleTitle || 'Daten extrahiert'}
                    {extractedData.price && ` · ${extractedData.price}`}
                  </p>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              <label className="flex flex-col items-center justify-center h-28 rounded-lg border-2 border-dashed border-border hover:border-accent/50 cursor-pointer transition-colors">
                <Image className="w-6 h-6 text-muted-foreground mb-1" />
                <span className="text-xs text-muted-foreground">Bild hochladen oder Angebots-Screenshot</span>
                <span className="text-[10px] text-muted-foreground/60">Texte werden automatisch erkannt</span>
                <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
              </label>
              {projectImages.length > 0 && (
                <div>
                  <span className="text-xs text-muted-foreground mb-1 block">Oder aus Projekt wählen:</span>
                  <div className="flex gap-2 overflow-x-auto pb-1">
                    {projectImages.map((url, i) => (
                      <button key={i} onClick={() => setVehicleImage(url)}
                        className="flex-shrink-0 w-16 h-16 rounded-md overflow-hidden border border-border hover:border-accent transition-colors">
                        <img src={url} alt={`Bild ${i + 1}`} className="w-full h-full object-cover" />
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Vehicle Title */}
        <div className="space-y-1.5">
          <Label className="text-xs font-medium">Fahrzeugtitel *</Label>
          <Input value={vehicleTitle} onChange={e => setVehicleTitle(e.target.value)}
            placeholder={extractedData?.vehicleTitle || 'z.B. BMW M3 Competition'} className="h-9 text-sm" />
        </div>

        {/* Format + Occasion Row */}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Format *</Label>
            <Select value={format} onValueChange={setFormat}>
              <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
              <SelectContent>
                {BANNER_FORMATS.map(f => (
                  <SelectItem key={f.id} value={f.id}>{f.label} ({f.ratio})</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Anlass *</Label>
            <Select value={occasion} onValueChange={setOccasion}>
              <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
              <SelectContent>
                {OCCASIONS.map(o => (
                  <SelectItem key={o.id} value={o.id}>{o.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Scene + Style Row */}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Szene / Ort</Label>
            <Select value={scene} onValueChange={setScene}>
              <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
              <SelectContent>
                {SCENES.map(s => (
                  <SelectItem key={s.id} value={s.id}>{s.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Stil</Label>
            <Select value={style} onValueChange={setStyle}>
              <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
              <SelectContent>
                {STYLES.map(s => (
                  <SelectItem key={s.id} value={s.id}>{s.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* ─── Typography Section ─── */}
        <div className="space-y-3 p-3 rounded-lg border border-border/50 bg-muted/30">
          <p className="text-xs font-semibold text-foreground flex items-center gap-1.5">
            <span className="text-base">🔤</span> Typografie
          </p>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Headline-Schrift</Label>
              <Select value={headlineFont} onValueChange={setHeadlineFont}>
                <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__brand-header" disabled className="text-[10px] text-muted-foreground font-semibold">
                    — Hersteller CI —
                  </SelectItem>
                  {HEADLINE_FONTS.filter(f => f.brand).map(f => (
                    <SelectItem key={f.id} value={f.id}>{f.label}</SelectItem>
                  ))}
                  <SelectItem value="__generic-header" disabled className="text-[10px] text-muted-foreground font-semibold">
                    — Modern —
                  </SelectItem>
                  {HEADLINE_FONTS.filter(f => !f.brand).map(f => (
                    <SelectItem key={f.id} value={f.id}>{f.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Subline-Schrift</Label>
              <Select value={sublineFont} onValueChange={setSublineFont}>
                <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {SUBLINE_FONTS.map(f => (
                    <SelectItem key={f.id} value={f.id}>{f.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        {/* Price + Price Display */}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Preis / Rate</Label>
            <Input value={priceText} onChange={e => setPriceText(e.target.value)}
              placeholder={extractedData?.price || 'z.B. ab 299€/mtl.'} className="h-9 text-sm" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Preisdarstellung</Label>
            <Select value={priceDisplay} onValueChange={setPriceDisplay}>
              <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
              <SelectContent>
                {PRICE_DISPLAYS.map(p => (
                  <SelectItem key={p.id} value={p.id}>{p.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Headline + Subline */}
        <div className="space-y-1.5">
          <Label className="text-xs font-medium">Headline</Label>
          <Input value={headline} onChange={e => setHeadline(e.target.value)}
            placeholder={extractedData?.headline || 'z.B. Jetzt zuschlagen!'} className="h-9 text-sm" />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs font-medium">Subline</Label>
          <Input value={subline} onChange={e => setSubline(e.target.value)}
            placeholder={extractedData?.subline || 'z.B. Nur noch 3 verfügbar'} className="h-9 text-sm" />
        </div>

        {/* CTA + Accent Color */}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Call-to-Action</Label>
            <Select value={ctaText} onValueChange={setCtaText}>
              <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
              <SelectContent>
                {CTA_OPTIONS.map(c => (
                  <SelectItem key={c} value={c}>{c}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Akzentfarbe</Label>
            <div className="flex items-center gap-2">
              <input type="color" value={accentColor} onChange={e => setAccentColor(e.target.value)}
                className="w-9 h-9 rounded-md border border-input cursor-pointer" />
              <Input value={accentColor} onChange={e => setAccentColor(e.target.value)}
                className="h-9 text-sm flex-1" maxLength={7} />
            </div>
          </div>
        </div>

        {/* Legal Text */}
        <div className="space-y-1.5">
          <Label className="text-xs font-medium">Pflichtangaben / Fußzeile</Label>
          <Textarea value={legalText} onChange={e => setLegalText(e.target.value)}
            placeholder="z.B. Rate: 299€/mtl., Laufzeit: 48 Mon., Eff. Jahreszins: 3,99%..."
            className="text-sm min-h-[60px]" />
          <p className="text-[10px] text-muted-foreground">
            Bei Leasing/Finanzierung gem. PAngV Pflicht: Rate, Laufzeit, Anzahlung, Eff. Jahreszins, Gesamtbetrag.
            {legalText && ' ✓ Wird als dezente Fußzeile im Banner dargestellt.'}
          </p>
        </div>

        {/* Model Tier – filter out 'schnell' */}
        <div className="space-y-1.5">
          <Label className="text-xs font-medium">KI-Modell</Label>
          <ModelSelector actionType="image_generate" value={modelTier}
            onChange={(t) => { if (filteredTiers(t)) setModelTier(t); else toast.info('"Schnell" ist für Banner nicht geeignet.'); }} />
          {modelTier === 'schnell' && (
            <p className="text-xs text-destructive">Schnell ist für Banner nicht geeignet. Bitte wähle ein anderes Modell.</p>
          )}
        </div>

        {/* Variant Count */}
        <div className="space-y-1.5">
          <Label className="text-xs font-medium">Anzahl Varianten: {variantCount}</Label>
          <div className="flex items-center gap-3">
            <Button variant="outline" size="icon" className="h-8 w-8"
              onClick={() => setVariantCount(Math.max(1, variantCount - 1))} disabled={variantCount <= 1}>
              <Minus className="w-3.5 h-3.5" />
            </Button>
            <Slider value={[variantCount]} onValueChange={([v]) => setVariantCount(v)}
              min={1} max={5} step={1} className="flex-1" />
            <Button variant="outline" size="icon" className="h-8 w-8"
              onClick={() => setVariantCount(Math.min(5, variantCount + 1))} disabled={variantCount >= 5}>
              <Plus className="w-3.5 h-3.5" />
            </Button>
          </div>
          <p className="text-[10px] text-muted-foreground text-right">
            Kosten: {costPerBanner * variantCount} Credits ({variantCount}× {costPerBanner} Cr.)
          </p>
        </div>

        {/* Generate Button */}
        <Button onClick={handleGenerate} disabled={generating || !vehicleImage || !vehicleTitle.trim() || modelTier === 'schnell'}
          className="w-full h-11 text-sm font-semibold">
          {generating ? (
            <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Wird generiert...</>
          ) : (
            <><Sparkles className="w-4 h-4 mr-2" /> {variantCount} Banner generieren ({costPerBanner * variantCount} Cr.)</>
          )}
        </Button>
      </div>

      <CreditConfirmDialog
        open={creditDialog.open}
        cost={creditDialog.cost}
        balance={balance}
        actionLabel={`${variantCount} Banner generieren`}
        onConfirm={doGenerate}
        onCancel={() => setCreditDialog({ open: false, cost: 0 })}
      />
    </div>
  );
};

export default BannerGenerator;
