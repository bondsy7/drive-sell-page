import { useEffect, useMemo, useState } from "react";
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
import { canBecomePrimary } from "./ingestion";
import { BLOCKER_LABELS_DE, type ReferenceAssetRecord } from "./vehicle-master";
import {
  ReferenceStoreProvider,
  useReferenceStore,
} from "./reference-store";
import { ReferenceCaptureWorkflow } from "./ReferenceCaptureWorkflow";
import { AutomaticReferenceIntake } from "../phase1-5/AutomaticReferenceIntake";
import { CurrentFramingEvidenceRuntimeProvider } from "../phase2/framing-evidence-runtime";
import { OutputPlannerPanel } from "../phase2/OutputPlannerPanel";
import { useReferenceV2Persistence } from "../phase2/use-reference-v2-persistence";

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
        Governance-Score {asset.weightedScore.toFixed(1)} · v{asset.version}
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
          disabled={asset.protection === "protected"}
          title={
            asset.protection === "protected"
              ? "Geschütztes Asset — Schutz zuerst aufheben"
              : "Asset entfernen"
          }
          onClick={() => run(() => removeAsset(activeMaster.id, asset.id))}
        >
          <Trash2 className="w-3 h-3" />
        </Button>
      </div>
    </div>
  );
}

type ReviewFilter = "all" | "covered" | "open";

function ReviewGrid({ filter }: { filter: ReviewFilter }) {
  const { activeMaster, coverage } = useReferenceStore();
  if (!activeMaster) return null;

  const ordered = [...coverage]
    .sort((a, b) => Number(b.required) - Number(a.required))
    .filter((c) => {
      const count =
        (c.primary ? 1 : 0) + c.secondaries.length + c.rejected.length;
      if (filter === "covered") return count > 0;
      if (filter === "open") return count === 0 || !c.primary;
      return true;
    });

  if (ordered.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-sm text-muted-foreground">
          Keine Perspektiven in dieser Ansicht.
        </CardContent>
      </Card>
    );
  }

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

type StepState = "done" | "active" | "todo";

function StepIndicator({
  steps,
}: {
  steps: readonly { label: string; state: StepState }[];
}) {
  return (
    <ol className="flex flex-wrap items-center gap-x-3 gap-y-2">
      {steps.map((s, i) => (
        <li key={s.label} className="flex items-center gap-2">
          <span
            className={`flex h-6 w-6 items-center justify-center rounded-full border text-[11px] font-semibold ${
              s.state === "done"
                ? "border-accent bg-accent text-accent-foreground"
                : s.state === "active"
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-muted text-muted-foreground"
            }`}
          >
            {s.state === "done" ? <CheckCircle2 className="h-3.5 w-3.5" /> : i + 1}
          </span>
          <span
            className={`text-xs ${
              s.state === "todo" ? "text-muted-foreground" : "font-medium"
            }`}
          >
            {s.label}
          </span>
          {i < steps.length - 1 && (
            <span className="hidden h-px w-8 bg-border sm:block" />
          )}
        </li>
      ))}
    </ol>
  );
}

function StatCard({
  label,
  value,
  hint,
  tone = "default",
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: "default" | "accent" | "warning";
}) {
  return (
    <div className="rounded-lg border bg-card p-3">
      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p
        className={`mt-1 text-xl font-semibold ${
          tone === "accent"
            ? "text-accent"
            : tone === "warning"
              ? "text-destructive"
              : ""
        }`}
      >
        {value}
      </p>
      {hint && <p className="text-[11px] text-muted-foreground">{hint}</p>}
    </div>
  );
}

