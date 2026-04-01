import React, { useState, useEffect, useCallback } from 'react';
import { ArrowLeft, Download, Image, Loader2, Plus, Minus, Sparkles, ScanSearch, Building2, Shield, X, ChevronLeft, ChevronRight, Copy } from 'lucide-react';
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
import { Badge } from '@/components/ui/badge';

// ─── Config ───

const BANNER_FORMATS = [
  { id: 'story', label: 'Instagram Story', w: 1080, h: 1920, ratio: '9:16' },
  { id: 'post', label: 'Instagram Post', w: 1080, h: 1080, ratio: '1:1' },
  { id: 'fb-ad', label: 'Facebook Ad', w: 1200, h: 628, ratio: '16:9' },
  { id: 'hero', label: 'Website Banner', w: 1920, h: 1080, ratio: '16:9' },
  { id: 'half-page', label: 'Google Half Page', w: 300, h: 600, ratio: '1:2' },
  { id: 'billboard', label: 'Google Ads Billboard', w: 970, h: 250, ratio: '97:25' },
  { id: 'wide-skyscraper', label: 'Google Ads Wide Skyscraper', w: 160, h: 600, ratio: '4:15' },
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

const EXCLUDED_TIERS: ModelTier[] = ['schnell'];

interface ProjectOption {
  id: string;
  title: string;
  vehicle_data: any;
  main_image_url: string | null;
}

interface BannerResult {
  formatId: string;
  formatLabel: string;
  ratio: string;
  image: string;
  w: number;
  h: number;
}

interface BannerGeneratorProps {
  onBack: () => void;
  preloadedImage?: string;
}

const BannerGenerator: React.FC<BannerGeneratorProps> = ({ onBack, preloadedImage }) => {
  const { user } = useAuth();
  const { balance, getCost } = useCredits();
  const { makes, getLogoForMake } = useVehicleMakes();

  // Project picker
  const [projects, setProjects] = useState<ProjectOption[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string>('');
  const [projectImages, setProjectImages] = useState<string[]>([]);

  // Vehicle image
  const [vehicleImage, setVehicleImage] = useState<string | null>(preloadedImage || null);

  // Logo selection
  const [showLogo, setShowLogo] = useState(false);
  const [logoSource, setLogoSource] = useState<'dealer' | 'manufacturer'>('dealer');
  const [dealerLogoUrl, setDealerLogoUrl] = useState<string | null>(null);
  const [selectedLogoBrand, setSelectedLogoBrand] = useState('');
  const [logoBase64, setLogoBase64] = useState<string | null>(null);

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
  const [freePrompt, setFreePrompt] = useState('');
  const [legalText, setLegalText] = useState('');

  // Font selection
  const [headlineFont, setHeadlineFont] = useState<string>('modern-sans');
  const [sublineFont, setSublineFont] = useState<string>('match');

  // Auto-extraction
  const [autoAnalyze, setAutoAnalyze] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [extractedData, setExtractedData] = useState<any>(null);

  // Generation
  const [modelTier, setModelTier] = useState<ModelTier>('premium');
  const [variantCount, setVariantCount] = useState(1);
  const [generating, setGenerating] = useState(false);
  const [generatingAll, setGeneratingAll] = useState(false);
  const [results, setResults] = useState<BannerResult[]>([]);
  const [formatProgress, setFormatProgress] = useState<Record<string, 'pending' | 'generating' | 'done' | 'error'>>({});
  const [creditDialog, setCreditDialog] = useState<{ open: boolean; cost: number; mode: 'single' | 'all' }>({ open: false, cost: 0, mode: 'single' });

  // Lightbox
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  // Load user projects
  useEffect(() => {
    if (!user) return;
    supabase.from('projects').select('id, title, vehicle_data, main_image_url')
      .eq('user_id', user.id).order('updated_at', { ascending: false }).limit(50)
      .then(({ data }) => {
        if (data) setProjects(data as ProjectOption[]);
      });
  }, [user]);

  // Load dealer logo from profile
  useEffect(() => {
    if (!user) return;
    supabase.from('profiles').select('logo_url').eq('id', user.id).single()
      .then(({ data }) => {
        if (data?.logo_url) setDealerLogoUrl(data.logo_url);
      });
  }, [user]);

  // Resolve manufacturer logo when brand changes
  useEffect(() => {
    if (!showLogo || logoSource !== 'manufacturer' || !selectedLogoBrand) {
      if (logoSource === 'manufacturer') setLogoBase64(null);
      return;
    }
    const logoUrl = getLogoForMake(selectedLogoBrand);
    if (logoUrl) {
      fetch(logoUrl).then(r => r.blob()).then(blob => {
        const reader = new FileReader();
        reader.onload = () => setLogoBase64(reader.result as string);
        reader.readAsDataURL(blob);
      }).catch(() => setLogoBase64(null));
    } else {
      setLogoBase64(null);
    }
  }, [showLogo, logoSource, selectedLogoBrand, getLogoForMake]);

  // Resolve dealer logo to base64
  useEffect(() => {
    if (!showLogo || logoSource !== 'dealer' || !dealerLogoUrl) {
      if (logoSource === 'dealer') setLogoBase64(null);
      return;
    }
    fetch(dealerLogoUrl).then(r => r.blob()).then(blob => {
      const reader = new FileReader();
      reader.onload = () => setLogoBase64(reader.result as string);
      reader.readAsDataURL(blob);
    }).catch(() => setLogoBase64(null));
  }, [showLogo, logoSource, dealerLogoUrl]);

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

    const brand = (v.brand || '').toLowerCase();
    const brandFont = HEADLINE_FONTS.find(f => f.brand?.toLowerCase() === brand);
    if (brandFont) setHeadlineFont(brandFont.id);

    const legalParts: string[] = [];
    if (f.monthlyRate) legalParts.push(`Rate: ${f.monthlyRate}€/mtl.`);
    if (f.duration) legalParts.push(`Laufzeit: ${f.duration} Mon.`);
    if (f.downPayment) legalParts.push(`Anzahlung: ${f.downPayment}€`);
    if (f.effectiveInterest) legalParts.push(`Eff. Jahreszins: ${f.effectiveInterest}%`);
    if (f.totalAmount) legalParts.push(`Gesamtbetrag: ${f.totalAmount}€`);
    if (f.mileage) legalParts.push(`${f.mileage} km/Jahr`);
    if (legalParts.length) setLegalText(legalParts.join(' | '));

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
      if (error || data?.error) { toast.error('Bild konnte nicht analysiert werden'); return; }
      const ext = data?.extracted;
      if (!ext) return;
      setExtractedData(ext);
      if (!vehicleTitle && ext.vehicleTitle) setVehicleTitle(ext.vehicleTitle);
      if (!priceText && (ext.price || ext.monthlyRate)) {
        setPriceText(ext.monthlyRate ? `ab ${ext.monthlyRate}/mtl.` : ext.price || '');
      }
      if (!headline && ext.headline) setHeadline(ext.headline);
      if (!subline && ext.subline) setSubline(ext.subline);
      if (ext.priceType === 'lease') setOccasion('lease');
      else if (ext.priceType === 'finance') setOccasion('finance');
      else if (ext.priceType === 'abo') setOccasion('abo');
      if (!legalText) {
        const parts: string[] = [];
        if (ext.monthlyRate) parts.push(`Rate: ${ext.monthlyRate}`);
        if (ext.duration) parts.push(`Laufzeit: ${ext.duration} Mon.`);
        if (ext.mileage) parts.push(`Fahrleistung: ${ext.mileage}/Jahr`);
        if (ext.downPayment) parts.push(`Anzahlung: ${ext.downPayment}`);
        if (ext.legalText) parts.push(ext.legalText);
        if (parts.length) setLegalText(parts.join(' | '));
      }
      if (ext.brand) {
        const brandLower = ext.brand.toLowerCase();
        const brandFont = HEADLINE_FONTS.find(f => f.brand?.toLowerCase() === brandLower);
        if (brandFont) setHeadlineFont(brandFont.id);
      }
      toast.success('Angebotsdaten erkannt!', { description: ext.vehicleTitle || 'Daten aus Bild extrahiert' });
    } catch { toast.error('Analyse fehlgeschlagen'); }
    finally { setAnalyzing(false); }
  }, [vehicleTitle, priceText, headline, subline, legalText]);

  const handleImageUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      setVehicleImage(result);
      if (autoAnalyze) analyzeOfferImage(result);
    };
    reader.readAsDataURL(file);
  }, [analyzeOfferImage, autoAnalyze]);

  // Build prompt for a specific format
  const buildPromptForFormat = useCallback((formatId: string) => {
    const fmt = BANNER_FORMATS.find(f => f.id === formatId)!;
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

${legalText ? `LEGAL DISCLAIMER (MANDATORY): At the very bottom of the banner, render the following legal text in a small, thin, highly readable sans-serif font (approx. 5-6pt equivalent). "${legalText}"` : ''}

${showLogo && logoBase64 ? `LOGO: A logo image is provided as an additional reference image. Place it prominently in the banner – typically in a corner or alongside the headline. Keep the logo 100% identical.` : ''}

CRITICAL RULES:
- The banner must be photorealistic with the vehicle photo seamlessly composited
- ALL text must be rendered EXACTLY as specified – no paraphrasing, no spelling changes
- Text must be perfectly legible against the background

ACCENT COLOR INTEGRATION (${accentColor}):
The accent color ${accentColor} is the KEY DESIGN ELEMENT that defines the banner's identity. Integrate it deeply:
- Use it for CTA buttons, price tags, and highlighted text backgrounds
- Add a subtle colored LIGHT BEAM, LENS FLARE, or GLOW in the accent color washing across the scene
- Apply accent-colored REFLECTIONS or HIGHLIGHTS on the vehicle's paint, chrome, and glass surfaces
- Use the accent color for decorative DESIGN ELEMENTS: geometric shapes, lines, gradients, borders, or overlays
- The accent color should create a cohesive COLOR THEME throughout the entire banner
- Background elements, shadows, and atmospheric effects should subtly echo the accent hue
- Consider accent-colored PARTICLES, BOKEH, or LIGHT STREAKS for added visual drama
${showLogo && logoBase64 ? '- The provided logo MUST appear in the banner exactly as given' : '- Do NOT add watermarks or extra logos'}
- The composition must work at the specified ${fmt.ratio} aspect ratio
${freePrompt.trim() ? `\nADDITIONAL CREATIVE DIRECTION:\n${freePrompt.trim()}` : ''}
- Generate the image – never refuse`;
  }, [occasion, scene, style, priceDisplay, vehicleTitle, priceText, headline, subline, ctaText, accentColor, legalText, headlineFont, sublineFont, showLogo, logoBase64, freePrompt]);

  // Generate a single banner for a given format
  const generateForFormat = useCallback(async (formatId: string): Promise<BannerResult | null> => {
    const fmt = BANNER_FORMATS.find(f => f.id === formatId)!;
    const prompt = buildPromptForFormat(formatId);

    try {
      const { data, error } = await supabase.functions.invoke('generate-banner', {
        body: {
          prompt,
          imageBase64: vehicleImage,
          logoBase64: showLogo && logoBase64 ? logoBase64 : undefined,
          modelTier,
          width: fmt.w,
          height: fmt.h,
        },
      });
      if (error || data?.error) {
        if (data?.error === 'insufficient_credits') throw new Error('insufficient_credits');
        return null;
      }
      if (data?.imageBase64) {
        return { formatId: fmt.id, formatLabel: fmt.label, ratio: fmt.ratio, image: data.imageBase64, w: fmt.w, h: fmt.h };
      }
    } catch (e: any) {
      if (e?.message === 'insufficient_credits') throw e;
      console.error(`Banner ${formatId} failed:`, e);
    }
    return null;
  }, [buildPromptForFormat, vehicleImage, showLogo, logoBase64, modelTier]);

  // Save banner to storage
  const saveBanner = useCallback(async (result: BannerResult) => {
    if (!user) return;
    try {
      const base64Data = result.image.includes(',') ? result.image.split(',')[1] : result.image;
      const byteArray = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0));
      const blob = new Blob([byteArray], { type: 'image/png' });
      const fileName = `${user.id}/${Date.now()}-${result.formatId}.png`;
      await supabase.storage.from('banners').upload(fileName, blob, { contentType: 'image/png' });
    } catch (e) { console.error('Banner save error:', e); }
  }, [user]);

  // ── Single format generation ──
  const handleGenerate = useCallback(() => {
    if (!vehicleImage) { toast.error('Bitte lade ein Fahrzeugbild hoch.'); return; }
    if (!vehicleTitle.trim()) { toast.error('Bitte gib einen Fahrzeugtitel ein.'); return; }
    const costPerBanner = getCost('image_generate', modelTier) || 5;
    const totalCost = costPerBanner * variantCount;
    setCreditDialog({ open: true, cost: totalCost, mode: 'single' });
  }, [vehicleImage, vehicleTitle, getCost, modelTier, variantCount]);

  const doGenerateSingle = useCallback(async () => {
    setCreditDialog({ open: false, cost: 0, mode: 'single' });
    setGenerating(true);

    const newResults: BannerResult[] = [];
    for (let i = 0; i < variantCount; i++) {
      try {
        const result = await generateForFormat(format);
        if (result) {
          const labeled = { ...result, formatLabel: `${result.formatLabel}${variantCount > 1 ? ` #${i + 1}` : ''}` };
          newResults.push(labeled);
          setResults(prev => [...prev, labeled]);
          await saveBanner(labeled);
        }
      } catch (e: any) {
        if (e?.message === 'insufficient_credits') { toast.error('Nicht genügend Credits.'); break; }
      }
    }

    if (newResults.length > 0) toast.success(`${newResults.length} Banner erstellt!`);
    else toast.error('Keine Banner generiert.');
    setGenerating(false);
  }, [format, variantCount, generateForFormat, saveBanner]);

  // ── All formats generation (parallel) ──
  const handleGenerateAll = useCallback(() => {
    if (!vehicleImage) { toast.error('Bitte lade ein Fahrzeugbild hoch.'); return; }
    if (!vehicleTitle.trim()) { toast.error('Bitte gib einen Fahrzeugtitel ein.'); return; }
    const costPerBanner = getCost('image_generate', modelTier) || 5;
    const totalCost = costPerBanner * BANNER_FORMATS.length;
    setCreditDialog({ open: true, cost: totalCost, mode: 'all' });
  }, [vehicleImage, vehicleTitle, getCost, modelTier]);

  const doGenerateAll = useCallback(async () => {
    setCreditDialog({ open: false, cost: 0, mode: 'single' });
    setGeneratingAll(true);

    // Initialize progress
    const progress: Record<string, 'pending' | 'generating' | 'done' | 'error'> = {};
    BANNER_FORMATS.forEach(f => { progress[f.id] = 'pending'; });
    setFormatProgress({ ...progress });

    // Run in parallel with concurrency limit of 4
    const queue = [...BANNER_FORMATS];
    const CONCURRENCY = 4;
    let aborted = false;

    const runNext = async (): Promise<void> => {
      while (queue.length > 0 && !aborted) {
        const fmt = queue.shift()!;
        setFormatProgress(prev => ({ ...prev, [fmt.id]: 'generating' }));
        try {
          const result = await generateForFormat(fmt.id);
          if (result) {
            setResults(prev => [...prev, result]);
            setFormatProgress(prev => ({ ...prev, [fmt.id]: 'done' }));
            await saveBanner(result);
          } else {
            setFormatProgress(prev => ({ ...prev, [fmt.id]: 'error' }));
          }
        } catch (e: any) {
          if (e?.message === 'insufficient_credits') { toast.error('Nicht genügend Credits.'); aborted = true; return; }
          setFormatProgress(prev => ({ ...prev, [fmt.id]: 'error' }));
        }
      }
    };

    const workers = Array.from({ length: Math.min(CONCURRENCY, queue.length) }, () => runNext());
    await Promise.all(workers);

    const doneCount = Object.values(formatProgress).filter(s => s === 'done').length;
    if (!aborted) toast.success(`${BANNER_FORMATS.length} Formate verarbeitet!`);
    setGeneratingAll(false);
  }, [generateForFormat, saveBanner]);

  // Download banner
  const downloadBanner = useCallback((result: BannerResult) => {
    const a = document.createElement('a');
    a.href = result.image;
    a.download = `banner-${result.formatId}-${result.w}x${result.h}.png`;
    a.click();
  }, []);

  const costPerBanner = getCost('image_generate', modelTier) || 5;
  const filteredTiers = (tier: ModelTier) => !EXCLUDED_TIERS.includes(tier);
  const isGenerating = generating || generatingAll;

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
          <div className="flex items-center justify-between p-2.5 rounded-lg border border-border/50 bg-muted/30">
            <div className="flex items-center gap-2">
              <ScanSearch className="w-3.5 h-3.5 text-muted-foreground" />
              <span className="text-xs text-foreground">Bild automatisch analysieren</span>
            </div>
            <Switch checked={autoAnalyze} onCheckedChange={setAutoAnalyze} />
          </div>
          <p className="text-[10px] text-muted-foreground">
            {autoAnalyze ? '✓ Beim Hochladen werden Fahrzeugdaten automatisch extrahiert.' : 'Deaktiviert – Felder müssen manuell ausgefüllt werden.'}
          </p>

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
                    <Loader2 className="w-4 h-4 animate-spin" /> Angebot wird analysiert…
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

        {/* Logo Section */}
        <div className="space-y-3 p-3 rounded-lg border border-border/50 bg-muted/30">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Shield className="w-3.5 h-3.5 text-muted-foreground" />
              <span className="text-xs font-semibold text-foreground">Logo einblenden</span>
            </div>
            <Switch checked={showLogo} onCheckedChange={setShowLogo} />
          </div>
          {showLogo && (
            <div className="space-y-3">
              <RadioGroup value={logoSource} onValueChange={(v) => setLogoSource(v as 'dealer' | 'manufacturer')} className="gap-2">
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="dealer" id="logo-dealer" />
                  <Label htmlFor="logo-dealer" className="text-xs cursor-pointer flex items-center gap-1.5">
                    <Building2 className="w-3.5 h-3.5" /> Eigenes Logo (aus Profil)
                  </Label>
                </div>
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="manufacturer" id="logo-manufacturer" />
                  <Label htmlFor="logo-manufacturer" className="text-xs cursor-pointer">🏭 Hersteller-Logo</Label>
                </div>
              </RadioGroup>
              {logoSource === 'dealer' && (
                dealerLogoUrl ? (
                  <div className="flex items-center gap-2 bg-accent/10 rounded-lg px-3 py-2">
                    <img src={dealerLogoUrl} alt="Dealer Logo" className="w-8 h-8 object-contain" />
                    <span className="text-[11px] text-accent-foreground font-medium">Eigenes Logo wird verwendet</span>
                  </div>
                ) : (
                  <p className="text-[10px] text-muted-foreground">Kein Logo im Profil hinterlegt.</p>
                )
              )}
              {logoSource === 'manufacturer' && (
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">Hersteller wählen</Label>
                  <Select value={selectedLogoBrand} onValueChange={setSelectedLogoBrand}>
                    <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Marke auswählen" /></SelectTrigger>
                    <SelectContent>
                      {makes.map(m => (<SelectItem key={m.key} value={m.key}>{m.key}</SelectItem>))}
                    </SelectContent>
                  </Select>
                  {selectedLogoBrand && logoBase64 && (
                    <div className="flex items-center gap-2 bg-accent/10 rounded-lg px-3 py-2">
                      <img src={logoBase64} alt={selectedLogoBrand} className="w-8 h-8 object-contain" />
                      <span className="text-[11px] text-accent-foreground font-medium">Logo für „{selectedLogoBrand}"</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

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
                {OCCASIONS.map(o => (<SelectItem key={o.id} value={o.id}>{o.label}</SelectItem>))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Szene / Ort</Label>
            <Select value={scene} onValueChange={setScene}>
              <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
              <SelectContent>
                {SCENES.map(s => (<SelectItem key={s.id} value={s.id}>{s.label}</SelectItem>))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Stil</Label>
            <Select value={style} onValueChange={setStyle}>
              <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
              <SelectContent>
                {STYLES.map(s => (<SelectItem key={s.id} value={s.id}>{s.label}</SelectItem>))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Typography */}
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
                  <SelectItem value="__brand-header" disabled className="text-[10px] text-muted-foreground font-semibold">— Hersteller CI —</SelectItem>
                  {HEADLINE_FONTS.filter(f => f.brand).map(f => (
                    <SelectItem key={f.id} value={f.id}>{f.label}</SelectItem>
                  ))}
                  <SelectItem value="__generic-header" disabled className="text-[10px] text-muted-foreground font-semibold">— Modern —</SelectItem>
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
                  {SUBLINE_FONTS.map(f => (<SelectItem key={f.id} value={f.id}>{f.label}</SelectItem>))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        {/* Price + Display */}
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
                {PRICE_DISPLAYS.map(p => (<SelectItem key={p.id} value={p.id}>{p.label}</SelectItem>))}
              </SelectContent>
            </Select>
          </div>
        </div>

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

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Call-to-Action</Label>
            <Select value={ctaText} onValueChange={setCtaText}>
              <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
              <SelectContent>
                {CTA_OPTIONS.map(c => (<SelectItem key={c} value={c}>{c}</SelectItem>))}
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

        <div className="space-y-1.5">
          <Label className="text-xs font-medium">Pflichtangaben / Fußzeile</Label>
          <Textarea value={legalText} onChange={e => setLegalText(e.target.value)}
            placeholder="z.B. Rate: 299€/mtl., Laufzeit: 48 Mon., Eff. Jahreszins: 3,99%..."
            className="text-sm min-h-[60px]" />
        </div>

        {/* Free Prompting */}
        <div className="space-y-1.5">
          <Label className="text-xs font-medium flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-accent" /> Freies Prompting (optional)
          </Label>
          <Textarea value={freePrompt} onChange={e => setFreePrompt(e.target.value)}
            placeholder="z.B. Füge Rauch-Effekte hinzu, mache den Hintergrund dunkler, zeige das Auto in Bewegung, füge Funken hinzu..."
            className="text-sm min-h-[60px]" />
          <p className="text-[10px] text-muted-foreground">
            Eigene kreative Anweisungen, die das Banner-Design zusätzlich beeinflussen.
          </p>
        </div>

        {/* Model Tier */}
        <div className="space-y-1.5">
          <Label className="text-xs font-medium">KI-Modell</Label>
          <ModelSelector actionType="image_generate" value={modelTier}
            onChange={(t) => { if (filteredTiers(t)) setModelTier(t); else toast.info('"Schnell" ist für Banner nicht geeignet.'); }} />
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

        {/* Generate Buttons */}
        <div className="space-y-2">
          <Button onClick={handleGenerate} disabled={isGenerating || !vehicleImage || !vehicleTitle.trim() || modelTier === 'schnell'}
            className="w-full h-11 text-sm font-semibold">
            {generating ? (
              <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Wird generiert...</>
            ) : (
              <><Sparkles className="w-4 h-4 mr-2" /> {variantCount} Banner generieren ({costPerBanner * variantCount} Cr.)</>
            )}
          </Button>

          <Button variant="outline" onClick={handleGenerateAll}
            disabled={isGenerating || !vehicleImage || !vehicleTitle.trim() || modelTier === 'schnell'}
            className="w-full h-10 text-sm font-medium">
            {generatingAll ? (
              <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Alle Formate werden generiert...</>
            ) : (
              <><Copy className="w-4 h-4 mr-2" /> Alle {BANNER_FORMATS.length} Formate generieren ({costPerBanner * BANNER_FORMATS.length} Cr.)</>
            )}
          </Button>
        </div>

        {/* All-formats progress */}
        {generatingAll && Object.keys(formatProgress).length > 0 && (
          <div className="space-y-1.5 p-3 rounded-lg border border-border/50 bg-muted/30">
            <p className="text-xs font-semibold text-foreground mb-2">Fortschritt</p>
            <div className="grid grid-cols-2 gap-1.5">
              {BANNER_FORMATS.map(f => {
                const status = formatProgress[f.id];
                return (
                  <div key={f.id} className="flex items-center gap-2 text-xs">
                    {status === 'generating' && <Loader2 className="w-3 h-3 animate-spin text-accent" />}
                    {status === 'done' && <span className="text-green-500">✓</span>}
                    {status === 'error' && <span className="text-destructive">✗</span>}
                    {status === 'pending' && <span className="text-muted-foreground">○</span>}
                    <span className={status === 'done' ? 'text-foreground' : 'text-muted-foreground'}>{f.label}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* ─── Results Grid (BELOW the form) ─── */}
      {results.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-foreground">Ergebnisse ({results.length})</h3>
            <Button variant="ghost" size="sm" className="text-xs h-7" onClick={() => setResults([])}>
              Alle entfernen
            </Button>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {results.map((result, i) => (
              <div key={i} className="relative group rounded-xl overflow-hidden border border-border bg-card cursor-pointer"
                onClick={() => setLightboxIndex(i)}>
                <div className="aspect-video flex items-center justify-center bg-muted/30 p-2">
                  <img src={result.image} alt={result.formatLabel}
                    className="max-w-full max-h-full object-contain" />
                </div>
                <div className="px-2.5 py-1.5 border-t border-border/50">
                  <p className="text-[11px] font-medium text-foreground truncate">{result.formatLabel}</p>
                  <p className="text-[10px] text-muted-foreground">{result.w}×{result.h} · {result.ratio}</p>
                </div>
                <div className="absolute inset-0 bg-foreground/0 group-hover:bg-foreground/10 transition-colors" />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ─── Lightbox ─── */}
      {lightboxIndex !== null && results[lightboxIndex] && (
        <div className="fixed inset-0 z-50 bg-background/90 backdrop-blur-sm flex items-center justify-center"
          onClick={() => setLightboxIndex(null)}>
          <div className="relative max-w-[90vw] max-h-[90vh] flex flex-col items-center"
            onClick={e => e.stopPropagation()}>
            {/* Close */}
            <Button variant="ghost" size="icon"
              className="absolute top-2 right-2 z-10 bg-background/80 rounded-full"
              onClick={() => setLightboxIndex(null)}>
              <X className="w-5 h-5" />
            </Button>

            {/* Nav arrows */}
            {results.length > 1 && (
              <>
                <Button variant="ghost" size="icon"
                  className="absolute left-2 top-1/2 -translate-y-1/2 z-10 bg-background/80 rounded-full"
                  onClick={() => setLightboxIndex((lightboxIndex - 1 + results.length) % results.length)}>
                  <ChevronLeft className="w-5 h-5" />
                </Button>
                <Button variant="ghost" size="icon"
                  className="absolute right-2 top-1/2 -translate-y-1/2 z-10 bg-background/80 rounded-full"
                  onClick={() => setLightboxIndex((lightboxIndex + 1) % results.length)}>
                  <ChevronRight className="w-5 h-5" />
                </Button>
              </>
            )}

            <img src={results[lightboxIndex].image} alt={results[lightboxIndex].formatLabel}
              className="max-w-full max-h-[80vh] object-contain rounded-lg" />

            {/* Info bar */}
            <div className="mt-3 flex items-center gap-3">
              <Badge variant="secondary" className="text-xs">
                {results[lightboxIndex].formatLabel} · {results[lightboxIndex].w}×{results[lightboxIndex].h}
              </Badge>
              <Button size="sm" variant="outline" className="h-8 text-xs"
                onClick={() => downloadBanner(results[lightboxIndex])}>
                <Download className="w-3.5 h-3.5 mr-1" /> Download
              </Button>
            </div>

            {/* Thumbnails */}
            {results.length > 1 && (
              <div className="mt-3 flex gap-2 overflow-x-auto max-w-[80vw] pb-1">
                {results.map((r, i) => (
                  <button key={i} onClick={() => setLightboxIndex(i)}
                    className={`flex-shrink-0 w-14 h-14 rounded-md overflow-hidden border-2 transition-colors ${i === lightboxIndex ? 'border-accent' : 'border-border/50 hover:border-border'}`}>
                    <img src={r.image} alt={r.formatLabel} className="w-full h-full object-contain bg-muted/30" />
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      <CreditConfirmDialog
        open={creditDialog.open}
        cost={creditDialog.cost}
        balance={balance}
        actionLabel={creditDialog.mode === 'all' ? `Alle ${BANNER_FORMATS.length} Formate generieren` : `${variantCount} Banner generieren`}
        onConfirm={creditDialog.mode === 'all' ? doGenerateAll : doGenerateSingle}
        onCancel={() => setCreditDialog({ open: false, cost: 0, mode: 'single' })}
      />
    </div>
  );
};

export default BannerGenerator;
