import React from "react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import type { BannerComposition, BannerLayer, BannerTextFieldKey, BannerTextFields, CiState, TextAlign } from "../state/types";
import { AlignCenter, AlignLeft, AlignRight, Bold, Eye, EyeOff, ArrowUp, ArrowDown } from "lucide-react";
import { SHORTCODES } from "../ci/shortcodes";
import type { CiContext } from "../ci/profileSources";
import { DISPLAY_FONTS, BODY_FONTS, findFontPreset } from "../ci/fontCatalog";
import { ensureFontLoaded } from "../ci/fontLoader";

const FIELDS: { key: BannerTextFieldKey; label: string; placeholder: string; layerId: string; multiline?: boolean }[] = [
  { key: "headline", label: "Headline", placeholder: "DER NEUE VW GOLF", layerId: "headline" },
  { key: "subline", label: "Subline", placeholder: "Jetzt sichern mit attraktiver Leasingrate", layerId: "subline" },
  { key: "price", label: "Preis / Rate", placeholder: "ab 249 € mtl.", layerId: "price" },
  { key: "cta", label: "Call-to-Action", placeholder: "Jetzt Angebot anfragen", layerId: "cta" },
  { key: "smallInfo", label: "Kleine Info", placeholder: "Nur für kurze Zeit verfügbar", layerId: "smallInfo" },
  { key: "legalText", label: "Rechtshinweis (Pflichtangaben)", placeholder: "Kraftstoffverbrauch …", layerId: "legal", multiline: true },
];

const COLOR_TOKENS: { token: string; label: string }[] = [
  { token: "background", label: "Hell" },
  { token: "foreground", label: "Dunkel" },
  { token: "accent", label: "Akzent" },
  { token: "primary", label: "Primary" },
];

interface Props {
  textFields: BannerTextFields;
  composition: BannerComposition;
  onChangeText: (key: BannerTextFieldKey, value: string) => void;
  onPatchLayer: (layerId: string, patch: Partial<BannerLayer>) => void;
  onReorderLayer?: (layerId: string, direction: "forward" | "backward") => void;
  /** Optional: nur Shortcodes anzeigen, für die Werte existieren. */
  ciContext?: CiContext | null;
  /** Optional: zusätzliche CI/Template-Farben als Swatches. */
  ciColors?: CiState["colors"];
}

