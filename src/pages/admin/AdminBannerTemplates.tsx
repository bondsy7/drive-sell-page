import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { BANNER_FORMATS } from "@/components/canvas-banner-studio/data/formats";
import { LAYOUT_TEMPLATES } from "@/components/canvas-banner-studio/data/layoutTemplates";
import { getBundledSpec } from "@/components/canvas-banner-studio/data/bundledTemplates";
import { invalidateTemplateCache } from "@/components/canvas-banner-studio/data/templateRegistry";
import { specToBannerLayers } from "@/components/canvas-banner-studio/data/templateToLayers";
import type { TemplateSpec } from "@/components/canvas-banner-studio/data/templateSchema";
import { BRAND_PRESETS } from "@/components/canvas-banner-studio/ci/brandPresets";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import { Loader2, Save, RotateCcw, Trash2 } from "lucide-react";

type Row = {
  id: string;
  template_id: string;
  format_id: string;
  name: string;
  spec: TemplateSpec;
  is_global: boolean;
  user_id: string | null;
  brand_key: string | null;
  updated_at: string;
};

const DUMMY_TEXT: Record<string, string> = {
  headline: "DER NEUE GOLF",
  subline: "Jetzt Probefahrt sichern",
  price: "ab 249 € mtl.",
  cta: "Angebot anfragen",
  smallInfo: "Limitiert",
  legalText: "Verbrauch komb.: 5,8 l/100 km · CO₂: 132 g/km · Klasse D.",
};

function Preview({ spec }: { spec: TemplateSpec | null }) {
  if (!spec) return null;
  const layers = useMemo(() => specToBannerLayers(spec), [spec]);
  const { width, height } = spec.format;
  const maxW = 520;
  const scale = Math.min(maxW / width, 480 / height);
  return (
    <div
      className="relative bg-muted border border-border rounded overflow-hidden mx-auto"
      style={{ width: width * scale, height: height * scale }}
    >
      <div
        className="absolute inset-0"
        style={{
          backgroundImage:
            "linear-gradient(135deg, hsl(var(--muted)), hsl(var(--accent) / 0.15))",
        }}
      />
      {/* safe area */}
      <div
        className="absolute border border-dashed border-accent/40 pointer-events-none"
        style={{
          left: spec.safeArea.left * scale,
          top: spec.safeArea.top * scale,
          right: spec.safeArea.right * scale,
          bottom: spec.safeArea.bottom * scale,
        }}
      />
      {layers.map((l) => {
        if (!l.visible) return null;
        if (l.type === "image" || l.type === "overlay") return null;
        const txt = l.field ? DUMMY_TEXT[l.field] ?? l.id : l.id;
        const isLogo = l.type === "logo";
        return (
          <div
            key={l.id}
            className="absolute"
            style={{
              left: (l.x ?? 0) * scale,
              top: (l.y ?? 0) * scale,
              width: (l.width ?? 100) * scale,
              height: l.height ? l.height * scale : "auto",
              fontSize: (l.fontSize ?? 16) * scale,
              fontWeight: l.fontWeight ?? 400,
              textAlign: l.align ?? "left",
              color: "white",
              textShadow: "0 1px 2px rgba(0,0,0,0.6)",
              lineHeight: 1.15,
              outline: "1px dashed rgba(255,255,255,0.35)",
              backgroundColor: isLogo ? "rgba(255,255,255,0.85)" : "transparent",
              display: "flex",
              alignItems: isLogo ? "center" : undefined,
              justifyContent: isLogo ? "center" : undefined,
            }}
          >
            {isLogo ? (
              <span style={{ color: "#333", fontSize: 10 * scale }}>LOGO</span>
            ) : (
              txt
            )}
          </div>
        );
      })}
    </div>
  );
}

