import { useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, Info, XCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { PerspectiveId } from "../domain/perspectives/types";
import type { PerspectiveCategory } from "../domain/perspectives/types";
import type { VehicleMasterRecord } from "../phase1/vehicle-master";
import {
  listMasterPerspectivesForClass,
  type PerspectiveMasterEntry,
} from "../phase1/perspective-master";
import { OUTPUT_FORMATS, type OutputFormat } from "../phase1/output-format-policy";
import { useCurrentFramingEvidenceRuntime } from "./framing-evidence-runtime";
import { buildReferencePlannerFromCurrentFramingSidecar } from "./planner-from-framing-sidecar";
import type { PlannerItem, PlannerOutput, PlannerState } from "./planner-contract";

/**
 * Reference V2 — Phase 2.5: Output Planner + Preflight (PRE-GENERATION).
 *
 * Diese UI besitzt KEINE eigene Readiness-, Scoring- oder Auswahl-Logik. Der
 * gesamte Plan stammt ausschliesslich aus dem eingefrorenen Adapter
 * `buildReferencePlannerFromCurrentFramingSidecar`. Historische Phase-1-Felder
 * sind niemals Autoritaet. Es gibt hier bewusst keine Generierung, keine
 * Persistenz und keinen Provider-Aufruf.
 */

const CATEGORY_ORDER: readonly PerspectiveCategory[] = [
  "standard_exterior",
  "hero",
  "low_angle",
  "elevated",
  "interior",
  "detail",
];

const CATEGORY_LABELS_DE: Record<PerspectiveCategory, string> = {
  standard_exterior: "Standard-Außenansichten",
  hero: "Hero / Präsentation",
  low_angle: "Tiefe Perspektive",
  elevated: "Erhöhte Perspektive",
  interior: "Interieur",
  detail: "Detail",
};

const STATE_STYLE: Record<PlannerState, string> = {
  READY: "bg-accent/15 text-accent border-accent/40",
  REVIEW: "bg-muted text-muted-foreground border-border",
  BLOCKED: "bg-destructive/10 text-destructive border-destructive/40",
};

const PLANNER_POLICY = {
  maxSecondaryReferences: 2,
  allowAdjacentSubstitution: false,
} as const;

interface PlanResult {
  readonly output?: PlannerOutput;
  readonly error?: string;
}

function StateBadge({ state }: { state: PlannerState }) {
  return (
    <Badge variant="outline" className={`text-[10px] ${STATE_STYLE[state]}`}>
      {state}
    </Badge>
  );
}

function ToggleChip({
  label,
  pressed,
  onClick,
  title,
}: {
  label: string;
  pressed: boolean;
  onClick: () => void;
  title?: string;
}) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      title={title}
      onClick={onClick}
      className={`rounded-full border px-3 py-1 text-xs transition ${
        pressed
          ? "border-accent bg-accent/10"
          : "border-border hover:bg-muted text-muted-foreground"
      }`}
    >
      {label}
    </button>
  );
}

function AssetThumb({
  master,
  assetId,
}: {
  master: VehicleMasterRecord;
  assetId: string;
}) {
  const asset = master.assets.find((a) => a.id === assetId);
  if (!asset) return null;
  return (
    <img
      src={asset.previewUrl}
      alt={`Referenz ${assetId}`}
      className="w-12 h-12 rounded object-cover border border-border"
      loading="lazy"
    />
  );
}

