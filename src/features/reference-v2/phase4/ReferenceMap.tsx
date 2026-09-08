import { useMemo, useState } from "react";
import { Car, Check, Loader2, Star } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { PerspectiveId } from "../domain/perspectives/types";
import type { VehicleClassV2 } from "../domain/vehicle-classes";
import {
  getPerspectiveMasterEntry,
  listMasterPerspectivesForClass,
} from "../phase1/perspective-master";
import {
  ADVISORY_LABELS_DE,
  BASIS_LABELS_DE,
  chooseGenerationBasis,
  resolvePerspective,
  type AdvisoryStatus,
  type CaptureItem,
  type ManualAssignment,
  type ManualRole,
} from "./capture-state";

/**
 * Reference V2 — Phase 4: Referenzmap.
 *
 * Hier bestaetigt oder korrigiert der Nutzer die Zuordnung. Die automatische
 * Analyse ist nur ein Vorschlag; eine manuelle Zuordnung ist immer moeglich —
 * auch wenn die Analyse fuer ein Bild gar nicht verfuegbar war.
 */

export const EXTERIOR_MAP_ORDER: readonly PerspectiveId[] = [
  "EXT_FRONT",
  "EXT_34_FRONT_RIGHT",
  "EXT_SIDE_RIGHT",
  "EXT_34_REAR_RIGHT",
  "EXT_REAR",
  "EXT_34_REAR_LEFT",
  "EXT_SIDE_LEFT",
  "EXT_34_FRONT_LEFT",
];

/** Position auf der Karte in Prozent (x, y) — im Uhrzeigersinn ab Front. */
const MAP_POSITIONS: Record<string, { x: number; y: number }> = {
  EXT_FRONT: { x: 50, y: 6 },
  EXT_34_FRONT_RIGHT: { x: 81, y: 19 },
  EXT_SIDE_RIGHT: { x: 94, y: 50 },
  EXT_34_REAR_RIGHT: { x: 81, y: 81 },
  EXT_REAR: { x: 50, y: 94 },
  EXT_34_REAR_LEFT: { x: 19, y: 81 },
  EXT_SIDE_LEFT: { x: 6, y: 50 },
  EXT_34_FRONT_LEFT: { x: 19, y: 19 },
};

const STATUS_RING: Record<AdvisoryStatus, string> = {
  OPTIMAL: "border-emerald-500 bg-emerald-500/10",
  WARNING: "border-amber-500 bg-amber-500/10",
  MISSING: "border-border bg-muted",
  ANALYZING: "border-sky-500 bg-sky-500/10",
};

const STATUS_DOT: Record<AdvisoryStatus, string> = {
  OPTIMAL: "bg-emerald-500",
  WARNING: "bg-amber-500",
  MISSING: "bg-muted-foreground/40",
  ANALYZING: "bg-sky-500",
};

type MapTab = "exterior" | "interior" | "detail" | "more";

const TAB_LABELS: Record<MapTab, string> = {
  exterior: "Außen",
  interior: "Innen",
  detail: "Details",
  more: "Weitere Ansichten",
};

export interface ReferenceMapProps {
  readonly vehicleClass: VehicleClassV2;
  readonly items: readonly CaptureItem[];
  readonly assignments: readonly ManualAssignment[];
  readonly onAssign: (
    perspectiveId: PerspectiveId,
    itemId: string,
    role: ManualRole,
  ) => void;
  readonly onClear: (perspectiveId: PerspectiveId, itemId: string) => void;
  readonly onGenerate?: (perspectiveId: PerspectiveId) => void;
}