function IssuesCard({ master }: { master: { assets: readonly ReferenceAssetRecord[] } }) {
  const counted = useMemo(() => {
    const map = new Map<string, number>();
    for (const a of master.assets) {
      for (const b of a.blockers) {
        map.set(BLOCKER_LABELS_DE[b], (map.get(BLOCKER_LABELS_DE[b]) ?? 0) + 1);
      }
    }
    return [...map.entries()].sort((a, b) => b[1] - a[1]);
  }, [master.assets]);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Erkannte Probleme</CardTitle>
      </CardHeader>
      <CardContent>
        {counted.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            Keine Blocker in den erfassten Aufnahmen.
          </p>
        ) : (
          <ul className="space-y-2">
            {counted.map(([labelDe, count]) => (
              <li
                key={labelDe}
                className="flex items-center justify-between gap-2 text-xs"
              >
                <span className="flex items-center gap-2">
                  <AlertTriangle className="h-3.5 w-3.5 text-destructive shrink-0" />
                  {labelDe}
                </span>
                <Badge variant="secondary" className="text-[10px]">
                  {count} {count === 1 ? "Bild" : "Bilder"}
                </Badge>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

function AdminReferenceViewInner() {
  const {
    masters,
    activeMaster,
    activeMasterId,
    setActiveMasterId,
    createMaster,
    hydrateMaster,
    setColorFamily,
    warnings,
    coverage,
  } = useReferenceStore();

  const persistence = useReferenceV2Persistence({ onHydrated: hydrateMaster });

  useEffect(() => {
    void persistence.loadVehicles();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [label, setLabel] = useState("");
  const [vehicleClass, setVehicleClass] = useState<VehicleClassV2>("car");
  const [colorFamily, setNewColorFamily] = useState<ColorFamily>("grey");


  const [reviewFilter, setReviewFilter] = useState<ReviewFilter>("covered");

  const perspectiveCount = PERSPECTIVE_MASTER.perspectives.length;

  const blocking = useMemo(
    () => warnings.filter((w) => w.code !== "REJECTED_ASSETS_PRESENT"),
    [warnings],
  );

  const stats = useMemo(() => {
    const assets = activeMaster?.assets ?? [];
    const usable = assets.filter((a) => a.role !== "rejected");
    const classified = coverage.filter(
      (c) => c.primary || c.secondaries.length > 0,
    ).length;
    const relevant = coverage.length;
    const avgScore =
      usable.length > 0
        ? usable.reduce((sum, a) => sum + a.weightedScore, 0) / usable.length
        : 0;
    const primaries = coverage.filter((c) => c.primary).length;
    return {
      total: assets.length,
      usable: usable.length,
      classified,
      relevant,
      avgScore,
      primaries,
    };
  }, [activeMaster, coverage]);

  const steps = useMemo(() => {
    const hasVehicle = Boolean(persistence.vehicleId);
    const hasMaster = Boolean(activeMaster);
    const hasAssets = stats.total > 0;
    const reviewed = stats.primaries > 0;
    const ready = hasMaster && blocking.length === 0 && reviewed;
    const step = (done: boolean, active: boolean): StepState =>
      done ? "done" : active ? "active" : "todo";
    return [
      { label: "Fahrzeug-Anker", state: step(hasVehicle, !hasVehicle) },
      { label: "Vehicle Master", state: step(hasMaster, hasVehicle && !hasMaster) },
      { label: "Upload & Analyse", state: step(hasAssets, hasMaster && !hasAssets) },
      { label: "Review", state: step(reviewed, hasAssets && !reviewed) },
      { label: "Preflight bereit", state: step(ready, reviewed && !ready) },
    ] as const;
  }, [persistence.vehicleId, activeMaster, stats, blocking.length]);

  return (
    <div className="space-y-6">
      <header className="space-y-3">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold">
            Vehicle Reference Engine V2 — Referenzen
          </h1>
          <p className="text-sm text-muted-foreground">
            Vehicle-Master-Verwaltung, automatische Bildanalyse und
            Planner-/Preflight-Vorprüfung gegen PerspectiveMaster v1 (
            {perspectiveCount} Perspektiven, Registry-Version{" "}
            {PERSPECTIVE_MASTER.registryVersion}). Keine Marken-, Modell- oder
            VIN-Daten — ausschließlich visuelle Wahrheit. Es wird hier nichts
            generiert.
          </p>
        </div>
        <StepIndicator steps={steps} />
      </header>

      {activeMaster && (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            label="Aufnahmen"
            value={`${stats.total}`}
            hint={`${stats.usable} referenztauglich`}
          />
          <StatCard
            label="Klassifizierte Perspektiven"
            value={`${stats.classified} / ${stats.relevant}`}
            hint={`${stats.primaries} mit Primärreferenz`}
          />
          <StatCard
            label="Ø Governance-Score"
            value={stats.usable > 0 ? stats.avgScore.toFixed(1) : "—"}
            hint="nur nicht abgewiesene Aufnahmen"
            tone={stats.avgScore >= 70 ? "accent" : "default"}
          />
          <StatCard
            label="Speicherung"
            value={persistence.persistenceReady ? "Dauerhaft" : "Nur Sitzung"}
            hint={
              persistence.persistenceReady
                ? "Original + Datensatz gesichert"
                : "Fahrzeug-Anker wählen"
            }
            tone={persistence.persistenceReady ? "accent" : "warning"}
          />
        </div>
      )}


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
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <Label className="text-xs">
                Fahrzeug-Anker (nur Zuordnung, nie Prompt-Input)
              </Label>
              <Select
                value={persistence.vehicleId ?? undefined}
                onValueChange={(v) => void persistence.selectVehicle(v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Fahrzeug wählen — ohne Anker nur lokal" />
                </SelectTrigger>
                <SelectContent>
                  {persistence.vehicles.map((v) => (
                    <SelectItem key={v.id} value={v.id}>
                      {v.display}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end">
              <p className="text-xs text-muted-foreground">
                {persistence.persistenceReady
                  ? "Referenzen werden dauerhaft gespeichert (Original + Datensatz)."
                  : persistence.vehicleId
                    ? "Anker gewählt — Workspace wird beim Anlegen des Vehicle Masters erstellt."
                    : "Ohne Fahrzeug-Anker bleiben Referenzen nur in dieser Sitzung."}
                {persistence.error ? ` Fehler: ${persistence.error}` : ""}
              </p>
            </div>
          </div>
          <Button
            disabled={persistence.busy}
            onClick={() => {
              if (!label.trim()) {
                toast.error("Bitte einen internen Label vergeben.");
                return;
              }
              const record = createMaster({
                label: label.trim(),
                vehicleClass,
                colorFamily,
              });
              setLabel("");
              toast.success("Vehicle Master angelegt.");
              if (persistence.vehicleId) {
                void persistence.bindMaster(record).then((ws) => {
                  if (ws) toast.success("Dauerhafter Workspace verbunden.");
                });
              }
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
              <OutputPlannerPanel
                key={activeMaster.id}
                vehicleMaster={activeMaster}
              />
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-sm font-semibold">
                  Klassifizierte Perspektiven
                </h2>
                <div className="flex gap-1 rounded-md border p-0.5">
                  {(
                    [
                      ["covered", "Mit Aufnahmen"],
                      ["open", "Offen"],
                      ["all", "Alle"],
                    ] as const
                  ).map(([value, text]) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setReviewFilter(value)}
                      className={`rounded px-2.5 py-1 text-xs transition ${
                        reviewFilter === value
                          ? "bg-primary text-primary-foreground"
                          : "text-muted-foreground hover:bg-muted"
                      }`}
                    >
                      {text}
                    </button>
                  ))}
                </div>
              </div>
              <ReviewGrid filter={reviewFilter} />
            </div>
            <div className="space-y-4">
              <AutomaticReferenceIntake
                master={activeMaster}
                {...(persistence.persistenceReady
                  ? { onPersistAsset: persistence.persistAsset }
                  : {})}
              />
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Master-Details</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-xs">
                  {(
                    [
                      ["Interner Label", activeMaster.label],
                      [
                        "Fahrzeugklasse",
                        VEHICLE_CLASS_LABELS[activeMaster.vehicleClass],
                      ],
                      [
                        "Farbfamilie",
                        activeMaster.colorFamily
                          ? COLOR_FAMILY_LABELS_DE[activeMaster.colorFamily]
                          : "Nicht zugewiesen",
                      ],
                      ["Identitäts-Cluster", activeMaster.identityClusterId],
                      ["Master-Version", `v${activeMaster.version}`],
                      [
                        "Fahrzeug-Anker",
                        persistence.vehicleId ? "Gebunden" : "Nicht gebunden",
                      ],
                    ] as const
                  ).map(([k, v]) => (
                    <div key={k} className="flex justify-between gap-3">
                      <span className="text-muted-foreground">{k}</span>
                      <span className="truncate text-right font-medium">{v}</span>
                    </div>
                  ))}
                </CardContent>
              </Card>
              <IssuesCard master={activeMaster} />
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
