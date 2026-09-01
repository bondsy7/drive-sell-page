import { useMemo, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Lock,
  LockOpen,
  Plus,
  ShieldAlert,
  Star,
  Trash2,
  XCircle,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { VEHICLE_CLASSES_V2, type VehicleClassV2 } from "../domain/vehicle-classes";
import {
  COLOR_FAMILIES,
  COLOR_FAMILY_LABELS_DE,
  COLOR_FAMILY_SWATCH,
  type ColorFamily,
} from "./color-families";
import {
  PERSPECTIVE_MASTER,
  getPerspectiveMasterEntry,
} from "./perspective-master";
import { assetIsFullyOutputReady, canBecomePrimary } from "./ingestion";
import { BLOCKER_LABELS_DE, type ReferenceAssetRecord } from "./vehicle-master";
import {
  ReferenceStoreProvider,
  useReferenceStore,
} from "./reference-store";
import { ReferenceCaptureWorkflow } from "./ReferenceCaptureWorkflow";
import { AutomaticReferenceIntake } from "../phase1-5/AutomaticReferenceIntake";
import { CurrentFramingEvidenceRuntimeProvider } from "../phase2/framing-evidence-runtime";

/**
 * Reference V2 — Phase 1: AdminReferenceView.
 *
 * Admin-Oberfläche für Vehicle-Master-Ingestion und Referenz-Review.
 * Nutzt ausschließlich Phase-0-Verträge (Perspektiven, Readiness, Intake)
 * über PerspectiveMaster v1 — kein Parallelschema, keine Business-Metadaten.
 */

const VEHICLE_CLASS_LABELS: Record<VehicleClassV2, string> = {
  car: "Pkw",
  van: "Transporter",
  motorhome: "Wohnmobil",
  truck: "Lkw",
  motorcycle: "Motorrad",
  trailer: "Anhänger",
};

function AssetTile({ asset }: { asset: ReferenceAssetRecord }) {
  const { activeMaster, promoteToPrimary, toggleProtection, removeAsset } =
    useReferenceStore();
  if (!activeMaster) return null;

  const rejected = asset.role === "rejected";
  const isPrimary = asset.role === "primary";

  const run = (fn: () => void) => {
    try {
      fn();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Aktion nicht erlaubt");
    }
  };

  return (
    <div
      className={`rounded-lg border p-3 space-y-2 ${
        rejected
          ? "border-destructive/50 bg-destructive/5"
          : isPrimary
            ? "border-accent bg-accent/5"
            : "border-border"
      }`}
    >
      <div className="aspect-[4/3] overflow-hidden rounded-md bg-muted">
        <img
          src={asset.previewUrl}
          alt={`Referenz ${asset.requestedPerspectiveId}`}
          className={`w-full h-full object-cover ${rejected ? "opacity-50 grayscale" : ""}`}
          loading="lazy"
        />
      </div>
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-medium truncate">{asset.fileName}</span>
        <Badge variant={isPrimary ? "default" : rejected ? "destructive" : "secondary"}>
          {isPrimary
            ? "Primär"
            : rejected
              ? "Abgewiesen"
              : asset.role === "primary_candidate"
                ? "Primär-Kandidat"
                : "Sekundär"}
        </Badge>
      </div>
      <div className="text-[11px] text-muted-foreground">
        Score {asset.weightedScore.toFixed(1)} · v{asset.version} ·{" "}
        {assetIsFullyOutputReady(asset) ? "4:5 + 1.91:1 ✓" : "Format eingeschränkt"}
      </div>
      {asset.blockers.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {asset.blockers.map((b) => (
            <Badge key={b} variant="destructive" className="text-[10px]">
              {BLOCKER_LABELS_DE[b]}
            </Badge>
          ))}
        </div>
      )}
      <div className="flex items-center gap-1">
        <Button
          size="sm"
          variant="outline"
          className="flex-1 text-xs"
          disabled={!canBecomePrimary(asset) || isPrimary}
          onClick={() => run(() => promoteToPrimary(activeMaster.id, asset.id))}
        >
          <Star className="w-3 h-3 mr-1" />
          Primär
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => run(() => toggleProtection(activeMaster.id, asset.id))}
          title={asset.protection === "protected" ? "Schutz aufheben" : "Schützen"}
        >
          {asset.protection === "protected" ? (
            <Lock className="w-3 h-3" />
          ) : (
            <LockOpen className="w-3 h-3" />
          )}
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => run(() => removeAsset(activeMaster.id, asset.id))}
        >
          <Trash2 className="w-3 h-3" />
        </Button>
      </div>
    </div>
  );
}

