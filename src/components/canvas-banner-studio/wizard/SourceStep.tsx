import React, { useRef, useState } from "react";
import { Car, Hash, FileUp, Loader2, Sparkles, Image as ImageIcon } from "lucide-react";
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

interface Props {
  selectedFormatIds: string[];
  activeFormatId: string;
  onToggleFormat: (id: string) => void;
  onSetActiveFormat: (id: string) => void;
  onPrefilled: (payload: PrefillPayload) => void;
  /** Currently linked vehicleId – pre-selects the dropdown */
  vehicleId?: string | null;
}

type Tab = "vehicle" | "vin" | "upload";

const SourceStep: React.FC<Props> = ({
  selectedFormatIds,
  activeFormatId,
  onToggleFormat,
  onSetActiveFormat,
  onPrefilled,
  vehicleId,
}) => {
  const [tab, setTab] = useState<Tab>("vehicle");
  const [busy, setBusy] = useState(false);
  const [vin, setVin] = useState("");
  const [chosenVehicle, setChosenVehicle] = useState<string | undefined>(vehicleId ?? undefined);
  const fileRef = useRef<HTMLInputElement | null>(null);

  const { data: vehicles = [], isLoading: vehiclesLoading } = useVehicles();
  const { getLogoForMake } = useVehicleMakes();

  const handleVehicle = async () => {
    const v = vehicles.find((x) => x.id === chosenVehicle);
    if (!v) { toast.error("Bitte Fahrzeug auswählen"); return; }
    setBusy(true);
    try {
      const payload = prefillFromVehicle(v, getLogoForMake);
      onPrefilled(payload);
      toast.success("Fahrzeug-Daten übernommen");
    } finally { setBusy(false); }
  };

  const handleVin = async () => {
    setBusy(true);
    try {
      const payload = await prefillFromVin(vin, getLogoForMake);
      onPrefilled(payload);
      toast.success("VIN-Daten übernommen");
    } catch (e: any) {
      toast.error(e?.message ?? "VIN-Lookup fehlgeschlagen");
    } finally { setBusy(false); }
  };

  const handleFile = async (file: File) => {
    setBusy(true);
    try {
      const payload = file.type === "application/pdf"
        ? await prefillFromPdfFile(file)
        : await prefillFromImageFile(file);
      onPrefilled(payload);
      toast.success(`${file.type === "application/pdf" ? "PDF" : "Bild"} analysiert`);
    } catch (e: any) {
      toast.error(e?.message ?? "Analyse fehlgeschlagen");
    } finally { setBusy(false); }
  };

  const cards: { key: Tab; icon: React.ElementType; title: string; desc: string }[] = [
    { key: "vehicle", icon: Car, title: "Aus Galerie", desc: "Fahrzeug aus deinem Bestand wählen – holt Bild, Daten & Logo." },
    { key: "vin", icon: Hash, title: "VIN-Lookup", desc: "17-stellige Fahrgestellnummer eingeben – Daten kommen automatisch." },
    { key: "upload", icon: FileUp, title: "PDF / Bild", desc: "Inserat oder Datenblatt hochladen – KI extrahiert die Felder." },
  ];

  return (
    <section className="space-y-5">
      <div>
        <div className="flex items-center gap-2 mb-1">
          <Sparkles className="w-4 h-4 text-accent" />
          <span className="text-xs uppercase tracking-wider text-accent font-semibold">Schritt 1</span>
        </div>
        <h2 className="font-display text-xl md:text-2xl font-bold text-foreground">
          Woher kommen die Banner-Daten?
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          Wähle eine Quelle. Wir füllen alles automatisch – Texte, Preis, Pflichtangaben & Logo.
        </p>
      </div>

      {/* Source cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {cards.map((c) => {
          const active = tab === c.key;
          const Icon = c.icon;
          return (
            <button
              key={c.key}
              type="button"
              onClick={() => setTab(c.key)}
              className={`text-left p-4 rounded-xl border transition ${
                active
                  ? "border-accent bg-accent/10 shadow-sm"
                  : "border-border bg-card hover:border-accent/40"
              }`}
            >
              <Icon className={`w-5 h-5 mb-2 ${active ? "text-accent" : "text-muted-foreground"}`} />
              <div className="font-semibold text-sm text-foreground">{c.title}</div>
              <div className="text-xs text-muted-foreground mt-1 leading-snug">{c.desc}</div>
            </button>
          );
        })}
      </div>

      {/* Active source body */}
      <div className="rounded-xl border border-border bg-card p-4 space-y-3">
        {tab === "vehicle" && (
          <>
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
            <Button onClick={handleVehicle} disabled={busy || !chosenVehicle} className="w-full">
              {busy ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Sparkles className="w-4 h-4 mr-2" />}
              Daten übernehmen
            </Button>
          </>
        )}

        {tab === "vin" && (
          <>
            <Input
              placeholder="z. B. WBA8E9C5XJK123456 (17 Zeichen)"
              value={vin}
              onChange={(e) => setVin(e.target.value.toUpperCase())}
              maxLength={17}
            />
            <Button onClick={handleVin} disabled={busy || vin.length !== 17} className="w-full">
              {busy ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Hash className="w-4 h-4 mr-2" />}
              VIN nachschlagen
            </Button>
            <p className="text-[11px] text-muted-foreground">
              Wir prüfen Hersteller-Daten und befüllen Marke, Modell, Variante und Logo automatisch.
            </p>
          </>
        )}

        {tab === "upload" && (
          <>
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
            <Button onClick={() => fileRef.current?.click()} disabled={busy} className="w-full" variant="outline">
              {busy ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <ImageIcon className="w-4 h-4 mr-2" />}
              PDF oder Bild auswählen
            </Button>
            <p className="text-[11px] text-muted-foreground">
              PDF-Inserate werden komplett analysiert (Headline, Preis, Verbrauch, Pflichtangaben).
              Bilder werden zusätzlich als Hintergrund übernommen.
            </p>
          </>
        )}
      </div>

      {/* Format chips */}
      <div className="rounded-xl border border-border bg-card p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-sm text-foreground">Zielformate</h3>
          <span className="text-[11px] text-muted-foreground">
            {selectedFormatIds.length} ausgewählt
          </span>
        </div>
        <FormatPicker
          selectedIds={selectedFormatIds}
          activeId={activeFormatId}
          onToggle={onToggleFormat}
          onSetActive={onSetActiveFormat}
        />
      </div>
    </section>
  );
};

export default SourceStep;
