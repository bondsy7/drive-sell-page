import React, { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Image as ImageIcon, Loader2, Sparkles, Wand2, RotateCcw, Check, X, History, Layers } from "lucide-react";

import ImageUpload from "../controls/ImageUpload";
import GalleryPickerDialog from "./GalleryPickerDialog";
import { MARKETING_PROMPTS, getMarketingPromptById } from "../data/marketingPrompts";
import { generateMasterBannerImage, extractBannerDataFromImage, extractBannerDataFromPdf, ExtractedBannerFields } from "../ai/masterImageClient";
import type { BannerTextFieldKey } from "../state/types";

interface Props {
  /** Currently active background (master) image URL */
  backgroundImageUrl?: string;
  /** Apply a new master image */
  onApplyMaster: (dataUrl: string) => void;
  /** Clear the current master image */
  onClearMaster: () => void;
  /** Apply extracted text fields */
  onApplyFields: (fields: Partial<Record<BannerTextFieldKey, string>>) => void;
}

const MAX_HISTORY = 6;

/** Light prompt nudges to diversify 3 parallel variants without changing the vehicle. */
const VARIANT_NUDGES: string[] = [
  "Camera angle slightly lower, warmer golden-hour lighting.",
  "Cooler twilight palette, subtle reflections on the bodywork.",
  "Wider environment with more negative space on the right for text.",
];

/** Quick refinement chips appended to the user's edit instruction. */
const REFINE_CHIPS: { label: string; value: string }[] = [
  { label: "Sonnenuntergang", value: "warm golden-hour sunset light, long soft shadows" },
  { label: "Studio", value: "clean studio backdrop, soft seamless gradient, controlled light" },
  { label: "Stadt", value: "modern city scene, clean architecture, blurred background" },
  { label: "Berge", value: "alpine mountain road backdrop, dramatic sky" },
  { label: "Tiefer Winkel", value: "lower camera angle, hero perspective" },
  { label: "Mehr Platz rechts", value: "compose with extra negative space on the right for text overlay" },
  { label: "Ohne harte Schatten", value: "soft diffused lighting, no harsh shadows" },
];

