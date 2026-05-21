import React, { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Download, FileText, ImageIcon, Loader2, Palette, Pencil, Settings2, Sparkles, X } from "lucide-react";
import QuickEditView from "./wizard/QuickEditView";
import { renderCompositionToDataURL } from "./export/renderComposition";
import type { BannerComposition } from "./state/types";
import { toast } from "sonner";
import JSZip from "jszip";

import AppHeader from "@/components/AppHeader";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useVehicleMakes } from "@/hooks/useVehicleMakes";
import { useBackgroundTasks } from "@/contexts/BackgroundTasksContext";

import { BANNER_FORMATS, slugifyFormat } from "./data/formats";
import type { BannerFormat, BannerTextFields } from "./state/types";
import {
  generateBannersFromInputs,
  type QuickBannerResult,
  type QuickGenerateProgress,
} from "./ai/generateBannersFromInputs";
import { buildCiContext, type DealerProfile } from "./ci/profileSources";
import { writeQuickHandoff } from "./state/quickHandoff";
import VehicleBrandPicker from "@/components/VehicleBrandPicker";
import { extractBannerDataFromImage, extractBannerDataFromPdf } from "./ai/masterImageClient";
import { extractPDFAsBase64 } from "@/lib/pdf-utils";
import { DEFAULT_TEXT_FIELDS } from "./data/defaultComposition";
import { BRAND_PRESETS, detectBrandKey, getBrandPreset } from "./ci/brandPresets";

interface Props {
  onSwitchToPro: () => void;
}

const DEFAULT_FORMAT_IDS = ["ig-square", "ig-story", "fb-feed"];

// Drei Master-Prompt-Stile für Quick-Mode.
type ScenePresetId = "showroom-neon" | "cinematic-showroom" | "studio-white";

// HERO-SIZE GUARDRAIL: in jedem Prompt enthalten, damit das Auto das dominierende
// Motiv ist und nach Ideogram-Reframe (Outpainting) NICHT zu klein wirkt.
const HERO_SIZE_RULES = [
  "COMPOSITION (critical): the vehicle is the absolute hero of the frame.",
  "The car MUST fill at least 80–90% of the image width and at least 70% of the image height.",
  "Frame it tight: from just above the roof to just below the tires, with only a small margin (max ~5–10% empty space) on the sides.",
  "Use a slight low hero angle (~3/4 front), so the car looks powerful and large.",
  "Do NOT zoom out, do NOT add wide empty foreground/sky, do NOT shrink the car to leave room for graphics or background props.",
  "The background is purely supporting atmosphere – it must never dominate or push the vehicle into the distance.",
].join(" ");

const NEG_RULES = "Strictly NO text, NO logos, NO watermarks, NO badges, NO visible license plate text (blank plate allowed), NO people, NO extra cars in the foreground.";

