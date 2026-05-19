import React, { useEffect, useRef, useState } from "react";
import { Palette, Type, ImageIcon, Info, Upload, Loader2, AlertTriangle } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { BRAND_PRESETS, getBrandPreset } from "./brandPresets";
import { uploadCustomCiLogo } from "./uploadCiLogo";
import { DISPLAY_FONTS, BODY_FONTS, findFontPreset, type FontPreset } from "./fontCatalog";
import { ensureFontLoaded } from "./fontLoader";
import { detectIsSvg, isSvgUrlSync } from "./svgRecolor";
import type { CiState, LogoMode } from "../state/types";
import type { CiContext } from "./profileSources";

interface CiPanelProps {
  ci: CiState;
  ciContext?: CiContext | null;
  hasProfile: boolean;
  detectedBrandKey?: string;
  /** Aktuell aktive Logo-URLs pro Slot (für Recolor-Hinweis & Toggle-State). */
  activeManufacturerLogoUrl?: string;
  activeDealerLogoUrl?: string;
  activeCustomLogoUrl?: string;
  /** Hersteller-Logo aus Fahrzeug-Marke (Quelle). */
  manufacturerLogoUrl?: string;
  /** Händler-Logo aus Profil (Quelle). */
  dealerLogoUrl?: string;
  /** Eigenes (selbst hochgeladenes) CI-Logo (Quelle). */
  customLogoUrl?: string;
  /** User-ID für Storage-Upload */
  userId?: string;
  onApplyBrandPreset: (brandKey: string) => void;
  onPatchCi: (patch: Partial<CiState>) => void;
  /** Toggle eines einzelnen Logo-Slots an/aus. */
  onToggleLogoSlot: (slot: "manufacturer" | "dealer" | "custom", url?: string) => void;
  /** Alle Slots ausschalten. */
  onClearAllLogos: () => void;
  /** Anzahl ausgewählter Formate (für UI-Hinweis). */
  selectedFormatsCount?: number;
  applyLogoToAll: boolean;
  onToggleApplyLogoToAll: (v: boolean) => void;
}

const LOGO_MODES: { value: LogoMode; label: string }[] = [
  { value: "original", label: "Original" },
  { value: "monochrome-light", label: "Weiß" },
  { value: "monochrome-dark", label: "Schwarz" },
  { value: "custom", label: "Custom" },
];