export function ReferenceMap({
  vehicleClass,
  items,
  assignments,
  onAssign,
  onClear,
  onGenerate,
}: ReferenceMapProps) {
  const [tab, setTab] = useState<MapTab>("exterior");
  const [selected, setSelected] = useState<PerspectiveId | null>(null);

  const applicable = useMemo(
    () => listMasterPerspectivesForClass(vehicleClass),
    [vehicleClass],
  );

  const byTab = useMemo(() => {
    const exterior = EXTERIOR_MAP_ORDER.filter((id) =>
      applicable.some((p) => p.id === id),
    );
    const interior = applicable
      .filter((p) => p.category === "interior")
      .map((p) => p.id);
    const detail = applicable
      .filter((p) => p.category === "detail")
      .map((p) => p.id);
    const more = applicable
      .filter(
        (p) =>
          p.category === "hero" ||
          p.category === "low_angle" ||
          p.category === "elevated",
      )
      .map((p) => p.id);
    return { exterior, interior, detail, more };
  }, [applicable]);

  const resolutionFor = (id: PerspectiveId) =>
    resolvePerspective(id, items, assignments);

  const azimuthDeps = useMemo(
    () => ({
      azimuthOf: (id: PerspectiveId) => {
        try {
          return getPerspectiveMasterEntry(id).azimuthDeg ?? null;
        } catch {
          return null;
        }
      },
    }),
    [],
  );

  /** Freundlicher Status: Direkt / Ersatz / Geschätzt / Fehlt. */
  const basisFor = (id: PerspectiveId) =>
    chooseGenerationBasis(id, items, assignments, azimuthDeps);

  const exteriorResolutions = byTab.exterior.map(resolutionFor);
  const covered = exteriorResolutions.filter(
    (r) => r.status === "OPTIMAL" || r.status === "WARNING",
  ).length;
  const coveragePct =
    byTab.exterior.length === 0
      ? 0
      : Math.round((covered / byTab.exterior.length) * 100);
  const missing = exteriorResolutions.filter((r) => r.status === "MISSING");

  const itemById = useMemo(
    () => new Map(items.map((i) => [i.id, i])),
    [items],
  );

  const renderTile = (id: PerspectiveId, compact = false) => {
    const res = resolutionFor(id);
    const entry = getPerspectiveMasterEntry(id);
    const primary = res.primaryItemId ? itemById.get(res.primaryItemId) : undefined;
    return (
      <button
        key={id}
        type="button"
        onClick={() => setSelected(id)}
        aria-label={`${entry.labelDe} — ${ADVISORY_LABELS_DE[res.status]}`}
        className={`group w-full rounded-lg border-2 p-1.5 text-left transition hover:shadow-sm ${
          STATUS_RING[res.status]
        } ${selected === id ? "ring-2 ring-primary" : ""}`}
      >
        <div
          className={`overflow-hidden rounded-md bg-background ${
            compact ? "aspect-[4/3]" : "aspect-[4/3]"
          }`}
        >
          {primary ? (
            <img
              src={primary.previewUrl}
              alt={entry.labelDe}
              className="h-full w-full object-cover"
              loading="lazy"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center">
              {res.status === "ANALYZING" ? (
                <Loader2 className="h-4 w-4 animate-spin text-sky-500" />
              ) : (
                <span className="text-[10px] text-muted-foreground">
                  kein Bild
                </span>
              )}
            </div>
          )}
        </div>
        <div className="mt-1 flex items-center gap-1">
          <span className={`h-2 w-2 shrink-0 rounded-full ${STATUS_DOT[res.status]}`} />
          <span className="truncate text-[11px] font-medium">{entry.labelDe}</span>
          {res.primaryIsManual && (
            <Star className="ml-auto h-3 w-3 shrink-0 text-amber-500" />
          )}
        </div>
      </button>
    );
  };

  const selectedRes = selected ? resolutionFor(selected) : null;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex flex-wrap items-center gap-3 text-base">
            Referenzmap
            <Badge variant="secondary" className="text-[11px]">
              {covered} / {byTab.exterior.length} Außenansichten · {coveragePct}%
            </Badge>
            {missing.length > 0 && (
              <span className="text-[11px] font-normal text-muted-foreground">
                Nächster Schritt: {missing.length} fehlende Ansicht
                {missing.length === 1 ? "" : "en"} zuordnen oder generieren
              </span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-1 rounded-md border p-0.5">
            {(Object.keys(TAB_LABELS) as MapTab[]).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTab(t)}
                className={`rounded px-2.5 py-1 text-xs transition ${
                  tab === t
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-muted"
                }`}
              >
                {TAB_LABELS[t]}
              </button>
            ))}
          </div>

          {tab === "exterior" ? (
            <div className="relative mx-auto aspect-square w-full max-w-xl">
              <div className="absolute inset-[26%] flex flex-col items-center justify-center rounded-full border border-dashed border-border bg-muted/40 text-center">
                <Car className="h-7 w-7 text-muted-foreground" />
                <span className="mt-1 text-lg font-semibold">{coveragePct}%</span>
                <span className="text-[11px] text-muted-foreground">
                  Außen abgedeckt
                </span>
              </div>
              {byTab.exterior.map((id) => {
                const pos = MAP_POSITIONS[id] ?? { x: 50, y: 50 };
                return (
                  <div
                    key={id}
                    className="absolute w-[26%] -translate-x-1/2 -translate-y-1/2"
                    style={{ left: `${pos.x}%`, top: `${pos.y}%` }}
                  >
                    {renderTile(id, true)}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {byTab[tab].length === 0 ? (
                <p className="col-span-full text-xs text-muted-foreground">
                  Für diese Fahrzeugklasse sind hier keine Ansichten definiert.
                </p>
              ) : (
                byTab[tab].map((id) => renderTile(id))
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {selected && selectedRes && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex flex-wrap items-center gap-2 text-base">
              {getPerspectiveMasterEntry(selected).labelDe}
              <Badge
                variant={
                  selectedRes.status === "OPTIMAL"
                    ? "default"
                    : selectedRes.status === "MISSING"
                      ? "outline"
                      : "secondary"
                }
                className="text-[10px]"
              >
                {ADVISORY_LABELS_DE[selectedRes.status]}
              </Badge>
              <Button
                size="sm"
                variant="ghost"
                className="ml-auto h-7 text-xs"
                onClick={() => setSelected(null)}
              >
                Schließen
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {selectedRes.warningText && (
              <p className="rounded-md border border-amber-500/40 bg-amber-500/10 p-2 text-xs">
                {selectedRes.warningText}
              </p>
            )}
            <p className="text-xs">
              Status:{" "}
              <b>{BASIS_LABELS_DE[basisFor(selected).kind]}</b>
            </p>
            {(() => {
              const opposite = oppositePerspectiveId(selected);
              const primaryId = selectedRes.primaryItemId;
              if (!opposite || !primaryId) return null;
              const primaryItem = itemById.get(primaryId);
              const hint =
                primaryItem?.sideCorrected || primaryItem?.conflict
                  ? primaryItem.message
                  : null;
              return (
                <div className="flex flex-wrap items-center gap-2">
                  {hint && (
                    <span className="text-[11px] text-amber-600">{hint}</span>
                  )}
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-[11px]"
                    onClick={() => {
                      onClear(selected, primaryId);
                      onAssign(opposite, primaryId, "primary");
                    }}
                  >
                    Auf andere Fahrzeugseite verschieben
                  </Button>
                </div>
              );
            })()}
            <p className="text-xs text-muted-foreground">
              Wähle das Bild, das diese Ansicht zeigt. Deine Auswahl gilt immer
              vor der automatischen Erkennung.
            </p>

            <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
              {items.length === 0 && (
                <p className="col-span-full text-xs text-muted-foreground">
                  Noch keine Bilder hochgeladen.
                </p>
              )}
              {items.map((item) => {
                const isPrimary = selectedRes.primaryItemId === item.id;
                const isSecondary = selectedRes.secondaryItemIds.includes(item.id);
                return (
                  <div
                    key={item.id}
                    className={`rounded-md border p-1 ${
                      isPrimary ? "border-emerald-500" : "border-border"
                    }`}
                  >
                    <div className="aspect-[4/3] overflow-hidden rounded bg-muted">
                      <img
                        src={item.previewUrl}
                        alt={item.fileName}
                        className="h-full w-full object-cover"
                        loading="lazy"
                      />
                    </div>
                    <p className="mt-1 truncate text-[10px]">{item.fileName}</p>
                    <div className="mt-1 flex gap-1">
                      <Button
                        size="sm"
                        variant={isPrimary ? "default" : "outline"}
                        className="h-6 flex-1 px-1 text-[10px]"
                        onClick={() => onAssign(selected, item.id, "primary")}
                      >
                        {isPrimary ? (
                          <Check className="h-3 w-3" />
                        ) : (
                          "Zuordnen"
                        )}
                      </Button>
                      {(isPrimary || isSecondary) && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-6 px-1 text-[10px]"
                          onClick={() => onClear(selected, item.id)}
                        >
                          ×
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
            {onGenerate && selectedRes.primaryItemId && (
              <Button
                size="sm"
                className="h-8 text-xs"
                onClick={() => onGenerate(selected)}
              >
                {selectedRes.status === "OPTIMAL"
                  ? "Diese Ansicht generieren"
                  : "Trotzdem generieren"}
              </Button>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export default ReferenceMap;