export default function AdminBannerTemplates() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterTpl, setFilterTpl] = useState<string>("classic-offer");
  const [filterFmt, setFilterFmt] = useState<string>(BANNER_FORMATS[0].id);
  const [filterBrand, setFilterBrand] = useState<string>("__none__");

  const [draft, setDraft] = useState<TemplateSpec | null>(null);
  const [draftJson, setDraftJson] = useState("");
  const [draftRow, setDraftRow] = useState<Row | null>(null);
  const [saving, setSaving] = useState(false);
  const [jsonError, setJsonError] = useState<string | null>(null);

  const fetchRows = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("banner_templates")
      .select("*")
      .order("updated_at", { ascending: false });
    if (error) {
      toast({ title: "Fehler beim Laden", description: error.message });
    } else {
      setRows((data ?? []) as unknown as Row[]);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchRows();
  }, []);

  const currentRow = useMemo(() => {
    return rows.find(
      (r) =>
        r.template_id === filterTpl &&
        r.format_id === filterFmt &&
        (filterBrand === "__none__" ? !r.brand_key : r.brand_key === filterBrand) &&
        r.is_global,
    );
  }, [rows, filterTpl, filterFmt, filterBrand]);

  const openEditor = () => {
    const base =
      (currentRow?.spec as TemplateSpec | undefined) ??
      getBundledSpec(filterFmt, filterTpl) ??
      null;
    if (!base) {
      toast({ title: "Kein Bundle-Template gefunden" });
      return;
    }
    setDraft(base);
    setDraftJson(JSON.stringify(base, null, 2));
    setDraftRow(currentRow ?? null);
    setJsonError(null);
  };

  const onJsonChange = (val: string) => {
    setDraftJson(val);
    try {
      const parsed = JSON.parse(val) as TemplateSpec;
      if (!parsed.layers || !parsed.format) {
        setJsonError("Spec braucht 'format' und 'layers'.");
        return;
      }
      setDraft(parsed);
      setJsonError(null);
    } catch (e) {
      setJsonError(e instanceof Error ? e.message : String(e));
    }
  };

  const save = async () => {
    if (!draft || jsonError) return;
    setSaving(true);
    const payload = {
      template_id: filterTpl,
      format_id: filterFmt,
      name: draft.name || `${filterTpl} – ${filterFmt}`,
      spec: draft as never,
      is_global: true,
      brand_key: filterBrand === "__none__" ? null : filterBrand,
    };
    const op = draftRow
      ? supabase
          .from("banner_templates")
          .update(payload)
          .eq("id", draftRow.id)
      : supabase.from("banner_templates").insert(payload);
    const { error } = await op;
    setSaving(false);
    if (error) {
      toast({ title: "Speichern fehlgeschlagen", description: error.message });
      return;
    }
    invalidateTemplateCache();
    toast({ title: "Template gespeichert" });
    setDraft(null);
    fetchRows();
  };

  const resetToBundle = async () => {
    if (!currentRow) return;
    if (!confirm("Diese Variante löschen und auf Bundle-Default zurücksetzen?")) return;
    const { error } = await supabase
      .from("banner_templates")
      .delete()
      .eq("id", currentRow.id);
    if (error) {
      toast({ title: "Fehler", description: error.message });
      return;
    }
    invalidateTemplateCache();
    toast({ title: "Auf Bundle zurückgesetzt" });
    setDraft(null);
    fetchRows();
  };

  const previewSpec = draft ?? currentRow?.spec ?? getBundledSpec(filterFmt, filterTpl);

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-7xl">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Banner-Templates</h1>
        <p className="text-sm text-muted-foreground">
          Pflege globale Layouts pro Format, optional als CI-Variante pro Marke.
          Wenn keine DB-Variante existiert, gilt der Code-Bundle-Default.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div>
          <Label>Template</Label>
          <Select value={filterTpl} onValueChange={setFilterTpl}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {LAYOUT_TEMPLATES.map((t) => (
                <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Format</Label>
          <Select value={filterFmt} onValueChange={setFilterFmt}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {BANNER_FORMATS.map((f) => (
                <SelectItem key={f.id} value={f.id}>
                  {f.name} ({f.width}×{f.height})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>CI-Variante</Label>
          <Select value={filterBrand} onValueChange={setFilterBrand}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">Globaler Default (alle Marken)</SelectItem>
              {BRAND_PRESETS.filter((b) => b.key !== "custom").map((b) => (
                <SelectItem key={b.key} value={b.key}>{b.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <Badge variant={currentRow ? "default" : "secondary"}>
          {currentRow ? "DB-Variante aktiv" : "Bundle-Default"}
        </Badge>
        {currentRow && (
          <span className="text-xs text-muted-foreground">
            zuletzt geändert: {new Date(currentRow.updated_at).toLocaleString()}
          </span>
        )}
        <div className="ml-auto flex gap-2">
          {!draft && <Button onClick={openEditor}>Bearbeiten</Button>}
          {currentRow && !draft && (
            <Button variant="outline" onClick={resetToBundle}>
              <Trash2 className="w-4 h-4 mr-1" /> Variante löschen
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label>Spec (JSON)</Label>
            {draft && (
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    const base = getBundledSpec(filterFmt, filterTpl);
                    if (base) {
                      setDraft(base);
                      setDraftJson(JSON.stringify(base, null, 2));
                      setJsonError(null);
                    }
                  }}
                >
                  <RotateCcw className="w-4 h-4 mr-1" /> Bundle laden
                </Button>
                <Button size="sm" onClick={save} disabled={saving || !!jsonError}>
                  {saving ? (
                    <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                  ) : (
                    <Save className="w-4 h-4 mr-1" />
                  )}
                  Speichern
                </Button>
              </div>
            )}
          </div>
          {draft ? (
            <>
              <Textarea
                value={draftJson}
                onChange={(e) => onJsonChange(e.target.value)}
                rows={28}
                className="font-mono text-xs"
              />
              {jsonError && (
                <p className="text-xs text-destructive">{jsonError}</p>
              )}
            </>
          ) : (
            <pre className="text-xs bg-muted rounded p-3 overflow-auto max-h-[600px]">
              {JSON.stringify(previewSpec, null, 2)}
            </pre>
          )}
        </div>

        <div className="space-y-2">
          <Label>Live-Vorschau</Label>
          <div className="border border-border rounded-lg p-4 bg-card">
            <Preview spec={previewSpec ?? null} />
          </div>
          {previewSpec && (
            <p className="text-xs text-muted-foreground text-center">
              {previewSpec.format.width}×{previewSpec.format.height}px ·{" "}
              {previewSpec.layers.length} Ebenen
            </p>
          )}
        </div>
      </div>

      <div>
        <h2 className="text-lg font-semibold mt-6 mb-2">
          Alle DB-Varianten ({rows.length})
        </h2>
        {loading ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          <div className="border border-border rounded overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted">
                <tr className="text-left">
                  <th className="p-2">Template</th>
                  <th className="p-2">Format</th>
                  <th className="p-2">Brand</th>
                  <th className="p-2">Scope</th>
                  <th className="p-2">Geändert</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr
                    key={r.id}
                    className="border-t border-border hover:bg-muted/50 cursor-pointer"
                    onClick={() => {
                      setFilterTpl(r.template_id);
                      setFilterFmt(r.format_id);
                      setFilterBrand(r.brand_key ?? "__none__");
                    }}
                  >
                    <td className="p-2">{r.template_id}</td>
                    <td className="p-2">{r.format_id}</td>
                    <td className="p-2">{r.brand_key ?? "—"}</td>
                    <td className="p-2">{r.is_global ? "global" : "user"}</td>
                    <td className="p-2 text-xs text-muted-foreground">
                      {new Date(r.updated_at).toLocaleString()}
                    </td>
                  </tr>
                ))}
                {rows.length === 0 && (
                  <tr>
                    <td colSpan={5} className="p-4 text-center text-muted-foreground">
                      Noch keine DB-Varianten – alle Templates kommen aus dem Code-Bundle.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