const SCENE_PRESETS: { id: ScenePresetId; label: string; description: string; build: (p: string, s: string) => string }[] = [
  {
    id: "showroom-neon",
    label: "Showroom · Neon-Streaks",
    description: "Heller Showroom mit Lichtstreifen in deinen CI-Farben.",
    build: (primary, secondary) => [
      "Re-stage the EXACT same vehicle inside a modern, bright premium car dealership showroom.",
      HERO_SIZE_RULES,
      "Background (supporting only, kept tight behind the car): polished glossy concrete floor, white ceiling with linear LED light strips, soft glass walls. Any other cars in the background must be tiny, far away, blurred and barely visible – never beside or in front of the hero car.",
      `Atmosphere: dynamic energetic ad scene with bold diagonal NEON LIGHT STREAKS and beams of colored light radiating from BEHIND the car outwards, in the brand colors ${primary} (primary, dominant) and ${secondary} (secondary accent). Streaks look like long-exposure light trails – sharp, vivid, with subtle glow and bloom – and must NEVER cover or shrink the vehicle.`,
      "The vehicle stays perfectly sharp, photoreal, large in frame, with clean reflections picking up hints of the brand-colored light. Floor reflects the colored streaks softly. Subtle rim light in the secondary brand color wraps around the car.",
      "Cinematic automotive advertising photography, 35mm, shallow depth of field, ultra crisp on the car, premium magazine quality.",
      NEG_RULES,
    ].join(" "),
  },
  {
    id: "cinematic-showroom",
    label: "Cinematic Studio",
    description: "Dunkler Studio-Hintergrund, dramatische Spotlights.",
    build: (primary, secondary) => [
      "Place the EXACT same vehicle in a cinematic premium dark studio.",
      HERO_SIZE_RULES,
      `Deep matte-black surroundings kept close around the car, focused warm spotlights highlighting body lines, glossy black floor with crisp reflection directly under the car, soft volumetric haze. Add a clear accent rim light in ${primary} on one side of the car and ${secondary} on the other side.`,
      "Editorial automotive photography, 35mm, shallow depth of field, hero-large vehicle in the center.",
      NEG_RULES,
    ].join(" "),
  },
  {
    id: "studio-white",
    label: "Studio · Reinweiß",
    description: "Sauberer weißer Hintergrund, Katalog-Look.",
    build: (primary, secondary) => [
      "Place the EXACT same vehicle in a clean white photo studio.",
      HERO_SIZE_RULES,
      `Seamless white cyclorama tight behind the car, soft diffused key light, gentle contact shadow directly under the tires. Premium automotive catalog look, ultra crisp, no extra props. A very subtle accent color gradient on the floor in ${primary}/${secondary} for a hint of brand identity (must stay subtle and never push the car backwards).`,
      NEG_RULES,
    ].join(" "),
  },
];

