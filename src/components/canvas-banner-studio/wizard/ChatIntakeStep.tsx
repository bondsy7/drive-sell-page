/**
 * Conversational intake — the user chats with the AI to provide a vehicle,
 * VIN, PDF/image or free-text overrides. Replaces the old tab-based SourceStep.
 *
 * Intent detection runs LOCALLY (no extra AI roundtrip):
 *   - 17-char alphanumeric → VIN lookup
 *   - "headline: …", "preis 19990", "cta: …" → text overrides
 *   - File upload (button or drag-and-drop) → PDF or image extraction
 *   - "fahrzeug" / "auto" / "galerie" keyword → opens vehicle picker
 *
 * Reuses prefillFromVehicle / prefillFromVin / prefillFromPdfFile / prefillFromImageFile
 * (which themselves call the existing edge functions with the user's API keys).
 */
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Bot,
  User as UserIcon,
  Paperclip,
  Send,
  Hash,
  Car,
  Sparkles,
  Loader2,
  CheckCircle2,
  Image as ImageIcon,
  FileText,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";

import { useVehicles } from "@/hooks/useVehicles";
import { useVehicleMakes } from "@/hooks/useVehicleMakes";
import {
  prefillFromVehicle,
  prefillFromVin,
  prefillFromPdfFile,
  prefillFromImageFile,
  type PrefillPayload,
} from "./prefillBannerFromSource";
import FormatPicker from "../controls/FormatPicker";
import type { BannerTextFieldKey, BannerTextFields } from "../state/types";

interface Props {
  selectedFormatIds: string[];
  activeFormatId: string;
  onToggleFormat: (id: string) => void;
  onSetActiveFormat: (id: string) => void;
  onPrefilled: (payload: PrefillPayload) => void;
  onContinue: () => void;
  /** Currently captured fields, used for the live summary. */
  textFields: BannerTextFields;
  hasBackground: boolean;
  vehicleId?: string | null;
}

type ChatRole = "assistant" | "user" | "system";
interface ChatMessage {
  id: string;
  role: ChatRole;
  content: React.ReactNode;
}

const FIELD_ALIASES: Record<string, BannerTextFieldKey> = {
  headline: "headline",
  titel: "headline",
  überschrift: "headline",
  ueberschrift: "headline",
  subline: "subline",
  untertitel: "subline",
  preis: "price",
  price: "price",
  cta: "cta",
  button: "cta",
  info: "smallInfo",
  hinweis: "smallInfo",
  rechtstext: "legalText",
  legal: "legalText",
};

function makeId() {
  return Math.random().toString(36).slice(2, 10);
}

function detectFreeTextOverrides(text: string): Partial<BannerTextFields> {
  const out: Partial<BannerTextFields> = {};
  // "headline: foo", "preis 19990", "preis = 19.990 €"
  const re = /(headline|titel|überschrift|ueberschrift|subline|untertitel|preis|price|cta|button|info|hinweis|rechtstext|legal)\s*[:=]?\s*(.+?)(?=\s+(?:headline|titel|subline|untertitel|preis|price|cta|button|info|hinweis|rechtstext|legal)\s*[:=]|$)/giu;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const key = FIELD_ALIASES[m[1].toLowerCase()];
    const val = m[2].trim().replace(/[,;.]+$/, "");
    if (key && val) out[key] = val;
  }
  return out;
}

const VIN_RE = /\b([A-HJ-NPR-Z0-9]{17})\b/i;