function ReviewGrid() {
  const { activeMaster, coverage } = useReferenceStore();
  if (!activeMaster) return null;

  const ordered = [...coverage].sort(
    (a, b) => Number(b.required) - Number(a.required),
  );

  return (
    <div className="space-y-4">
      {ordered.map((c) => {
        const entry = getPerspectiveMasterEntry(c.perspectiveId);
        const assets = [
          ...(c.primary ? [c.primary] : []),
          ...c.secondaries,
          ...c.rejected,
        ];
        return (
          <Card key={c.perspectiveId}>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex flex-wrap items-center gap-2">
                {c.status === "READY_EXACT" || c.status === "READY_MULTI_REFERENCE" ? (
                  <CheckCircle2 className="w-4 h-4 text-accent" />
                ) : c.status.startsWith("BLOCKED") ? (
                  <XCircle className="w-4 h-4 text-destructive" />
                ) : (
                  <AlertTriangle className="w-4 h-4 text-muted-foreground" />
                )}
                {entry.labelDe}
                <span className="text-[11px] font-normal text-muted-foreground">
                  {entry.id} · v{entry.version}
                </span>
                {c.required && (
                  <Badge variant="outline" className="text-[10px]">
                    Pflicht
                  </Badge>
                )}
                <Badge variant="secondary" className="text-[10px]">
                  {c.status}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {assets.length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  Keine Referenz erfasst.
                </p>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {assets.map((a) => (
                    <AssetTile key={a.id} asset={a} />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

function AdminReferenceViewInner() {
  const {
    masters,
    activeMaster,
    activeMasterId,
    setActiveMasterId,
    createMaster,
    setColorFamily,
    warnings,
  } = useReferenceStore();

  const [label, setLabel] = useState("");
  const [vehicleClass, setVehicleClass] = useState<VehicleClassV2>("car");
  const [colorFamily, setNewColorFamily] = useState<ColorFamily>("grey");

  const perspectiveCount = PERSPECTIVE_MASTER.perspectives.length;

  const blocking = useMemo(
    () => warnings.filter((w) => w.code !== "REJECTED_ASSETS_PRESENT"),
    [warnings],
  );

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-bold">Vehicle Reference Engine V2 — Referenzen</h1>
        <p className="text-sm text-muted-foreground">
          Phase 1: Vehicle-Master-Ingestion und Referenz-Review gegen
          PerspectiveMaster v1 ({perspectiveCount} Perspektiven, Registry-Version{" "}
          {PERSPECTIVE_MASTER.registryVersion}). Keine Marken-, Modell- oder
          VIN-Daten — ausschließlich visuelle Wahrheit.
        </p>
      </header>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Vehicle Master</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-4">
            <div className="space-y-1 sm:col-span-2">
              <Label className="text-xs">Interner Label (nie im Prompt)</Label>
              <Input
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder="z. B. Referenzfahrzeug A"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Fahrzeugklasse</Label>
              <Select
                value={vehicleClass}
                onValueChange={(v) => setVehicleClass(v as VehicleClassV2)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {VEHICLE_CLASSES_V2.map((c) => (
                    <SelectItem key={c} value={c}>
                      {VEHICLE_CLASS_LABELS[c]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Farbfamilie</Label>
              <Select
                value={colorFamily}
                onValueChange={(v) => setNewColorFamily(v as ColorFamily)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {COLOR_FAMILIES.map((c) => (
                    <SelectItem key={c} value={c}>
                      {COLOR_FAMILY_LABELS_DE[c]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <Button
            onClick={() => {
              if (!label.trim()) {
                toast.error("Bitte einen internen Label vergeben.");
                return;
              }
              createMaster({ label: label.trim(), vehicleClass, colorFamily });
              setLabel("");
              toast.success("Vehicle Master angelegt.");
            }}
          >
            <Plus className="w-4 h-4 mr-2" />
            Vehicle Master anlegen
          </Button>

          {masters.length > 0 && (
            <div className="flex flex-wrap gap-2 pt-2">
              {masters.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setActiveMasterId(m.id)}
                  className={`flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs transition ${
                    m.id === activeMasterId
                      ? "border-accent bg-accent/10"
                      : "border-border hover:bg-muted"
                  }`}
                >
                  <span
                    className="w-3 h-3 rounded-full border border-border"
                    style={{
                      background: m.colorFamily
                        ? COLOR_FAMILY_SWATCH[m.colorFamily]
                        : "transparent",
                    }}
                  />
                  {m.label}
                  <span className="text-muted-foreground">
                    {VEHICLE_CLASS_LABELS[m.vehicleClass]} · {m.assets.length}
                  </span>
                </button>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {activeMaster && (
        <>
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,420px)]">
            <div className="space-y-4">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <ShieldAlert className="w-4 h-4" />
                    Vollständigkeit — {activeMaster.label}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <Label className="text-xs">Farbfamilie</Label>
                    <Select
                      value={activeMaster.colorFamily ?? undefined}
                      onValueChange={(v) =>
                        setColorFamily(activeMaster.id, v as ColorFamily)
                      }
                    >
                      <SelectTrigger className="w-48 h-8 text-xs">
                        <SelectValue placeholder="Nicht zugewiesen" />
                      </SelectTrigger>
                      <SelectContent>
                        {COLOR_FAMILIES.map((c) => (
                          <SelectItem key={c} value={c}>
                            {COLOR_FAMILY_LABELS_DE[c]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  {blocking.length === 0 ? (
                    <p className="text-sm text-accent flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4" />
                      Alle Pflichtperspektiven mit freigegebener Primärreferenz
                      abgedeckt.
                    </p>
                  ) : (
                    <ul className="space-y-1 text-xs">
                      {warnings.map((w, i) => (
                        <li key={`${w.code}-${i}`} className="flex gap-2">
                          <AlertTriangle className="w-3.5 h-3.5 shrink-0 text-muted-foreground mt-0.5" />
                          <span>{w.message}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </CardContent>
              </Card>
              <ReviewGrid />
            </div>
            <div className="space-y-4">
              <AutomaticReferenceIntake master={activeMaster} />
              <details className="rounded-md border p-3">
                <summary className="text-xs text-muted-foreground cursor-pointer">
                  Manuelle Diagnose-Erfassung (kein Produktivpfad)
                </summary>
                <div className="pt-3">
                  <ReferenceCaptureWorkflow master={activeMaster} />
                </div>
              </details>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export default function AdminReferenceView() {
  return (
    <ReferenceStoreProvider>
      <CurrentFramingEvidenceRuntimeProvider>
        <AdminReferenceViewInner />
      </CurrentFramingEvidenceRuntimeProvider>
    </ReferenceStoreProvider>
  );
}
