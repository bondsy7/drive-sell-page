import React, { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Download, FileText, ImageIcon, Loader2, Settings2, Sparkles, X } from "lucide-react";
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
import type { BannerFormat } from "./state/types";
import {
  generateBannersFromInputs,
  type QuickBannerResult,
  type QuickGenerateProgress,
} from "./ai/generateBannersFromInputs";
import { buildCiContext, type DealerProfile } from "./ci/profileSources";

interface Props {
  onSwitchToPro: () => void;
  onSwitchToWizard: () => void;
}

const DEFAULT_FORMAT_IDS = ["ig-square", "ig-story", "fb-feed"];

const QuickShell: React.FC<Props> = ({ onSwitchToPro, onSwitchToWizard }) => {
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

  const pdfInputRef = useRef<HTMLInputElement>(null);
  const imgInputRef = useRef<HTMLInputElement>(null);

  // Lade Dealer-Profil für CI-Kontext
  useEffect(() => {
    if (!user?.id) return;
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("profiles")
        .select("company_name, contact_name, email, phone, whatsapp_number, website, address, postal_code, city, logo_url, primary_color, secondary_color, default_legal_text")
        .eq("id", user.id)
        .maybeSingle();
      if (!cancelled && data) setDealerProfile(data as DealerProfile);
    })();
    return () => { cancelled = true; };
  }, [user?.id]);

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

  const canGenerate = !!pdfFile && !!imageFile && !!imageDataUrl && selectedFormatIds.length > 0 && !busy;

  const handleGenerate = useCallback(async () => {
    if (!pdfFile || !imageDataUrl) {
      toast.error("Bitte PDF und Fahrzeugbild hochladen.");
      return;
    }
    if (selectedFormatIds.length === 0) {
      toast.error("Bitte mindestens ein Format wählen.");
      return;
    }

    setBusy(true);
    setResults([]);
    setErrors([]);
    setProgress({ stage: "analyze", done: 0, total: 1, current: "Starte…" });

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
    let manufacturerLogoUrl: string | undefined;
    if (ciContext.marke) {
      const key = ciContext.marke.toLowerCase().replace(/\s+/g, "-");
      manufacturerLogoUrl = getLogoForMake(key) || getLogoForMake(ciContext.marke.toLowerCase()) || undefined;
    }

    try {
      const out = await generateBannersFromInputs(
        {
          datenblattFile: pdfFile,
          vehicleImageDataUrl: imageDataUrl,
          formats,
          ciContext,
          manufacturerLogoUrl,
        },
        (p) => {
          setProgress(p);
          // Background-Indicator: completed grob anhand stage zählen
          const renderDone = p.stage === "render" || p.stage === "done"
            ? Math.max(0, p.done - 1 - formats.length)
            : 0;
          bgTasks.updateTask(taskId, { completed: Math.min(formats.length, renderDone) });
        },
      );
      setResults(out.results);
      setErrors(out.errors);
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
  }, [pdfFile, imageDataUrl, selectedFormatIds, dealerProfile, getLogoForMake, bgTasks]);

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

  const progressPct = progress && progress.total > 0
    ? Math.round((progress.done / progress.total) * 100)
    : 0;

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
            <Button variant="outline" size="sm" onClick={onSwitchToWizard}>
              Wizard-Modus
            </Button>
            <Button variant="outline" size="sm" onClick={onSwitchToPro}>
              <Settings2 className="w-4 h-4 mr-1" /> Pro-Modus
            </Button>
          </div>
        </div>

        <p className="text-sm text-muted-foreground mb-4">
          Lade ein PDF (Exposé/Datenblatt) und ein Fahrzeugbild hoch — wir extrahieren automatisch
          Texte, passen das Bild an alle Formate an und liefern fertige Banner.
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
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => { e.stopPropagation(); setPdfFile(null); }}
                    >
                      <X className="w-3 h-3" />
                    </Button>
                  </div>
                ) : (
                  <div className="text-xs text-muted-foreground mt-1">PDF oder Bild (Foto/Screenshot) — wird automatisch analysiert</div>
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

        {/* Generieren */}
        <div className="flex justify-center mb-6">
          <Button
            size="lg"
            disabled={!canGenerate}
            onClick={handleGenerate}
            className="min-w-64"
          >
            {busy ? (
              <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Wird erstellt…</>
            ) : (
              <><Sparkles className="w-4 h-4 mr-2" /> Banner generieren</>
            )}
          </Button>
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
              <div className="font-semibold text-foreground">Ergebnisse ({results.length})</div>
              <div className="flex gap-2">
                <Button size="sm" onClick={downloadZip}>
                  <Download className="w-4 h-4 mr-1" /> Alle als ZIP
                </Button>
                <Button size="sm" variant="outline" onClick={onSwitchToPro}>
                  <Settings2 className="w-4 h-4 mr-1" /> Im Pro-Modus bearbeiten
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
