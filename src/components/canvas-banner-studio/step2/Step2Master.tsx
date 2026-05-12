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
import { Image as ImageIcon, Loader2, Sparkles, Wand2, RotateCcw, Check, X } from "lucide-react";

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

const Step2Master: React.FC<Props> = ({ backgroundImageUrl, onApplyMaster, onClearMaster, onApplyFields }) => {
  // Source selection
  const [sourceUrl, setSourceUrl] = useState<string | undefined>(undefined);
  const [galleryOpen, setGalleryOpen] = useState(false);

  // Prompt + master state
  const [promptId, setPromptId] = useState<string>(MARKETING_PROMPTS[0].id);
  const [extra, setExtra] = useState("");
  const [generating, setGenerating] = useState(false);
  const [masterUrl, setMasterUrl] = useState<string | undefined>(undefined);

  // Data sheet
  const [sheetUrl, setSheetUrl] = useState<string | undefined>(undefined);
  const [sheetMime, setSheetMime] = useState<string>("image/jpeg");
  const [extractBusy, setExtractBusy] = useState(false);
  const [extracted, setExtracted] = useState<ExtractedBannerFields | null>(null);

  const handleGenerate = async () => {
    if (!sourceUrl) {
      toast.error("Bitte zuerst ein Basis-Bild wählen.");
      return;
    }
    const preset = getMarketingPromptById(promptId);
    if (!preset) return;
    setGenerating(true);
    try {
      const out = await generateMasterBannerImage({
        sourceImageUrl: sourceUrl,
        promptText: preset.prompt,
        extraInstruction: extra.trim() || undefined,
      });
      setMasterUrl(out.imageDataUrl);
      toast.success("Masterbild erzeugt – freigeben oder neu generieren.");
    } catch (e: any) {
      console.error(e);
      toast.error(e?.message ?? "Generierung fehlgeschlagen");
    } finally {
      setGenerating(false);
    }
  };

  const handleApprove = () => {
    if (!masterUrl) return;
    onApplyMaster(masterUrl);
    toast.success("Masterbild übernommen – jetzt unten ggf. auf Formate reframen.");
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

        <Button onClick={handleGenerate} disabled={!sourceUrl || generating} className="w-full">
          {generating ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Wand2 className="w-4 h-4 mr-2" />}
          {generating ? "Generiere…" : masterUrl ? "Neu generieren" : "Masterbild generieren"}
        </Button>

        {masterUrl && (
          <div className="space-y-2">
            <div className="rounded-md overflow-hidden border border-border bg-card">
              <img src={masterUrl} alt="Masterbild Vorschau" className="w-full max-h-[280px] object-contain" />
            </div>
            <div className="flex gap-2">
              <Button size="sm" onClick={handleApprove} className="flex-1">
                <Check className="w-4 h-4 mr-1" /> Übernehmen
              </Button>
              <Button size="sm" variant="outline" onClick={handleGenerate} disabled={generating}>
                <RotateCcw className="w-4 h-4 mr-1" /> Erneut
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setMasterUrl(undefined)}>
                <X className="w-4 h-4" />
              </Button>
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