const ChatIntakeStep: React.FC<Props> = ({
  selectedFormatIds,
  activeFormatId,
  onToggleFormat,
  onSetActiveFormat,
  onPrefilled,
  onContinue,
  textFields,
  hasBackground,
  vehicleId,
}) => {
  const { data: vehicles = [], isLoading: vehiclesLoading } = useVehicles();
  const { getLogoForMake } = useVehicleMakes();

  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "greet",
      role: "assistant",
      content: (
        <>
          Hi 👋 Ich bau dir gleich ein Banner. Hast du <strong>ein PDF/Foto</strong>, eine{" "}
          <strong>VIN</strong>, oder soll ich ein <strong>Fahrzeug aus deiner Galerie</strong>{" "}
          nehmen?
          <div className="text-xs text-muted-foreground mt-1">
            Tipp: Du kannst auch einfach Text wie „Preis 19.990€" oder „Headline: Sommer-Sale" schreiben.
          </div>
        </>
      ),
    },
  ]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [chosenVehicle, setChosenVehicle] = useState<string | undefined>(vehicleId ?? undefined);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, busy]);

  const push = (m: Omit<ChatMessage, "id">) =>
    setMessages((prev) => [...prev, { ...m, id: makeId() }]);

  const summary = useMemo(() => {
    const items: { label: string; value: string }[] = [];
    if (textFields.headline) items.push({ label: "Headline", value: textFields.headline });
    if (textFields.subline) items.push({ label: "Subline", value: textFields.subline });
    if (textFields.price) items.push({ label: "Preis", value: textFields.price });
    if (textFields.cta) items.push({ label: "CTA", value: textFields.cta });
    if (textFields.smallInfo) items.push({ label: "Info", value: textFields.smallInfo });
    return items;
  }, [textFields]);

  const ready = hasBackground || summary.length > 0;

  /* ---------------- handlers ---------------- */

  const applyPayload = (p: PrefillPayload, friendly: string) => {
    onPrefilled(p);
    const list = Object.entries(p.textFields)
      .filter(([, v]) => v && String(v).trim())
      .map(([k, v]) => `• ${k}: ${String(v).slice(0, 60)}`);
    push({
      role: "assistant",
      content: (
        <>
          <div className="flex items-center gap-1.5 text-emerald-600 font-medium text-sm">
            <CheckCircle2 className="w-4 h-4" /> {friendly}
          </div>
          {list.length > 0 && (
            <pre className="mt-1 text-[11px] whitespace-pre-wrap text-muted-foreground font-sans">
              {list.join("\n")}
            </pre>
          )}
          {p.backgroundDataUrl && (
            <div className="text-[11px] text-muted-foreground mt-1">
              Hintergrundbild übernommen — KI passt das Layout automatisch an.
            </div>
          )}
        </>
      ),
    });
  };

  const handleVehiclePick = async () => {
    const v = vehicles.find((x) => x.id === chosenVehicle);
    if (!v) return;
    setPickerOpen(false);
    setBusy(true);
    try {
      const payload = prefillFromVehicle(v, getLogoForMake);
      applyPayload(payload, `Fahrzeug „${[v.brand, v.model].filter(Boolean).join(" ")}" übernommen`);
    } finally {
      setBusy(false);
    }
  };

  const handleFile = async (file: File) => {
    push({
      role: "user",
      content: (
        <span className="inline-flex items-center gap-1.5">
          {file.type === "application/pdf" ? <FileText className="w-3.5 h-3.5" /> : <ImageIcon className="w-3.5 h-3.5" />}
          {file.name}
        </span>
      ),
    });
    push({
      role: "assistant",
      content: (
        <span className="inline-flex items-center gap-1.5 text-muted-foreground">
          <Loader2 className="w-3.5 h-3.5 animate-spin" /> Analysiere {file.type === "application/pdf" ? "PDF" : "Bild"}…
        </span>
      ),
    });
    setBusy(true);
    try {
      const payload =
        file.type === "application/pdf"
          ? await prefillFromPdfFile(file)
          : await prefillFromImageFile(file);
      applyPayload(payload, `${file.type === "application/pdf" ? "PDF" : "Bild"} analysiert`);
    } catch (e: any) {
      push({ role: "assistant", content: <span className="text-destructive">⚠ {e?.message ?? "Analyse fehlgeschlagen"}</span> });
    } finally {
      setBusy(false);
    }
  };

  const handleVin = async (vin: string) => {
    setBusy(true);
    push({
      role: "assistant",
      content: (
        <span className="inline-flex items-center gap-1.5 text-muted-foreground">
          <Loader2 className="w-3.5 h-3.5 animate-spin" /> Schlage VIN nach…
        </span>
      ),
    });
    try {
      const payload = await prefillFromVin(vin, getLogoForMake);
      applyPayload(payload, `VIN ${vin.toUpperCase()} übernommen`);
    } catch (e: any) {
      push({ role: "assistant", content: <span className="text-destructive">⚠ {e?.message ?? "VIN-Lookup fehlgeschlagen"}</span> });
    } finally {
      setBusy(false);
    }
  };

  const handleSend = async () => {
    const text = input.trim();
    if (!text || busy) return;
    push({ role: "user", content: text });
    setInput("");

    // VIN?
    const vinMatch = text.match(VIN_RE);
    if (vinMatch) {
      await handleVin(vinMatch[1].toUpperCase());
      return;
    }

    // Free-text field overrides?
    const overrides = detectFreeTextOverrides(text);
    if (Object.keys(overrides).length) {
      onPrefilled({ source: "image", textFields: overrides });
      push({
        role: "assistant",
        content: (
          <>
            <div className="flex items-center gap-1.5 text-emerald-600 font-medium text-sm">
              <CheckCircle2 className="w-4 h-4" /> Übernommen
            </div>
            <pre className="mt-1 text-[11px] whitespace-pre-wrap text-muted-foreground font-sans">
              {Object.entries(overrides).map(([k, v]) => `• ${k}: ${v}`).join("\n")}
            </pre>
          </>
        ),
      });
      return;
    }

    // Keyword routing
    const lower = text.toLowerCase();
    if (/(galerie|fahrzeug|auto|bestand|wagen)/.test(lower)) {
      setPickerOpen(true);
      push({
        role: "assistant",
        content: "Klar — wähl unten ein Fahrzeug aus deiner Galerie.",
      });
      return;
    }
    if (/(pdf|datei|bild|foto|hochlade|upload|inserat)/.test(lower)) {
      push({ role: "assistant", content: "Tipp ich auf das Klammer-Symbol — dort kannst du PDF oder Bild hochladen." });
      fileRef.current?.click();
      return;
    }
    if (/^vin/i.test(text)) {
      push({ role: "assistant", content: "Schick mir die 17-stellige Fahrgestellnummer — ich erkenne sie automatisch." });
      return;
    }

    push({
      role: "assistant",
      content: (
        <>
          Verstanden hab ich das nicht ganz. Versuch:
          <ul className="list-disc list-inside text-xs text-muted-foreground mt-1 space-y-0.5">
            <li>Eine 17-stellige VIN (z. B. WBA8E9C5XJK123456)</li>
            <li>„Preis 19.990€" oder „Headline: Sommer-Sale"</li>
            <li>„Galerie" um ein Fahrzeug auszuwählen</li>
            <li>Tippe auf 📎 um ein PDF/Bild hochzuladen</li>
          </ul>
        </>
      ),
    });
  };

  /* ---------------- render ---------------- */

  return (
    <section className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-4">
      {/* Chat column */}
      <div className="rounded-2xl border border-border bg-card flex flex-col overflow-hidden h-[calc(100vh-280px)] min-h-[460px]">
        <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3">
          {messages.map((m) => (
            <div
              key={m.id}
              className={`flex gap-2 ${m.role === "user" ? "flex-row-reverse" : "flex-row"}`}
            >
              <div
                className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 ${
                  m.role === "user" ? "bg-accent text-accent-foreground" : "bg-muted text-foreground"
                }`}
              >
                {m.role === "user" ? <UserIcon className="w-3.5 h-3.5" /> : <Bot className="w-3.5 h-3.5" />}
              </div>
              <div
                className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm ${
                  m.role === "user"
                    ? "bg-accent text-accent-foreground rounded-tr-sm"
                    : "bg-muted text-foreground rounded-tl-sm"
                }`}
              >
                {m.content}
              </div>
            </div>
          ))}

          {pickerOpen && (
            <div className="flex gap-2">
              <div className="w-7 h-7 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
                <Bot className="w-3.5 h-3.5" />
              </div>
              <div className="bg-muted rounded-2xl rounded-tl-sm p-3 space-y-2 max-w-[80%] w-full">
                <Select value={chosenVehicle} onValueChange={setChosenVehicle}>
                  <SelectTrigger>
                    <SelectValue placeholder={vehiclesLoading ? "Lade Fahrzeuge…" : "Fahrzeug wählen"} />
                  </SelectTrigger>
                  <SelectContent>
                    {vehicles.map((v) => (
                      <SelectItem key={v.id} value={v.id}>
                        {[v.brand, v.model, v.year && `(${v.year})`].filter(Boolean).join(" ") || v.title || v.vin}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button onClick={handleVehiclePick} disabled={busy || !chosenVehicle} className="w-full" size="sm">
                  {busy ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> : <Sparkles className="w-3.5 h-3.5 mr-1" />}
                  Übernehmen
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Quick actions */}
        <div className="px-3 py-2 border-t border-border bg-background/40 flex flex-wrap gap-1.5">
          <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => fileRef.current?.click()} disabled={busy}>
            <Paperclip className="w-3 h-3 mr-1" /> PDF/Foto
          </Button>
          <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setPickerOpen((v) => !v)} disabled={busy}>
            <Car className="w-3 h-3 mr-1" /> Galerie
          </Button>
          <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => { setInput("VIN "); }} disabled={busy}>
            <Hash className="w-3 h-3 mr-1" /> VIN
          </Button>
        </div>

        {/* Input */}
        <div className="p-2 border-t border-border bg-background flex gap-2">
          <input
            ref={fileRef}
            type="file"
            accept="application/pdf,image/*"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void handleFile(f);
              e.target.value = "";
            }}
          />
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void handleSend();
              }
            }}
            placeholder="VIN, 'Preis 19.990€', 'Galerie', oder einfach plaudern..."
            disabled={busy}
            className="flex-1"
          />
          <Button onClick={handleSend} disabled={busy || !input.trim()} size="icon">
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          </Button>
        </div>
      </div>

      {/* Side: live summary + formats + continue */}
      <aside className="space-y-3">
        <div className="rounded-2xl border border-border bg-card p-4 space-y-2">
          <div className="flex items-center gap-1.5">
            <Sparkles className="w-4 h-4 text-accent" />
            <h3 className="font-semibold text-sm text-foreground">Aufgenommen</h3>
          </div>
          {summary.length === 0 && !hasBackground ? (
            <p className="text-xs text-muted-foreground">Noch nichts. Schick mir oben eine Quelle.</p>
          ) : (
            <ul className="text-xs space-y-1">
              {hasBackground && (
                <li className="flex items-center gap-1.5 text-emerald-600">
                  <CheckCircle2 className="w-3 h-3" /> Hintergrundbild
                </li>
              )}
              {summary.map((s) => (
                <li key={s.label} className="text-foreground">
                  <span className="text-muted-foreground">{s.label}:</span>{" "}
                  <span className="font-medium">{s.value}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="rounded-2xl border border-border bg-card p-4 space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-sm text-foreground">Formate</h3>
            <span className="text-[11px] text-muted-foreground">{selectedFormatIds.length} aktiv</span>
          </div>
          <FormatPicker
            selectedIds={selectedFormatIds}
            activeId={activeFormatId}
            onToggle={onToggleFormat}
            onSetActive={onSetActiveFormat}
          />
        </div>

        <Button
          className="w-full"
          disabled={!ready}
          onClick={onContinue}
        >
          Weiter zum Studio
        </Button>
        {!ready && (
          <p className="text-[11px] text-muted-foreground text-center">
            Mindestens Headline oder Hintergrundbild erforderlich.
          </p>
        )}
      </aside>
    </section>
  );
};

export default ChatIntakeStep;