const Step2Master: React.FC<Props> = ({ backgroundImageUrl, onApplyMaster, onClearMaster, onApplyFields }) => {
  // Source selection
  const [sourceUrl, setSourceUrl] = useState<string | undefined>(undefined);
  const [galleryOpen, setGalleryOpen] = useState(false);

  // Prompt + master state
  const [promptId, setPromptId] = useState<string>(MARKETING_PROMPTS[0].id);
  const [extra, setExtra] = useState("");
  const [generating, setGenerating] = useState(false);
  const [variantsBusy, setVariantsBusy] = useState(false);
  const [masterUrl, setMasterUrl] = useState<string | undefined>(undefined);
  const [variants, setVariants] = useState<string[] | null>(null);
  const [history, setHistory] = useState<string[]>([]);

  // Edit-loop state
  const [refineText, setRefineText] = useState("");
  const [refining, setRefining] = useState(false);

  // Data sheet
  const [sheetUrl, setSheetUrl] = useState<string | undefined>(undefined);
  const [sheetMime, setSheetMime] = useState<string>("image/jpeg");
  const [extractBusy, setExtractBusy] = useState(false);
  const [extracted, setExtracted] = useState<ExtractedBannerFields | null>(null);

  const pushHistory = (url: string) => {
    setHistory((h) => {
      const next = [url, ...h.filter((u) => u !== url)];
      return next.slice(0, MAX_HISTORY);
    });
  };

  const setMaster = (url: string) => {
    if (masterUrl && masterUrl !== url) pushHistory(masterUrl);
    setMasterUrl(url);
  };

  const handleGenerate = async () => {
    if (!sourceUrl) {
      toast.error("Bitte zuerst ein Basis-Bild wählen.");
      return;
    }
    const preset = getMarketingPromptById(promptId);
    if (!preset) return;
    setGenerating(true);
    setVariants(null);
    try {
      const out = await generateMasterBannerImage({
        sourceImageUrl: sourceUrl,
        promptText: preset.prompt,
        extraInstruction: extra.trim() || undefined,
      });
      setMaster(out.imageDataUrl);
      toast.success("Masterbild erzeugt – freigeben oder verfeinern.");
    } catch (e: any) {
      console.error(e);
      toast.error(e?.message ?? "Generierung fehlgeschlagen");
    } finally {
      setGenerating(false);
    }
  };

  const handleGenerateVariants = async () => {
    if (!sourceUrl) {
      toast.error("Bitte zuerst ein Basis-Bild wählen.");
      return;
    }
    const preset = getMarketingPromptById(promptId);
    if (!preset) return;
    setVariantsBusy(true);
    setVariants(null);
    try {
      const calls = VARIANT_NUDGES.map((nudge) =>
        generateMasterBannerImage({
          sourceImageUrl: sourceUrl,
          promptText: preset.prompt,
          extraInstruction: [extra.trim(), nudge].filter(Boolean).join(" — "),
        }).then(
          (r) => ({ ok: true as const, url: r.imageDataUrl }),
          (e) => ({ ok: false as const, err: e?.message ?? "fehler" }),
        ),
      );
      const results = await Promise.all(calls);
      const ok = results.filter((r) => r.ok).map((r: any) => r.url) as string[];
      if (ok.length === 0) {
        toast.error("Keine Variante erfolgreich. Bitte erneut versuchen.");
      } else {
        setVariants(ok);
        toast.success(`${ok.length} von 3 Varianten generiert – wähle die beste.`);
      }
    } catch (e: any) {
      console.error(e);
      toast.error(e?.message ?? "Variantenlauf fehlgeschlagen");
    } finally {
      setVariantsBusy(false);
    }
  };

  const handleRefine = async () => {
    const base = masterUrl ?? sourceUrl;
    if (!base) {
      toast.error("Erst Masterbild generieren oder Basis-Bild wählen.");
      return;
    }
    if (!refineText.trim()) {
      toast.error("Bitte eine Anweisung eingeben (oder Quick-Chip nutzen).");
      return;
    }
    const preset = getMarketingPromptById(promptId);
    if (!preset) return;
    setRefining(true);
    try {
      const out = await generateMasterBannerImage({
        sourceImageUrl: base,
        promptText: preset.prompt,
        extraInstruction: `Refine the existing master image: ${refineText.trim()}`,
      });
      setMaster(out.imageDataUrl);
      setRefineText("");
      toast.success("Verfeinerung übernommen.");
    } catch (e: any) {
      console.error(e);
      toast.error(e?.message ?? "Verfeinerung fehlgeschlagen");
    } finally {
      setRefining(false);
    }
  };

  const handleApprove = () => {
    if (!masterUrl) return;
    onApplyMaster(masterUrl);
    toast.success("Masterbild übernommen – jetzt unten ggf. auf Formate reframen.");
  };

  const pickVariant = (url: string) => {
    setMaster(url);
    setVariants(null);
    toast.success("Variante übernommen – jetzt freigeben oder verfeinern.");
  };

  const restoreFromHistory = (url: string) => {
    setMaster(url);
    toast.message("Aus Verlauf wiederhergestellt");
  };

  const handleSheetUpload = (url: string) => {
    setSheetUrl(url);
    const m = url.match(/^data:([^;]+);base64,/);
    if (m) setSheetMime(m[1]);
  };

  const handleExtract = async () => {
    if (!sheetUrl) return;
    setExtractBusy(true);
    try {
      let fields: ExtractedBannerFields;
      if (sheetMime === "application/pdf") {
        const b64 = sheetUrl.replace(/^data:[^;]+;base64,/, "");
        fields = await extractBannerDataFromPdf(b64);
      } else {
        fields = await extractBannerDataFromImage(sheetUrl);
      }
      setExtracted(fields);
      toast.success("Daten extrahiert – prüfen und übernehmen.");
    } catch (e: any) {
      console.error(e);
      toast.error(e?.message ?? "Extraktion fehlgeschlagen");
    } finally {
      setExtractBusy(false);
    }
  };

  const applyAllFields = () => {
    if (!extracted) return;
    const out: Partial<Record<BannerTextFieldKey, string>> = {};
    (Object.keys(extracted) as (keyof ExtractedBannerFields)[]).forEach((k) => {
      const v = extracted[k];
      if (v && v.trim()) out[k as BannerTextFieldKey] = v;
    });
    onApplyFields(out);
    toast.success("Texte übernommen.");
  };

  const presetMeta = getMarketingPromptById(promptId);
  const anyBusy = generating || variantsBusy || refining;

  return (
    <div className="space-y-6">
      {/* A) Basis-Bild */}
      <section className="space-y-3">
        <div>
          <h2 className="font-semibold text-foreground">1) Basis-Bild wählen</h2>
          <p className="text-xs text-muted-foreground">
            Lade ein Foto hoch oder wähle ein bestehendes Galerie-Bild als Vorlage.
          </p>
        </div>
        <ImageUpload
          imageUrl={sourceUrl}
          onUpload={(url) => setSourceUrl(url)}
          onClear={() => setSourceUrl(undefined)}
          label="Basis-Bild hochladen"
        />
        <div>
          <Button size="sm" variant="outline" onClick={() => setGalleryOpen(true)}>
            <ImageIcon className="w-3.5 h-3.5 mr-1" /> Aus Galerie wählen
          </Button>
        </div>
        <GalleryPickerDialog open={galleryOpen} onClose={() => setGalleryOpen(false)} onPick={(url) => setSourceUrl(url)} />
      </section>

      {/* B) Marketing-Prompt → Masterbild */}
      <section className="space-y-3 rounded-lg border border-border bg-muted/30 p-3">
        <div className="flex items-center gap-2">
          <Sparkles className="w-3.5 h-3.5 text-accent" />
          <h2 className="font-semibold text-foreground">2) Masterbild generieren</h2>
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-accent/10 text-accent">AI</span>
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground">Marketing-Stil</label>
          <Select value={promptId} onValueChange={setPromptId}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {MARKETING_PROMPTS.map((p) => (
                <SelectItem key={p.id} value={p.id}>{p.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {presetMeta && <p className="text-[11px] text-muted-foreground">{presetMeta.description}</p>}
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground">Eigene Anweisung (optional)</label>
          <Textarea
            value={extra}
            onChange={(e) => setExtra(e.target.value)}
            placeholder="z.B. ‚stehend, Frontansicht leicht von links, Sonnenuntergang über Skyline'"
            className="min-h-[60px] text-sm"
          />
        </div>

        <div className="grid grid-cols-2 gap-2">
          <Button onClick={handleGenerate} disabled={!sourceUrl || anyBusy}>
            {generating ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Wand2 className="w-4 h-4 mr-2" />}
            {generating ? "Generiere…" : masterUrl ? "Neu generieren" : "Generieren"}
          </Button>
          <Button variant="outline" onClick={handleGenerateVariants} disabled={!sourceUrl || anyBusy}>
            {variantsBusy ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Layers className="w-4 h-4 mr-2" />}
            {variantsBusy ? "3 Varianten…" : "3 Varianten"}
          </Button>
        </div>

        {/* Variant picker */}
        {variants && variants.length > 0 && (
          <div className="space-y-2">
            <div className="text-xs text-muted-foreground">Wähle deine Lieblingsvariante:</div>
            <div className="grid grid-cols-3 gap-2">
              {variants.map((url, i) => (
                <button
                  key={i}
                  onClick={() => pickVariant(url)}
                  className="group relative rounded-md overflow-hidden border border-border bg-card hover:border-accent transition"
                  title={`Variante ${i + 1} übernehmen`}
                >
                  <img src={url} alt={`Variante ${i + 1}`} className="w-full h-24 object-cover" />
                  <div className="absolute inset-x-0 bottom-0 px-1.5 py-0.5 text-[10px] bg-background/80 text-foreground">
                    Variante {i + 1}
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Master preview + approve */}
        {masterUrl && (
          <div className="space-y-2">
            <div className="rounded-md overflow-hidden border border-border bg-card">
              <img src={masterUrl} alt="Masterbild Vorschau" className="w-full max-h-[280px] object-contain" />
            </div>
            <div className="flex gap-2">
              <Button size="sm" onClick={handleApprove} className="flex-1">
                <Check className="w-4 h-4 mr-1" /> Übernehmen
              </Button>
              <Button size="sm" variant="outline" onClick={handleGenerate} disabled={anyBusy}>
                <RotateCcw className="w-4 h-4 mr-1" /> Erneut
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setMasterUrl(undefined)} disabled={anyBusy}>
                <X className="w-4 h-4" />
              </Button>
            </div>

            {/* Edit-loop */}
            <div className="rounded-md border border-dashed border-border p-2 space-y-2 bg-background/50">
              <div className="flex items-center gap-2">
                <Wand2 className="w-3.5 h-3.5 text-accent" />
                <h3 className="text-xs font-semibold">Verfeinern (Edit-Loop)</h3>
              </div>
              <p className="text-[11px] text-muted-foreground">
                Beschreibe, was anders werden soll. Das Masterbild wird gezielt angepasst — Fahrzeug bleibt erhalten.
              </p>
              <div className="flex flex-wrap gap-1">
                {REFINE_CHIPS.map((c) => (
                  <button
                    key={c.label}
                    onClick={() => setRefineText((t) => (t.trim() ? `${t.trim()}, ${c.value}` : c.value))}
                    className="text-[10px] px-2 py-0.5 rounded-full border border-border bg-card hover:border-accent hover:text-foreground text-muted-foreground"
                    type="button"
                  >
                    + {c.label}
                  </button>
                ))}
              </div>
              <Textarea
                value={refineText}
                onChange={(e) => setRefineText(e.target.value)}
                placeholder="z.B. ‚Hintergrund weicher, mehr Platz rechts für Text'"
                className="min-h-[50px] text-sm"
              />
              <Button size="sm" onClick={handleRefine} disabled={anyBusy || !refineText.trim()} className="w-full">
                {refining ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Wand2 className="w-4 h-4 mr-1" />}
                {refining ? "Verfeinere…" : "Verfeinerung anwenden"}
              </Button>
            </div>
          </div>
        )}

        {/* History */}
        {history.length > 0 && (
          <div className="space-y-1.5 pt-2 border-t border-border">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <History className="w-3 h-3" /> Master-Verlauf
              </div>
              <button
                onClick={() => setHistory([])}
                className="text-[10px] text-muted-foreground hover:text-foreground underline"
              >
                leeren
              </button>
            </div>
            <div className="flex gap-1.5 overflow-x-auto pb-1">
              {history.map((url, i) => (
                <button
                  key={i}
                  onClick={() => restoreFromHistory(url)}
                  className="flex-shrink-0 rounded border border-border hover:border-accent overflow-hidden"
                  title="Wiederherstellen"
                >
                  <img src={url} alt={`v${i}`} className="w-16 h-12 object-cover" />
                </button>
              ))}
            </div>
          </div>
        )}

        {backgroundImageUrl && (
          <div className="text-[11px] text-muted-foreground pt-1 border-t border-border">
            Aktuell aktives Hintergrundbild ist gesetzt.{" "}
            <button className="underline hover:text-foreground" onClick={onClearMaster}>entfernen</button>
          </div>
        )}
      </section>

      {/* C) Datenblatt → Texte */}
      <section className="space-y-3 rounded-lg border border-border bg-muted/30 p-3">
        <div>
          <h2 className="font-semibold text-foreground">3) Datenblatt analysieren (optional)</h2>
          <p className="text-xs text-muted-foreground">
            PDF oder Foto eines Angebots/Datenblatts hochladen – Texte werden automatisch
            für Headline, Preis, CTA & Pflichtangaben vorgeschlagen.
          </p>
        </div>
        <ImageUpload
          imageUrl={sheetUrl}
          onUpload={handleSheetUpload}
          onClear={() => { setSheetUrl(undefined); setExtracted(null); }}
          label="Datenblatt hochladen (PDF / Bild)"
          accept="image/jpeg,image/png,image/webp,application/pdf"
        />
        <Button size="sm" onClick={handleExtract} disabled={!sheetUrl || extractBusy} variant="outline">
          {extractBusy ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Sparkles className="w-4 h-4 mr-1" />}
          {extractBusy ? "Analysiere…" : "Daten extrahieren"}
        </Button>

        {extracted && (
          <div className="space-y-2 text-sm">
            <ul className="space-y-1 rounded-md border border-border bg-background p-2 text-xs">
              {(Object.entries(extracted) as [keyof ExtractedBannerFields, string][])
                .filter(([, v]) => v && v.trim())
                .map(([k, v]) => (
                  <li key={k} className="flex gap-2">
                    <span className="font-mono text-muted-foreground w-20 shrink-0">{k}</span>
                    <span className="text-foreground">{v}</span>
                  </li>
                ))}
            </ul>
            <Button size="sm" onClick={applyAllFields} className="w-full">
              <Check className="w-4 h-4 mr-1" /> Alle Texte übernehmen
            </Button>
          </div>
        )}
      </section>
    </div>
  );
};

export default Step2Master;