function PlannedItemCard({
  item,
  master,
  labelFor,
}: {
  item: PlannerItem;
  master: VehicleMasterRecord;
  labelFor: (id: PerspectiveId) => string;
}) {
  const primary = item.selection.primary;
  return (
    <div className="rounded-lg border border-border p-3 space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <StateBadge state={item.state} />
        <span className="text-sm font-medium">
          {labelFor(item.perspectiveSpecId)}
        </span>
        <span className="text-[11px] text-muted-foreground">
          {item.perspectiveSpecId} · v{item.perspectiveSpecVersion}
        </span>
        <Badge variant="secondary" className="text-[10px]">
          {item.fineGrainedReadiness}
        </Badge>
      </div>

      <div className="text-xs space-y-1">
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground">Primär:</span>
          {primary ? (
            <>
              <AssetThumb master={master} assetId={primary.assetId} />
              <span>
                {primary.assetId} · {primary.perspectiveId}
                {primary.exactPerspective ? " · exakt" : " · nicht exakt"}
              </span>
            </>
          ) : (
            <span className="text-destructive">keine Primärreferenz</span>
          )}
        </div>

        {item.selection.secondaryReferences.length > 0 && (
          <div className="space-y-1">
            <span className="text-muted-foreground">Sekundär:</span>
            {item.selection.secondaryReferences.map((s) => (
              <div key={s.assetId} className="flex items-center gap-2">
                <AssetThumb master={master} assetId={s.assetId} />
                <span>
                  {s.assetId} · {s.perspectiveId} · Scopes: {s.scopes.join(", ")}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="text-[11px] space-y-0.5">
        <span className="text-muted-foreground">Coverage:</span>
        <ul className="grid gap-0.5 sm:grid-cols-2">
          {item.coverage.items.map((c) => (
            <li key={c.surface} className="flex items-center gap-1">
              {c.met ? (
                <CheckCircle2 className="w-3 h-3 text-accent" />
              ) : (
                <XCircle className="w-3 h-3 text-destructive" />
              )}
              <span>
                {c.surface} · {(c.visibilityScore * 100).toFixed(0)}%
              </span>
            </li>
          ))}
        </ul>
        {item.coverage.requiredWheelPositions.length > 0 && (
          <div className="text-muted-foreground">
            Räder benötigt: {item.coverage.requiredWheelPositions.join(", ")} ·
            sichtbar:{" "}
            {item.coverage.visibleWheelPositions.length > 0
              ? item.coverage.visibleWheelPositions.join(", ")
              : "keine"}
          </div>
        )}
      </div>

      {item.outputFormatReadiness.length > 0 && (
        <div className="text-[11px] space-y-0.5">
          <span className="text-muted-foreground">Ausgabeformate:</span>
          <ul>
            {item.outputFormatReadiness.map((f) => (
              <li key={f.format} className="flex items-start gap-1">
                {f.ready ? (
                  <CheckCircle2 className="w-3 h-3 text-accent mt-0.5" />
                ) : (
                  <XCircle className="w-3 h-3 text-destructive mt-0.5" />
                )}
                <span>
                  {f.format}
                  {f.reason ? ` — ${f.reason}` : ""}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {item.substitution && (
        <div className="text-[11px] text-muted-foreground">
          Substitution (nur Diagnose): {item.substitution.sourcePerspectiveId} →{" "}
          {item.substitution.targetPerspectiveId} ·{" "}
          {item.substitution.azimuthDeltaDeg}° · {item.substitution.rationale}
        </div>
      )}

      {item.reasons.length > 0 && (
        <ul className="space-y-0.5 text-[11px]">
          {item.reasons.map((r, i) => (
            <li key={`${r.code}-${i}`} className="flex items-start gap-1">
              {r.severity === "BLOCKING" ? (
                <XCircle className="w-3 h-3 text-destructive mt-0.5 shrink-0" />
              ) : r.severity === "REVIEW" ? (
                <AlertTriangle className="w-3 h-3 text-muted-foreground mt-0.5 shrink-0" />
              ) : (
                <Info className="w-3 h-3 text-muted-foreground mt-0.5 shrink-0" />
              )}
              <span>
                {r.messageDe}
                <span className="text-muted-foreground">
                  {" "}
                  ({r.severity}
                  {r.assetId ? ` · ${r.assetId}` : ""}
                  {r.surface ? ` · ${r.surface}` : ""})
                </span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function OutputPlannerPanel({
  vehicleMaster,
}: {
  vehicleMaster: VehicleMasterRecord;
}) {
  const runtime = useCurrentFramingEvidenceRuntime();

  const applicable = useMemo(
    () => listMasterPerspectivesForClass(vehicleMaster.vehicleClass),
    [vehicleMaster.vehicleClass],
  );

  const defaultTargets = useMemo(
    () =>
      applicable
        .filter((p) => p.category === "standard_exterior")
        .map((p) => p.id),
    [applicable],
  );

  const [selectedTargets, setSelectedTargets] =
    useState<readonly PerspectiveId[]>(defaultTargets);
  const [selectedFormats, setSelectedFormats] = useState<readonly OutputFormat[]>(
    () => [...OUTPUT_FORMATS],
  );

  const byCategory = useMemo(() => {
    const map = new Map<PerspectiveCategory, PerspectiveMasterEntry[]>();
    for (const entry of applicable) {
      const list = map.get(entry.category) ?? [];
      list.push(entry);
      map.set(entry.category, list);
    }
    return map;
  }, [applicable]);

  const orderedTargets = useMemo(
    () => applicable.filter((p) => selectedTargets.includes(p.id)).map((p) => p.id),
    [applicable, selectedTargets],
  );

  const labelFor = useMemo(() => {
    const labels = new Map<PerspectiveId, string>(
      applicable.map((p) => [p.id, p.labelDe]),
    );
    return (id: PerspectiveId) => labels.get(id) ?? id;
  }, [applicable]);

  const plan = useMemo<PlanResult>(() => {
    if (orderedTargets.length === 0) return {};
    if (selectedFormats.length === 0) return {};
    try {
      const output = buildReferencePlannerFromCurrentFramingSidecar({
        plannerInput: {
          vehicleMaster,
          requestedPerspectiveIds: orderedTargets,
          requestedOutputFormats: selectedFormats,
          policy: PLANNER_POLICY,
          nowIso: new Date().toISOString(),
        },
        framingSidecar: runtime.getCurrentFramingEvidenceSidecar(
          vehicleMaster.id,
        ),
      });
      return { output };
    } catch (e) {
      return {
        error:
          e instanceof Error ? e.message : "Preflight konnte nicht ermittelt werden.",
      };
    }
  }, [orderedTargets, selectedFormats, vehicleMaster, runtime]);

  const toggleTarget = (id: PerspectiveId) => {
    setSelectedTargets((prev) =>
      prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id],
    );
  };

  const toggleFormat = (format: OutputFormat) => {
    setSelectedFormats((prev) =>
      prev.includes(format)
        ? prev.filter((f) => f !== format)
        : [...prev, format],
    );
  };

  const summary = plan.output?.summary;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Output Planner / Preflight</CardTitle>
        <p className="text-xs text-muted-foreground">
          Strikter Modus: exakte Zielperspektive erforderlich, keine
          Links/Rechts-Substitution, maximal 2 zweckgebundene Sekundärreferenzen.
          Reine Vorprüfung — es wird nichts generiert.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <section className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-medium">Zielperspektiven</span>
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-xs"
              onClick={() => setSelectedTargets(defaultTargets)}
            >
              {defaultTargets.length} Außenansichten
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-7 text-xs"
              onClick={() => setSelectedTargets([])}
            >
              Alle abwählen
            </Button>
          </div>

          {CATEGORY_ORDER.filter((cat) => (byCategory.get(cat) ?? []).length > 0).map(
            (cat) => {
              const entries = byCategory.get(cat) ?? [];
              const chips = (
                <div className="flex flex-wrap gap-2 pt-2">
                  {entries.map((entry) => (
                    <ToggleChip
                      key={entry.id}
                      label={`${entry.labelDe} · ${entry.id}`}
                      pressed={selectedTargets.includes(entry.id)}
                      onClick={() => toggleTarget(entry.id)}
                      title={`Risiko: ${entry.riskLevel}`}
                    />
                  ))}
                </div>
              );
              if (cat === "standard_exterior") {
                return (
                  <div key={cat}>
                    <span className="text-xs text-muted-foreground">
                      {CATEGORY_LABELS_DE[cat]}
                    </span>
                    {chips}
                  </div>
                );
              }
              return (
                <details key={cat} className="rounded-md border p-2">
                  <summary className="text-xs text-muted-foreground cursor-pointer">
                    {CATEGORY_LABELS_DE[cat]} ({entries.length})
                  </summary>
                  {chips}
                </details>
              );
            },
          )}
        </section>

        <section className="space-y-2">
          <span className="text-xs font-medium">Ausgabeformate</span>
          <div className="flex flex-wrap gap-2">
            {OUTPUT_FORMATS.map((format) => (
              <ToggleChip
                key={format}
                label={format}
                pressed={selectedFormats.includes(format)}
                onClick={() => toggleFormat(format)}
              />
            ))}
          </div>
          {selectedFormats.length === 0 && (
            <p className="text-xs text-destructive">
              Bitte mindestens ein Ausgabeformat auswählen.
            </p>
          )}
        </section>

        {orderedTargets.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            Keine Zielperspektive ausgewählt — kein Preflight-Ergebnis.
          </p>
        ) : plan.error ? (
          <div className="rounded-md border border-destructive/50 bg-destructive/5 p-3 text-xs text-destructive">
            Preflight fehlgeschlagen — Plan nicht ermittelbar: {plan.error}
          </div>
        ) : summary && plan.output ? (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <Badge variant="outline" className={STATE_STYLE.READY}>
                READY {summary.readyCount}
              </Badge>
              <Badge variant="outline" className={STATE_STYLE.REVIEW}>
                REVIEW {summary.reviewCount}
              </Badge>
              <Badge variant="outline" className={STATE_STYLE.BLOCKED}>
                BLOCKED {summary.blockedCount}
              </Badge>
              {summary.generationAllowed ? (
                <span className="text-accent">Preflight bestanden</span>
              ) : (
                <span className="text-muted-foreground">
                  Preflight nicht bestanden — für diese Auswahl blockiert.
                </span>
              )}
            </div>
            <div className="space-y-2">
              {plan.output.items.map((item) => (
                <PlannedItemCard
                  key={item.perspectiveSpecId}
                  item={item}
                  master={vehicleMaster}
                  labelFor={labelFor}
                />
              ))}
            </div>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

export default OutputPlannerPanel;
