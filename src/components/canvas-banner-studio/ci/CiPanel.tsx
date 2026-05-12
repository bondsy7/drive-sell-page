import React from "react";
import { Palette, Type, ImageIcon, Info } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { BRAND_PRESETS, getBrandPreset } from "./brandPresets";
import type { CiState, LogoMode } from "../state/types";
import type { CiContext } from "./profileSources";

interface CiPanelProps {
  ci: CiState;
  ciContext?: CiContext | null;
  hasProfile: boolean;
  detectedBrandKey?: string;
  /** Aktuelles Logo im Banner (Hersteller- oder Händler-Logo) */
  currentLogoUrl?: string;
  /** Hersteller-Logo aus Fahrzeug-Marke (für Quick-Switch) */
  manufacturerLogoUrl?: string;
  /** Händler-Logo aus Profil */
  dealerLogoUrl?: string;
  onApplyBrandPreset: (brandKey: string) => void;
  onPatchCi: (patch: Partial<CiState>) => void;
  onSetLogo: (url?: string) => void;
}

const LOGO_MODES: { value: LogoMode; label: string }[] = [
  { value: "original", label: "Original" },
  { value: "monochrome-light", label: "Weiß" },
  { value: "monochrome-dark", label: "Schwarz" },
  { value: "custom", label: "Custom" },
];

const CiPanel: React.FC<CiPanelProps> = ({
  ci, ciContext, hasProfile, detectedBrandKey, currentLogoUrl,
  manufacturerLogoUrl, dealerLogoUrl, onApplyBrandPreset, onPatchCi, onSetLogo,
}) => {
  const preset = getBrandPreset(ci.brandKey);
  const usingDealer = !!currentLogoUrl && !!dealerLogoUrl && currentLogoUrl === dealerLogoUrl;
  const usingManufacturer = !!currentLogoUrl && !!manufacturerLogoUrl && currentLogoUrl === manufacturerLogoUrl;


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
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1">
          <Label className="text-[11px] flex items-center gap-1 text-muted-foreground">
            <Type className="w-3 h-3" /> Display-Font
          </Label>
          <Input
            value={ci.fontDisplay}
            onChange={(e) => onPatchCi({ fontDisplay: e.target.value })}
            className="text-sm"
            placeholder="Space Grotesk"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-[11px] flex items-center gap-1 text-muted-foreground">
            <Type className="w-3 h-3" /> Body-Font
          </Label>
          <Input
            value={ci.fontBody}
            onChange={(e) => onPatchCi({ fontBody: e.target.value })}
            className="text-sm"
            placeholder="Inter"
          />
        </div>
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
        <div className="grid grid-cols-3 gap-1">
          <button
            type="button"
            onClick={() => manufacturerLogoUrl && onSetLogo(manufacturerLogoUrl)}
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
            onClick={() => dealerLogoUrl && onSetLogo(dealerLogoUrl)}
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
            onClick={() => onSetLogo(undefined)}
            className={`px-2 py-1.5 rounded-md border text-xs ${
              !currentLogoUrl
                ? "border-accent bg-accent/10 text-foreground font-semibold"
                : "border-border text-muted-foreground hover:border-accent/40"
            }`}
          >
            Kein Logo
          </button>
        </div>
        {!dealerLogoUrl && (
          <p className="text-[11px] text-muted-foreground">
            Händler-Logo fehlt — bitte im Profil ein Logo hinterlegen.
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
        <p className="text-[11px] text-muted-foreground">
          Recoloring funktioniert nur bei SVG-Logos. PNGs werden unverändert dargestellt.
        </p>
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

export default CiPanel;