const CiPanel: React.FC<CiPanelProps> = ({
  ci, ciContext, hasProfile, detectedBrandKey,
  activeManufacturerLogoUrl, activeDealerLogoUrl, activeCustomLogoUrl,
  manufacturerLogoUrl, dealerLogoUrl, customLogoUrl, userId,
  onApplyBrandPreset, onPatchCi, onToggleLogoSlot, onClearAllLogos,
  selectedFormatsCount = 1, applyLogoToAll, onToggleApplyLogoToAll,
}) => {
  const preset = getBrandPreset(ci.brandKey);
  const manufacturerOn = !!activeManufacturerLogoUrl;
  const dealerOn = !!activeDealerLogoUrl;
  const customOn = !!activeCustomLogoUrl;
  const anyOn = manufacturerOn || dealerOn || customOn;

  // "Aktuell sichtbares" Logo für SVG/Recolor-Hinweis: priorisiere Hersteller > Händler > Eigenes.
  const currentLogoUrl = activeManufacturerLogoUrl ?? activeDealerLogoUrl ?? activeCustomLogoUrl;

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [uploading, setUploading] = useState(false);
  const [logoIsSvg, setLogoIsSvg] = useState<boolean | null>(
    currentLogoUrl ? isSvgUrlSync(currentLogoUrl) || null : null
  );
  useEffect(() => {
    let cancelled = false;
    if (!currentLogoUrl) { setLogoIsSvg(null); return; }
    if (isSvgUrlSync(currentLogoUrl)) { setLogoIsSvg(true); return; }
    setLogoIsSvg(null);
    detectIsSvg(currentLogoUrl).then((v) => { if (!cancelled) setLogoIsSvg(v); });
    return () => { cancelled = true; };
  }, [currentLogoUrl]);

  const toggleManufacturer = () => {
    if (manufacturerOn) { onToggleLogoSlot("manufacturer", undefined); return; }
    if (!manufacturerLogoUrl) {
      toast.info("Bitte zuerst eine Fahrzeug-Marke wählen, damit das Hersteller-Logo geladen werden kann.");
      return;
    }
    onToggleLogoSlot("manufacturer", manufacturerLogoUrl);
  };
  const toggleDealer = () => {
    if (dealerOn) { onToggleLogoSlot("dealer", undefined); return; }
    if (!dealerLogoUrl) {
      toast.info("Bitte Händler-Logo im Profil hinterlegen.");
      return;
    }
    onToggleLogoSlot("dealer", dealerLogoUrl);
  };
  const toggleCustom = () => {
    if (customOn) { onToggleLogoSlot("custom", undefined); return; }
    if (!customLogoUrl) {
      // Direkt Upload öffnen, damit der User nicht erst hochladen und dann klicken muss.
      fileInputRef.current?.click();
      return;
    }
    onToggleLogoSlot("custom", customLogoUrl);
  };

  const handleUpload = async (file: File | undefined | null) => {
    if (!file) return;
    if (!userId) { toast.error("Bitte zuerst einloggen."); return; }
    if (file.size > 5 * 1024 * 1024) { toast.error("Logo zu groß (max. 5 MB)."); return; }
    setUploading(true);
    try {
      const url = await uploadCustomCiLogo(file, userId);
      onPatchCi({ customLogoUrl: url } as any);
      onToggleLogoSlot("custom", url);
      toast.success("Eigenes Logo übernommen");
    } catch (e: any) {
      console.error(e);
      toast.error(e?.message ?? "Upload fehlgeschlagen");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };




  return (
    <section className="rounded-xl border border-border bg-card p-4 space-y-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <div className="flex items-center gap-2">
            <Palette className="w-4 h-4 text-accent" />
            <h2 className="font-semibold text-foreground">Corporate Identity</h2>
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-accent/10 text-accent">CI</span>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Markenfarben, Schriften & Logo-Verhalten. Wird in Vorschau und Export angewendet.
          </p>
        </div>
        {detectedBrandKey && detectedBrandKey !== ci.brandKey && (
          <button
            type="button"
            onClick={() => onApplyBrandPreset(detectedBrandKey)}
            className="text-xs px-2.5 py-1 rounded-md border border-accent/40 bg-accent/10 text-accent hover:bg-accent/20"
          >
            {getBrandPreset(detectedBrandKey).label}-CI übernehmen
          </button>
        )}
      </div>

      {/* Brand Preset */}
      <div className="space-y-1.5">
        <Label className="text-xs uppercase tracking-wider text-muted-foreground">Marken-Vorlage</Label>
        <select
          value={ci.brandKey}
          onChange={(e) => onApplyBrandPreset(e.target.value)}
          className="w-full px-3 py-2 rounded-md border border-border bg-background text-sm"
        >
          {BRAND_PRESETS.map((p) => (
            <option key={p.key} value={p.key}>{p.label}</option>
          ))}
        </select>
        <p className="text-[11px] text-muted-foreground">
          Wählt Schriften, Farben und Logo-Behandlung für die Marke. „Custom" = deine eigene CI aus dem Profil.
        </p>
      </div>

      {/* Fonts */}
      <div className="space-y-2">
        <Label className="text-xs uppercase tracking-wider text-muted-foreground flex items-center gap-1">
          <Type className="w-3 h-3" /> Schriften
        </Label>
        <div className="grid grid-cols-2 gap-2">
          <FontSelect
            label="Display (Headlines)"
            list={DISPLAY_FONTS}
            value={ci.fontDisplay}
            onChange={(family, spec) => {
              if (spec) ensureFontLoaded(spec);
              const next = new Set(ci.googleFonts ?? []);
              if (spec) next.add(spec);
              onPatchCi({ fontDisplay: family, googleFonts: Array.from(next) });
            }}
          />
          <FontSelect
            label="Body (Fließtext)"
            list={BODY_FONTS}
            value={ci.fontBody}
            onChange={(family, spec) => {
              if (spec) ensureFontLoaded(spec);
              const next = new Set(ci.googleFonts ?? []);
              if (spec) next.add(spec);
              onPatchCi({ fontBody: family, googleFonts: Array.from(next) });
            }}
          />
        </div>
        <p className="text-[11px] text-muted-foreground">
          Schriften werden live in Vorschau und Export angewendet.
        </p>
      </div>

      {/* Colors */}
      <div className="space-y-2">
        <Label className="text-xs uppercase tracking-wider text-muted-foreground">CI-Farben</Label>
        <div className="grid grid-cols-4 gap-2">
          {(["primary", "secondary", "text", "bg"] as const).map((k) => (
            <label key={k} className="space-y-1">
              <span className="text-[10px] uppercase text-muted-foreground">{k}</span>
              <div className="flex items-center gap-1">
                <input
                  type="color"
                  value={ci.colors[k]}
                  onChange={(e) => onPatchCi({ colors: { ...ci.colors, [k]: e.target.value } })}
                  className="w-8 h-8 rounded border border-border bg-transparent cursor-pointer"
                />
                <span className="text-[10px] tabular-nums text-muted-foreground truncate">
                  {ci.colors[k]}
                </span>
              </div>
            </label>
          ))}
        </div>
        <p className="text-[11px] text-muted-foreground">
          Akzent-Token „accent" / „primary" in Texten greift auf diese Farben zu.
        </p>
      </div>

      {/* Logo source */}
      <div className="space-y-2 pt-2 border-t border-border">
        <Label className="text-xs uppercase tracking-wider text-muted-foreground flex items-center gap-1">
          <ImageIcon className="w-3 h-3" /> Logo-Quelle
        </Label>

        {/* Scope toggle: alle Formate vs. nur aktives */}
        <div className="flex items-center justify-between gap-2 rounded-md border border-border bg-muted/30 px-2 py-1.5">
          <div className="text-[11px] leading-tight">
            <div className="font-semibold text-foreground">
              {applyLogoToAll
                ? `Wirkt auf alle Formate (${selectedFormatsCount})`
                : "Wirkt nur auf aktives Format"}
            </div>
            <div className="text-muted-foreground">
              Logo-Wechsel und „Kein Logo" werden entsprechend angewendet.
            </div>
          </div>
          <button
            type="button"
            onClick={() => onToggleApplyLogoToAll(!applyLogoToAll)}
            className={`shrink-0 px-2 py-1 rounded-md border text-[11px] font-semibold ${
              applyLogoToAll
                ? "border-accent bg-accent/10 text-foreground"
                : "border-border text-muted-foreground hover:border-accent/40"
            }`}
            title="Geltungsbereich umschalten"
          >
            {applyLogoToAll ? "Alle Formate" : "Nur aktives"}
          </button>
        </div>

        <div className="grid grid-cols-2 gap-1">
          <button
            type="button"
            onClick={() => manufacturerLogoUrl && setLogo(manufacturerLogoUrl)}
            disabled={!manufacturerLogoUrl}
            className={`px-2 py-1.5 rounded-md border text-xs disabled:opacity-40 ${
              usingManufacturer
                ? "border-accent bg-accent/10 text-foreground font-semibold"
                : "border-border text-muted-foreground hover:border-accent/40"
            }`}
          >
            Hersteller
          </button>
          <button
            type="button"
            onClick={() => dealerLogoUrl && setLogo(dealerLogoUrl)}
            disabled={!dealerLogoUrl}
            className={`px-2 py-1.5 rounded-md border text-xs disabled:opacity-40 ${
              usingDealer
                ? "border-accent bg-accent/10 text-foreground font-semibold"
                : "border-border text-muted-foreground hover:border-accent/40"
            }`}
          >
            Händler
          </button>
          <button
            type="button"
            onClick={() => customLogoUrl && setLogo(customLogoUrl)}
            disabled={!customLogoUrl}
            className={`px-2 py-1.5 rounded-md border text-xs disabled:opacity-40 ${
              usingCustom
                ? "border-accent bg-accent/10 text-foreground font-semibold"
                : "border-border text-muted-foreground hover:border-accent/40"
            }`}
          >
            Eigenes
          </button>
          <button
            type="button"
            onClick={() => setLogo(undefined)}
            className={`px-2 py-1.5 rounded-md border text-xs ${
              !currentLogoUrl
                ? "border-accent bg-accent/10 text-foreground font-semibold"
                : "border-border text-muted-foreground hover:border-accent/40"
            }`}
          >
            Kein Logo
          </button>
        </div>

        {/* Custom logo upload */}
        <div className="flex items-center gap-2 pt-1">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp,image/svg+xml"
            className="hidden"
            onChange={(e) => handleUpload(e.target.files?.[0])}
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading || !userId}
            className="flex-1 inline-flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-md border border-dashed border-border text-xs text-muted-foreground hover:border-accent/40 hover:text-foreground disabled:opacity-50"
          >
            {uploading
              ? <><Loader2 className="w-3 h-3 animate-spin" /> Hochladen…</>
              : <><Upload className="w-3 h-3" /> Eigenes Logo hochladen (SVG/PNG, max 5 MB)</>}
          </button>
          {customLogoUrl && (
            <img
              src={customLogoUrl}
              alt="Eigenes Logo"
              className="h-8 w-8 object-contain rounded border border-border bg-background"
            />
          )}
        </div>

        {!dealerLogoUrl && (
          <p className="text-[11px] text-muted-foreground">
            Händler-Logo fehlt — du kannst stattdessen ein eigenes Logo hochladen oder im Profil hinterlegen.
          </p>
        )}
      </div>

      {/* Logo behavior */}
      <div className="space-y-2 pt-2 border-t border-border">
        <Label className="text-xs uppercase tracking-wider text-muted-foreground flex items-center gap-1">
          <ImageIcon className="w-3 h-3" /> Logo-Einfärbung (SVG)
        </Label>
        <div className="grid grid-cols-4 gap-1">
          {LOGO_MODES.map((m) => (
            <button
              key={m.value}
              type="button"
              onClick={() => onPatchCi({ logoMode: m.value })}
              className={`px-2 py-1.5 rounded-md border text-xs ${
                ci.logoMode === m.value
                  ? "border-accent bg-accent/10 text-foreground font-semibold"
                  : "border-border text-muted-foreground hover:border-accent/40"
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>
        {ci.logoMode === "custom" && (
          <div className="flex items-center gap-2 pt-1">
            <input
              type="color"
              value={ci.logoCustomColor}
              onChange={(e) => onPatchCi({ logoCustomColor: e.target.value })}
              className="w-9 h-9 rounded border border-border cursor-pointer"
            />
            <span className="text-xs text-muted-foreground">Logo-Einfärbung (nur SVG)</span>
          </div>
        )}
        {currentLogoUrl && ci.logoMode !== "original" && logoIsSvg === false ? (
          <div className="flex items-start gap-1.5 rounded-md border border-amber-500/40 bg-amber-500/10 px-2 py-1.5 text-[11px] text-amber-700 dark:text-amber-300">
            <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-px" />
            <span>
              Das aktuell verwendete Logo ist <strong>keine SVG-Datei</strong> (vermutlich PNG/JPG/WebP)
              und kann daher nicht eingefärbt werden. Lade ein SVG hoch oder wähle ein SVG-Markenlogo,
              um die Recolor-Funktion zu nutzen.
            </span>
          </div>
        ) : currentLogoUrl && logoIsSvg === null ? (
          <p className="text-[11px] text-muted-foreground inline-flex items-center gap-1">
            <Loader2 className="w-3 h-3 animate-spin" /> Logo-Format wird geprüft…
          </p>
        ) : (
          <p className="text-[11px] text-muted-foreground">
            Recoloring funktioniert nur bei SVG-Logos. PNG/JPG werden unverändert dargestellt.
          </p>
        )}
      </div>

      {/* Profile state */}
      <div className="rounded-md border border-dashed border-border bg-muted/30 p-2.5 text-[11px] text-muted-foreground space-y-1">
        <div className="flex items-center gap-1 text-foreground font-semibold">
          <Info className="w-3 h-3" /> Profil-Daten {hasProfile ? "verbunden" : "fehlen"}
        </div>
        {hasProfile && ciContext ? (
          <div className="grid grid-cols-2 gap-x-2">
            <span>Firma: <span className="text-foreground">{ciContext.firma || "—"}</span></span>
            <span>Telefon: <span className="text-foreground">{ciContext.telefon || "—"}</span></span>
            <span>Website: <span className="text-foreground">{ciContext.website || "—"}</span></span>
            <span>Stadt: <span className="text-foreground">{ciContext.stadt || "—"}</span></span>
          </div>
        ) : (
          <span>
            Hinterlege Firma, Telefon, Website etc. im Profil — Shortcodes wie <code>{`{{firma}}`}</code> ziehen sich
            dann automatisch in deine Texte.
          </span>
        )}
      </div>
    </section>
  );
};

interface FontSelectProps {
  label: string;
  list: FontPreset[];
  value: string;
  onChange: (family: string, googleSpec?: string) => void;
}

const FontSelect: React.FC<FontSelectProps> = ({ label, list, value, onChange }) => {
  const isCustom = !findFontPreset(value, list);
  return (
    <div className="space-y-1">
      <Label className="text-[11px] text-muted-foreground">{label}</Label>
      <select
        value={isCustom ? "__custom__" : value}
        onChange={(e) => {
          const v = e.target.value;
          if (v === "__custom__") return;
          const preset = list.find((p) => p.family === v);
          onChange(v, preset?.googleSpec);
        }}
        className="w-full px-2 py-1.5 rounded-md border border-border bg-background text-sm"
        style={{ fontFamily: `"${value}", sans-serif` }}
      >
        {list.map((p) => (
          <option key={p.family} value={p.family} style={{ fontFamily: `"${p.family}", sans-serif` }}>
            {p.family}{p.note ? ` — ${p.note}` : ""}
          </option>
        ))}
        {isCustom && <option value="__custom__">{value} (eigene)</option>}
      </select>
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="text-[11px] h-7"
        placeholder="oder eigene Schrift…"
      />
    </div>
  );
};

export default CiPanel;