const TextFieldsPanel: React.FC<Props> = ({ textFields, composition, onChangeText, onPatchLayer, onReorderLayer, ciContext, ciColors }) => {
  const shortcodes = ciContext
    ? SHORTCODES.filter((s) => {
        const key = s.code.replace(/[{}]/g, "").trim().toLowerCase();
        const v = (ciContext as any)[key];
        return v != null && String(v) !== "";
      })
    : SHORTCODES;
  const ciSwatches: { value: string; label: string }[] = ciColors
    ? [
        { value: ciColors.primary, label: "CI Primary" },
        { value: ciColors.secondary, label: "CI Secondary" },
        { value: ciColors.text, label: "CI Text" },
        { value: ciColors.bg, label: "CI Hintergrund" },
      ].filter((c) => !!c.value)
    : [];
  const layerById = (id: string) => composition.layers.find((l) => l.id === id);

  const insertCode = (key: BannerTextFieldKey, code: string) => {
    const cur = textFields[key] ?? "";
    const sep = cur && !cur.endsWith(" ") ? " " : "";
    onChangeText(key, cur + sep + code);
  };

  return (
    <div className="space-y-5">
      {shortcodes.length > 0 && (
        <div className="rounded-md border border-dashed border-border bg-muted/30 p-2.5">
          <div className="text-[11px] font-semibold text-foreground mb-1">Shortcodes (klick = einfügen in Headline)</div>
          <div className="flex flex-wrap gap-1">
            {shortcodes.map((s) => (
              <button
                key={s.code}
                type="button"
                onClick={() => insertCode("headline", s.code)}
                title={s.label}
                className="text-[10px] px-1.5 py-0.5 rounded border border-border bg-background hover:border-accent/40 text-muted-foreground hover:text-foreground"
              >
                {s.code}
              </button>
            ))}
          </div>
          <p className="text-[10px] text-muted-foreground mt-1.5">
            Werden beim Rendern automatisch durch Profil- & Fahrzeugdaten ersetzt.
          </p>
        </div>
      )}
      {FIELDS.map((f) => {
        const layer = layerById(f.layerId);
        if (!layer) return null;
        return (
          <div key={f.key} className="rounded-lg border border-border bg-card p-3 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <Label className="text-sm font-semibold">{f.label}</Label>
              <div className="flex items-center gap-0.5">
                {onReorderLayer && (
                  <>
                    <button
                      type="button"
                      onClick={() => onReorderLayer(layer.id, "backward")}
                      className="p-1 text-muted-foreground hover:text-foreground"
                      title="Eine Ebene nach hinten"
                      aria-label="Eine Ebene nach hinten"
                    >
                      <ArrowUp className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => onReorderLayer(layer.id, "forward")}
                      className="p-1 text-muted-foreground hover:text-foreground"
                      title="Eine Ebene nach vorne"
                      aria-label="Eine Ebene nach vorne"
                    >
                      <ArrowDown className="w-4 h-4" />
                    </button>
                  </>
                )}
                <button
                  type="button"
                  onClick={() => onPatchLayer(layer.id, { visible: !layer.visible })}
                  className="text-muted-foreground hover:text-foreground p-1"
                  aria-label={layer.visible ? "Ausblenden" : "Einblenden"}
                >
                  {layer.visible ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                </button>
              </div>
            </div>
            {f.multiline ? (
              <Textarea
                rows={3}
                value={textFields[f.key]}
                placeholder={f.placeholder}
                onChange={(e) => onChangeText(f.key, e.target.value)}
              />
            ) : (
              <Input
                value={textFields[f.key]}
                placeholder={f.placeholder}
                onChange={(e) => onChangeText(f.key, e.target.value)}
              />
            )}
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <span>Größe</span>
                <input
                  type="range"
                  min={10}
                  max={Math.max(40, (layer.fontSize ?? 24) * 3)}
                  value={layer.fontSize ?? 24}
                  onChange={(e) => onPatchLayer(layer.id, { fontSize: Number(e.target.value) })}
                  className="accent-[hsl(var(--accent))]"
                />
                <span className="tabular-nums w-8 text-right">{layer.fontSize}</span>
              </div>
              <button
                type="button"
                onClick={() =>
                  onPatchLayer(layer.id, { fontWeight: (layer.fontWeight ?? 400) >= 600 ? 400 : 800 })
                }
                className={`p-1.5 rounded border ${
                  (layer.fontWeight ?? 400) >= 600 ? "border-accent bg-accent/10" : "border-border"
                }`}
                aria-label="Fett"
              >
                <Bold className="w-3.5 h-3.5" />
              </button>
              <div className="flex gap-0.5 border border-border rounded">
                {(["left", "center", "right"] as TextAlign[]).map((a) => {
                  const Icon = a === "left" ? AlignLeft : a === "center" ? AlignCenter : AlignRight;
                  return (
                    <button
                      key={a}
                      type="button"
                      onClick={() => onPatchLayer(layer.id, { align: a })}
                      className={`p-1.5 ${layer.align === a ? "bg-accent/15 text-foreground" : "text-muted-foreground"}`}
                    >
                      <Icon className="w-3.5 h-3.5" />
                    </button>
                  );
                })}
              </div>
              <div className="flex gap-1 flex-wrap">
                {COLOR_TOKENS.map((c) => (
                  <button
                    key={c.token}
                    type="button"
                    onClick={() => onPatchLayer(layer.id, { color: c.token })}
                    title={c.label}
                    className={`w-6 h-6 rounded-full border-2 ${
                      layer.color === c.token ? "border-foreground" : "border-border"
                    }`}
                    style={{ background: `hsl(var(--${c.token}))` }}
                  />
                ))}
                {ciSwatches.map((c) => (
                  <button
                    key={`ci-${c.value}`}
                    type="button"
                    onClick={() => onPatchLayer(layer.id, { color: c.value })}
                    title={c.label}
                    className={`w-6 h-6 rounded-full border-2 ${
                      (layer.color ?? "").toLowerCase() === c.value.toLowerCase()
                        ? "border-foreground"
                        : "border-border"
                    }`}
                    style={{ background: c.value }}
                  />
                ))}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default TextFieldsPanel;