const QuickShell: React.FC<Props> = ({ onSwitchToPro }) => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { getLogoForMake } = useVehicleMakes();
  const bgTasks = useBackgroundTasks();

  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imageDataUrl, setImageDataUrl] = useState<string | null>(null);
  const [selectedFormatIds, setSelectedFormatIds] = useState<string[]>(DEFAULT_FORMAT_IDS);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<QuickGenerateProgress | null>(null);
  const [results, setResults] = useState<QuickBannerResult[]>([]);
  const [errors, setErrors] = useState<{ formatId: string; error: string }[]>([]);
  const [dealerProfile, setDealerProfile] = useState<DealerProfile | null>(null);
  const [editMode, setEditMode] = useState(false);

  // Analyse-States (laufen direkt nach PDF/Bild-Upload)
  const [analyzing, setAnalyzing] = useState(false);
  const [analyzedFields, setAnalyzedFields] = useState<BannerTextFields | null>(null);
  const [analyzedBrand, setAnalyzedBrand] = useState<string>("");
  const [analysisError, setAnalysisError] = useState<string | null>(null);

  // CI / Logo / Prompt
  const [manualBrand, setManualBrand] = useState<string>("");
  const [resolvedLogoUrl, setResolvedLogoUrl] = useState<string | null>(null);
  const [brandPresetKey, setBrandPresetKey] = useState<string>("custom");
  const [scenePresetId, setScenePresetId] = useState<ScenePresetId>("showroom-neon");

  const pdfInputRef = useRef<HTMLInputElement>(null);
  const imgInputRef = useRef<HTMLInputElement>(null);
  const lastTextFieldsRef = useRef<BannerTextFields | null>(null);
  const analyzeSeqRef = useRef(0);

  // Lade Dealer-Profil für CI-Kontext
  useEffect(() => {
    if (!user?.id) return;
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("profiles")
        .select("company_name, contact_name, email, phone, whatsapp_number, website, address, postal_code, city, logo_url, primary_color, secondary_color, default_legal_text, leasing_bank, leasing_legal_text, financing_bank, financing_legal_text, facebook_url, instagram_url, x_url, tiktok_url, youtube_url")
        .eq("id", user.id)
        .maybeSingle();
      if (!cancelled && data) setDealerProfile(data as DealerProfile);
    })();
    return () => { cancelled = true; };
  }, [user?.id]);

  // Auto-Analyse, sobald ein Datenblatt hochgeladen wurde.
  useEffect(() => {
    if (!pdfFile) {
      setAnalyzedFields(null);
      setAnalyzedBrand("");
      setAnalysisError(null);
      return;
    }
    const seq = ++analyzeSeqRef.current;
    setAnalyzing(true);
    setAnalysisError(null);
    (async () => {
      try {
        const isPdf = pdfFile.type === "application/pdf" || pdfFile.name.toLowerCase().endsWith(".pdf");
        let extracted;
        if (isPdf) {
          const base64 = await extractPDFAsBase64(pdfFile);
          extracted = await extractBannerDataFromPdf(base64);
        } else {
          const dataUrl = await new Promise<string>((resolve, reject) => {
            const r = new FileReader();
            r.onerror = () => reject(r.error ?? new Error("FileReader Fehler"));
            r.onload = () => resolve(String(r.result));
            r.readAsDataURL(pdfFile);
          });
          extracted = await extractBannerDataFromImage(dataUrl);
        }
        if (seq !== analyzeSeqRef.current) return; // veraltet
        const fields: BannerTextFields = { ...DEFAULT_TEXT_FIELDS };
        (["headline", "subline", "price", "cta", "smallInfo", "legalText"] as const).forEach((k) => {
          const v = (extracted as any)[k];
          if (v && String(v).trim()) (fields as any)[k] = String(v).trim();
        });
        const brand = String(extracted.brand ?? "").trim();
        setAnalyzedFields(fields);
        setAnalyzedBrand(brand);
        lastTextFieldsRef.current = fields;
        if (brand) applyBrand(brand);
        toast.success("Datenblatt analysiert.");
      } catch (e: any) {
        if (seq !== analyzeSeqRef.current) return;
        console.error("Analyse fehlgeschlagen", e);
        setAnalysisError(e?.message ?? "Analyse fehlgeschlagen");
        // Fallback: leere Defaults, damit man trotzdem generieren kann
        setAnalyzedFields({ ...DEFAULT_TEXT_FIELDS });
        toast.error("Datenblatt konnte nicht analysiert werden – du kannst trotzdem generieren.");
      } finally {
        if (seq === analyzeSeqRef.current) setAnalyzing(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pdfFile]);

  const applyBrand = useCallback((brand: string) => {
    setManualBrand(brand);
    if (!brand) {
      setResolvedLogoUrl(null);
      setBrandPresetKey("custom");
      return;
    }
    const key = brand.toLowerCase().replace(/\s+/g, "-");
    const url = getLogoForMake(key) || getLogoForMake(brand.toLowerCase()) || null;
    setResolvedLogoUrl(url);
    const presetKey = detectBrandKey(brand);
    if (presetKey) setBrandPresetKey(presetKey);
    if (!url) toast.warning(`Für "${brand}" wurde kein Logo gefunden.`);
  }, [getLogoForMake]);

  const handlePdfPick = (f: File | null) => {
    if (!f) return;
    const isPdf = f.type === "application/pdf" || f.name.toLowerCase().endsWith(".pdf");
    const isImage = f.type.startsWith("image/");
    if (!isPdf && !isImage) {
      toast.error("Bitte PDF-Exposé oder ein Datenblatt-Bild (JPG/PNG) auswählen.");
      return;
    }
    setPdfFile(f);
  };

  const handleImagePick = (f: File | null) => {
    if (!f) return;
    if (!f.type.startsWith("image/")) {
      toast.error("Bitte eine Bilddatei auswählen.");
      return;
    }
    setImageFile(f);
    const reader = new FileReader();
    reader.onload = () => setImageDataUrl(String(reader.result));
    reader.readAsDataURL(f);
  };

  const toggleFormat = (id: string) => {
    setSelectedFormatIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  };

  // CI-Farben aus dem aktuell gewählten Preset (oder Dealer-Profil bei custom).
  const activePreset = getBrandPreset(brandPresetKey);
  const ciColors = (() => {
    if (brandPresetKey !== "custom") return activePreset.colors;
    return {
      primary: dealerProfile?.primary_color || activePreset.colors.primary,
      secondary: dealerProfile?.secondary_color || activePreset.colors.secondary,
      text: activePreset.colors.text,
      bg: activePreset.colors.bg,
    };
  })();

  const canGenerate =
    !!pdfFile &&
    !!imageFile &&
    !!imageDataUrl &&
    selectedFormatIds.length > 0 &&
    !analyzing &&
    !!analyzedFields &&
    !busy;

  const handleGenerate = useCallback(async () => {
    if (!pdfFile || !imageDataUrl || !analyzedFields) {
      toast.error("Bitte warten bis die Analyse abgeschlossen ist.");
      return;
    }
    if (selectedFormatIds.length === 0) {
      toast.error("Bitte mindestens ein Format wählen.");
      return;
    }

    setBusy(true);
    setResults([]);
    setErrors([]);
    setProgress({ stage: "master", done: 0, total: 1, current: "Starte…" });

    const formats: BannerFormat[] = selectedFormatIds
      .map((id) => BANNER_FORMATS.find((f) => f.id === id))
      .filter((f): f is BannerFormat => !!f);

    const taskId = `quick-banner-${Date.now()}`;
    bgTasks.addTask({
      id: taskId,
      type: "banner",
      label: `Banner werden erstellt (${formats.length})`,
      total: formats.length,
      completed: 0,
    });

    const ciContext = buildCiContext(dealerProfile, null);
    const effectiveBrand = manualBrand || analyzedBrand || ciContext.marke || "";
    let manufacturerLogoUrl: string | undefined = resolvedLogoUrl ?? undefined;
    if (!manufacturerLogoUrl && effectiveBrand) {
      const key = effectiveBrand.toLowerCase().replace(/\s+/g, "-");
      manufacturerLogoUrl = getLogoForMake(key) || getLogoForMake(effectiveBrand.toLowerCase()) || undefined;
    }

    const scene = SCENE_PRESETS.find((s) => s.id === scenePresetId) ?? SCENE_PRESETS[0];
    const masterPromptOverride = scene.build(ciColors.primary, ciColors.secondary);

    try {
      const out = await generateBannersFromInputs(
        {
          datenblattFile: pdfFile,
          vehicleImageDataUrl: imageDataUrl,
          formats,
          ciContext: { ...ciContext, marke: effectiveBrand || ciContext.marke },
          manufacturerLogoUrl,
          primaryColorHex: ciColors.primary,
          secondaryColorHex: ciColors.secondary,
          preExtractedTextFields: analyzedFields,
          preDetectedBrand: effectiveBrand,
          masterPromptOverride,
        },
        (p) => {
          setProgress(p);
          const renderDone = p.stage === "render" || p.stage === "done"
            ? Math.max(0, p.done - 1 - formats.length)
            : 0;
          bgTasks.updateTask(taskId, { completed: Math.min(formats.length, renderDone) });
        },
      );
      setResults(out.results);
      setErrors(out.errors);
      lastTextFieldsRef.current = out.textFields;

      bgTasks.updateTask(taskId, {
        completed: formats.length,
        status: out.errors.length > 0 && out.results.length === 0 ? "error" : "done",
        finishedAt: Date.now(),
        errorMessage: out.errors.length > 0 && out.results.length === 0 ? "Generierung fehlgeschlagen" : undefined,
      });
      if (out.results.length > 0) {
        toast.success(`${out.results.length} Banner erstellt${out.errors.length ? ` (${out.errors.length} Fehler)` : ""}.`);
      } else {
        toast.error("Es konnten keine Banner erstellt werden.");
      }
    } catch (e: any) {
      console.error("Quick generate failed", e);
      toast.error(e?.message ?? "Generierung fehlgeschlagen");
      bgTasks.updateTask(taskId, {
        status: "error",
        finishedAt: Date.now(),
        errorMessage: e?.message ?? "Fehler",
      });
    } finally {
      setBusy(false);
    }
  }, [pdfFile, imageDataUrl, selectedFormatIds, dealerProfile, getLogoForMake, bgTasks, analyzedFields, analyzedBrand, manualBrand, resolvedLogoUrl, ciColors, scenePresetId]);

  const downloadSingle = (r: QuickBannerResult) => {
    const a = document.createElement("a");
    a.href = r.thumbnailDataUrl;
    a.download = `${slugifyFormat(r.format)}-${r.format.width}x${r.format.height}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const downloadZip = async () => {
    if (results.length === 0) return;
    const zip = new JSZip();
    for (const r of results) {
      const res = await fetch(r.thumbnailDataUrl);
      const blob = await res.blob();
      zip.file(`${slugifyFormat(r.format)}-${r.format.width}x${r.format.height}.png`, blob);
    }
    const blob = await zip.generateAsync({ type: "blob" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `canvas-banner-quick-${results.length}.zip`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const openInEditor = useCallback(() => {
    if (results.length === 0) return;
    const compositions: Record<string, typeof results[number]["composition"]> = {};
    const formatIds: string[] = [];
    results.forEach((r) => {
      compositions[r.formatId] = {
        ...r.composition,
        logoUrl: resolvedLogoUrl ?? r.composition.logoUrl,
      };
      formatIds.push(r.formatId);
    });
    writeQuickHandoff({
      selectedFormatIds: formatIds,
      activeFormatId: formatIds[0],
      textFields: lastTextFieldsRef.current ?? ({
        headline: "",
        subline: "",
        price: "",
        cta: "",
        smallInfo: "",
        legalText: "",
      } as any),
      compositions,
    });
    toast.success("Banner werden im Editor geöffnet — Texte & Positionen anpassen, dann exportieren.");
    onSwitchToPro();
  }, [results, onSwitchToPro, resolvedLogoUrl]);

  const progressPct = progress && progress.total > 0
    ? Math.round((progress.done / progress.total) * 100)
    : 0;

  const handleApplyEdits = useCallback(
    async (compositions: Record<string, BannerComposition>, textFields: BannerTextFields) => {
      const ciContext = buildCiContext(dealerProfile, null);
      const ciState = {
        brandKey: brandPresetKey,
        colors: {
          primary: ciColors.primary,
          secondary: ciColors.secondary,
          text: ciColors.text,
          bg: ciColors.bg,
        },
      } as any;
      try {
        const updated = await Promise.all(
          results.map(async (r) => {
            const comp = compositions[r.formatId] ?? r.composition;
            const thumb = await renderCompositionToDataURL(
              r.format, comp, textFields, "png", ciState, ciContext,
            );
            return { ...r, composition: comp, thumbnailDataUrl: thumb };
          }),
        );
        setResults(updated);
        lastTextFieldsRef.current = textFields;
      } catch (e) {
        console.error("re-render after edit failed", e);
      }
    },
    [results, dealerProfile, brandPresetKey, ciColors],
  );

  if (editMode && results.length > 0) {
    const compositions: Record<string, typeof results[number]["composition"]> = {};
    const formatIds: string[] = [];
    results.forEach((r) => {
      compositions[r.formatId] = {
        ...r.composition,
        logoUrl: resolvedLogoUrl ?? r.composition.logoUrl,
      };
      formatIds.push(r.formatId);
    });
    return (
      <QuickEditView
        initialFormatIds={formatIds}
        initialActiveFormatId={formatIds[0]}
        initialTextFields={lastTextFieldsRef.current ?? analyzedFields ?? DEFAULT_TEXT_FIELDS}
        initialCompositions={compositions}
        ci={{
          brandKey: brandPresetKey,
          colors: {
            primary: ciColors.primary,
            secondary: ciColors.secondary,
            text: ciColors.text,
            bg: ciColors.bg,
          },
        }}
        dealerProfile={dealerProfile}
        onBack={() => setEditMode(false)}
        onApply={handleApplyEdits}
      />
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <AppHeader />
      <div className="container mx-auto px-4 py-6 max-w-5xl">
        <div className="flex items-center justify-between gap-3 mb-6 flex-wrap">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => navigate("/dashboard")}>
              <ArrowLeft className="w-4 h-4 mr-1" /> Dashboard
            </Button>
            <h1 className="text-2xl font-bold text-foreground">Banner Quick-Generator</h1>
            <Badge variant="secondary">Quick-Modus</Badge>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={onSwitchToPro}>
              <Settings2 className="w-4 h-4 mr-1" /> Pro-Modus
            </Button>
          </div>
        </div>

        <p className="text-sm text-muted-foreground mb-4">
          Lade ein PDF (Exposé/Datenblatt) und ein Fahrzeugbild hoch — wir analysieren das Datenblatt
          automatisch und liefern fertige Banner in allen Formaten.
        </p>

        {/* Quellen */}
        <div className="grid gap-4 md:grid-cols-2 mb-4">
          {/* PDF */}
          <Card
            className="p-4 border-dashed border-2 cursor-pointer hover:border-accent transition-colors"
            onClick={() => pdfInputRef.current?.click()}
          >
            <input
              ref={pdfInputRef}
              type="file"
              accept="application/pdf,.pdf,image/*"
              className="hidden"
              onChange={(e) => handlePdfPick(e.target.files?.[0] ?? null)}
            />
            <div className="flex items-start gap-3">
              <FileText className="w-8 h-8 text-accent shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-foreground">Datenblatt / Exposé <span className="text-red-500">*</span></div>
                {pdfFile ? (
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-sm text-foreground truncate">{pdfFile.name}</span>
                    {analyzing ? (
                      <Loader2 className="w-3 h-3 animate-spin text-muted-foreground" />
                    ) : analyzedFields ? (
                      <Badge variant="secondary" className="text-[10px] py-0">analysiert</Badge>
                    ) : null}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => { e.stopPropagation(); setPdfFile(null); }}
                    >
                      <X className="w-3 h-3" />
                    </Button>
                  </div>
                ) : (
                  <div className="text-xs text-muted-foreground mt-1">PDF oder Bild — wird sofort nach Upload automatisch analysiert</div>
                )}
                {analysisError && (
                  <div className="text-[11px] text-destructive mt-1">{analysisError}</div>
                )}
              </div>
            </div>
          </Card>

          {/* Bild */}
          <Card
            className="p-4 border-dashed border-2 cursor-pointer hover:border-accent transition-colors"
            onClick={() => imgInputRef.current?.click()}
          >
            <input
              ref={imgInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => handleImagePick(e.target.files?.[0] ?? null)}
            />
            <div className="flex items-start gap-3">
              {imageDataUrl ? (
                <img src={imageDataUrl} alt="Vorschau" className="w-16 h-16 object-cover rounded shrink-0" />
              ) : (
                <ImageIcon className="w-8 h-8 text-accent shrink-0" />
              )}
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-foreground">Fahrzeugbild <span className="text-red-500">*</span></div>
                {imageFile ? (
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-sm text-foreground truncate">{imageFile.name}</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => { e.stopPropagation(); setImageFile(null); setImageDataUrl(null); }}
                    >
                      <X className="w-3 h-3" />
                    </Button>
                  </div>
                ) : (
                  <div className="text-xs text-muted-foreground mt-1">Klicken zum Hochladen — wird passend auf jedes Format zugeschnitten</div>
                )}
              </div>
            </div>
          </Card>
        </div>

        {/* Format-Chips */}
        <Card className="p-4 mb-4">
          <div className="flex items-center justify-between mb-2">
            <div className="font-semibold text-foreground">Formate ({selectedFormatIds.length})</div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSelectedFormatIds(selectedFormatIds.length === BANNER_FORMATS.length ? DEFAULT_FORMAT_IDS : BANNER_FORMATS.map((f) => f.id))}
            >
              {selectedFormatIds.length === BANNER_FORMATS.length ? "Standard" : "Alle wählen"}
            </Button>
          </div>
          <div className="flex flex-wrap gap-2">
            {BANNER_FORMATS.map((f) => {
              const active = selectedFormatIds.includes(f.id);
              return (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => toggleFormat(f.id)}
                  className={`px-3 py-1.5 text-xs rounded-full border transition-colors ${
                    active
                      ? "bg-accent text-accent-foreground border-accent"
                      : "bg-background text-foreground border-border hover:border-accent"
                  }`}
                >
                  {f.name} <span className="opacity-60">{f.width}×{f.height}</span>
                </button>
              );
            })}
          </div>
        </Card>

        {/* Marke & CI & Szene */}
        <Card className="p-4 mb-4 space-y-4">
          <div className="flex items-center gap-2">
            <Palette className="w-4 h-4 text-accent" />
            <div className="font-semibold text-foreground">Marke, CI & Szene</div>
          </div>

          {/* Hersteller-Logo + Brand-Picker */}
          <div className="rounded-lg border border-border bg-muted/30 p-3">
            <div className="flex items-center gap-3 flex-wrap">
              <div className="flex items-center gap-2 min-w-0">
                {resolvedLogoUrl ? (
                  <img src={resolvedLogoUrl} alt={manualBrand || analyzedBrand} className="w-10 h-10 object-contain" />
                ) : (
                  <div className="w-10 h-10 rounded bg-background border border-dashed border-border flex items-center justify-center text-[10px] text-muted-foreground">Logo</div>
                )}
                <div className="min-w-0">
                  <div className="text-xs font-semibold text-foreground">
                    Hersteller-Logo {resolvedLogoUrl ? "" : "fehlt"}
                  </div>
                  <div className="text-[11px] text-muted-foreground truncate">
                    {analyzing
                      ? "Marke wird ermittelt…"
                      : resolvedLogoUrl
                        ? `Erkannte Marke: ${manualBrand || analyzedBrand || "—"}`
                        : "Bitte Marke wählen, damit das Logo erscheint."}
                  </div>
                </div>
              </div>
              <div className="flex-1 min-w-[220px]">
                <VehicleBrandPicker
                  brand={manualBrand}
                  onBrandChange={applyBrand}
                  placeholder="Marke wählen…"
                />
              </div>
            </div>
          </div>

          {/* CI-Preset + Farben */}
          <div className="grid gap-3 md:grid-cols-[260px_1fr]">
            <div>
              <label className="text-[11px] uppercase tracking-wider text-muted-foreground">Marken-Vorlage</label>
              <select
                value={brandPresetKey}
                onChange={(e) => setBrandPresetKey(e.target.value)}
                className="mt-1 w-full text-sm rounded-md border border-border bg-background px-3 py-2"
              >
                {BRAND_PRESETS.map((b) => (
                  <option key={b.key} value={b.key}>{b.label}</option>
                ))}
              </select>
              <p className="text-[10px] text-muted-foreground mt-1">
                {brandPresetKey === "custom"
                  ? "Custom = CI-Farben aus deinem Händler-Profil."
                  : "Hersteller-CI – Farben & Akzente."}
              </p>
            </div>
            <div>
              <label className="text-[11px] uppercase tracking-wider text-muted-foreground">CI-Farben</label>
              <div className="mt-1 grid grid-cols-4 gap-2">
                {(["primary", "secondary", "text", "bg"] as const).map((k) => (
                  <div key={k} className="flex items-center gap-2 rounded border border-border bg-background px-2 py-1.5">
                    <span
                      className="w-5 h-5 rounded border border-border shrink-0"
                      style={{ backgroundColor: (ciColors as any)[k] }}
                    />
                    <div className="min-w-0">
                      <div className="text-[9px] uppercase text-muted-foreground leading-none">{k}</div>
                      <div className="text-[10px] font-mono text-foreground truncate">{(ciColors as any)[k]}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Szenen-Auswahl */}
          <div>
            <label className="text-[11px] uppercase tracking-wider text-muted-foreground">Szene / Stil</label>
            <div className="mt-1 grid gap-2 sm:grid-cols-3">
              {SCENE_PRESETS.map((s) => {
                const active = scenePresetId === s.id;
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => setScenePresetId(s.id)}
                    className={`text-left rounded-lg border p-3 transition-colors ${
                      active
                        ? "border-accent bg-accent/10"
                        : "border-border bg-background hover:border-accent/50"
                    }`}
                  >
                    <div className="text-sm font-semibold text-foreground">{s.label}</div>
                    <div className="text-[11px] text-muted-foreground leading-tight mt-0.5">{s.description}</div>
                  </button>
                );
              })}
            </div>
          </div>
        </Card>

        {/* Generieren */}
        <div className="flex flex-col items-center gap-2 mb-6">
          <Button
            size="lg"
            disabled={!canGenerate}
            onClick={handleGenerate}
            className="min-w-64"
          >
            {busy ? (
              <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Wird erstellt…</>
            ) : analyzing ? (
              <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Datenblatt wird analysiert…</>
            ) : (
              <><Sparkles className="w-4 h-4 mr-2" /> Banner generieren</>
            )}
          </Button>
          {!canGenerate && !busy && (
            <p className="text-[11px] text-muted-foreground">
              {!pdfFile || !imageFile
                ? "Datenblatt und Fahrzeugbild hochladen."
                : analyzing
                  ? "Analyse läuft – gleich startbereit."
                  : "Mindestens ein Format wählen."}
            </p>
          )}
        </div>

        {/* Progress */}
        {busy && progress && (
          <Card className="p-4 mb-4">
            <div className="flex items-center justify-between text-sm mb-2">
              <span className="text-foreground">
                {progress.stage === "analyze" && "Datenblatt analysieren"}
                {progress.stage === "master" && "Masterbild erstellen"}
                {progress.stage === "reframe" && "Bilder anpassen"}
                {progress.stage === "render" && "Banner rendern"}
                {progress.stage === "done" && "Fertig"}
                {progress.stage === "error" && "Fehler"}
                {progress.current ? ` — ${progress.current}` : ""}
              </span>
              <span className="text-muted-foreground tabular-nums">{progressPct}%</span>
            </div>
            <Progress value={progressPct} />
            <p className="text-xs text-muted-foreground mt-2">
              Läuft im Hintergrund — du kannst die Seite verlassen, der Fortschritt bleibt erhalten.
            </p>
          </Card>
        )}

        {/* Ergebnisse */}
        {results.length > 0 && (
          <Card className="p-4">
            <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
              <div>
                <div className="font-semibold text-foreground">Vorschau ({results.length})</div>
                <div className="text-xs text-muted-foreground">
                  Alle Banner fertig — einzeln oder als ZIP herunterladen.
                </div>
              </div>
              <div className="flex gap-2 flex-wrap">
                <Button size="sm" variant="outline" onClick={() => setEditMode(true)}>
                  <Pencil className="w-4 h-4 mr-1" /> Bearbeiten
                </Button>
                <Button size="sm" onClick={downloadZip}>
                  <Download className="w-4 h-4 mr-1" /> Alle als ZIP
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              {results.map((r) => {
                const aspect = r.format.width / r.format.height;
                return (
                  <div key={r.formatId} className="rounded-lg border border-border overflow-hidden bg-card">
                    <div className="w-full bg-muted/40" style={{ aspectRatio: `${aspect}` }}>
                      <img src={r.thumbnailDataUrl} alt={r.format.name} className="w-full h-full object-contain" />
                    </div>
                    <div className="p-2 flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <div className="text-xs font-semibold text-foreground truncate">{r.format.name}</div>
                        <div className="text-[10px] text-muted-foreground tabular-nums">{r.format.width}×{r.format.height}</div>
                      </div>
                      <Button variant="ghost" size="sm" onClick={() => downloadSingle(r)}>
                        <Download className="w-3 h-3" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
            {errors.length > 0 && (
              <div className="mt-3 text-xs text-destructive">
                {errors.length} Format(e) fehlgeschlagen: {errors.map((e) => e.formatId).join(", ")}
              </div>
            )}
          </Card>
        )}
      </div>
    </div>
  );
};

export default QuickShell;
