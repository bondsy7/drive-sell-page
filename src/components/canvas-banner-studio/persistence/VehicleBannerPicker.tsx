import React, { useMemo } from "react";
import { Car, Link2, Link2Off } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { useVehicles } from "@/hooks/useVehicles";

interface Props {
  vehicleId?: string | null;
  projectTitle?: string;
  onChangeVehicle: (vehicleId: string | null | undefined) => void;
  onChangeTitle: (title: string) => void;
  bannerProjectId?: string;
}

const NO_VEHICLE = "__no_vehicle__";
const NONE = "__none__";

const VehicleBannerPicker: React.FC<Props> = ({
  vehicleId,
  projectTitle,
  onChangeVehicle,
  onChangeTitle,
  bannerProjectId,
}) => {
  const { data: vehicles = [], isLoading } = useVehicles();

  const value = useMemo(() => {
    if (vehicleId === null) return NO_VEHICLE;
    if (!vehicleId) return NONE;
    return vehicleId;
  }, [vehicleId]);

  const handleChange = (v: string) => {
    if (v === NONE) onChangeVehicle(undefined);
    else if (v === NO_VEHICLE) onChangeVehicle(null);
    else onChangeVehicle(v);
  };

  return (
    <section className="rounded-xl border border-border bg-card p-3 md:p-4 space-y-3">
      <div className="flex items-center gap-2">
        <Car className="w-4 h-4 text-accent" />
        <h2 className="font-semibold text-foreground text-sm">
          Schritt 0 · Fahrzeug verknüpfen
        </h2>
        {bannerProjectId ? (
          <span className="ml-auto inline-flex items-center gap-1 text-[10px] text-muted-foreground">
            <Link2 className="w-3 h-3" /> Auto-gespeichert
          </span>
        ) : (
          <span className="ml-auto inline-flex items-center gap-1 text-[10px] text-muted-foreground">
            <Link2Off className="w-3 h-3" /> Entwurf (nicht gespeichert)
          </span>
        )}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-[1fr_1fr] gap-2">
        <Select value={value} onValueChange={handleChange}>
          <SelectTrigger>
            <SelectValue placeholder={isLoading ? "Lade Fahrzeuge…" : "Fahrzeug wählen"} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={NONE}>– Bitte wählen –</SelectItem>
            <SelectItem value={NO_VEHICLE}>Ohne Fahrzeug (no-VIN)</SelectItem>
            {vehicles.map((v) => (
              <SelectItem key={v.id} value={v.id}>
                {[v.brand, v.model, v.year && `(${v.year})`].filter(Boolean).join(" ") || v.title || v.vin}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Input
          placeholder="Titel (z. B. Frühlingsaktion 2026)"
          value={projectTitle ?? ""}
          onChange={(e) => onChangeTitle(e.target.value)}
        />
      </div>
      <p className="text-[11px] text-muted-foreground">
        Wenn ein Fahrzeug verknüpft ist, werden Headline, Preis, Pflichtangaben und Marken-Logo
        automatisch befüllt. Exportierte Banner landen im Fahrzeug-Ordner.
      </p>
    </section>
  );
};

export default VehicleBannerPicker;
