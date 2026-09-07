import { useMemo, useState } from "react";
import { Download, Loader2, Sparkles, XCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import type { PerspectiveId } from "../domain/perspectives/types";
import type { VehicleMasterRecord } from "../phase1/vehicle-master";
import { listMasterPerspectivesForClass } from "../phase1/perspective-master";
import { OUTPUT_FORMATS } from "../phase1/output-format-policy";
import { useCurrentFramingEvidenceRuntime } from "../phase2/framing-evidence-runtime";
import { buildReferencePlannerFromCurrentFramingSidecar } from "../phase2/planner-from-framing-sidecar";
import type { PlannerItem } from "../phase2/planner-contract";
import {
  GENERATION_TIERS,
  generateFromPlannerItem,
  type GeneratedReferenceImage,
  type GenerationTier,
} from "./generation-client";

/**
 * Reference V2 — Phase 3: Generierung aus dem eingefrorenen Preflight-Plan.
 * Es werden ausschliesslich Perspektiven angeboten, die der Planner mit
 * READY / generationAllowed freigegeben hat.
 */

const TIER_LABELS: Record<GenerationTier, string> = {
  economy: "Schnell",
  standard: "Qualität",
  premium: "Premium",
};

const PLANNER_POLICY = {
  maxSecondaryReferences: 2,
  allowAdjacentSubstitution: false,
} as const;

interface ResultState {
  readonly status: "pending" | "done" | "error";
  readonly image?: GeneratedReferenceImage;
  readonly error?: string;
}

export function GenerationPanel({
  vehicleMaster,
}: {
  vehicleMaster: VehicleMasterRecord;
}) {
  const runtime = useCurrentFramingEvidenceRuntime();
  const [tier, setTier] = useState<GenerationTier>("standard");
  const [results, setResults] = useState<Record<string, ResultState>>({});
  const [busy, setBusy] = useState(false);

  const applicable = useMemo(
    () => listMasterPerspectivesForClass(vehicleMaster.vehicleClass),
    [vehicleMaster.vehicleClass],
  );

  const labelFor = useMemo(() => {
    const labels = new Map<PerspectiveId, string>(
      applicable.map((p) => [p.id, p.labelDe]),
    );
    return (id: PerspectiveId) => labels.get(id) ?? id;
  }, [applicable]);

  const readyItems = useMemo<readonly PlannerItem[]>(() => {
    const targets = applicable.map((p) => p.id);
    if (targets.length === 0) return [];
    try {
      const output = buildReferencePlannerFromCurrentFramingSidecar({
        plannerInput: {
          vehicleMaster,
          requestedPerspectiveIds: targets,
          requestedOutputFormats: [...OUTPUT_FORMATS],
          policy: PLANNER_POLICY,
          nowIso: new Date().toISOString(),
        },
        framingSidecar: runtime.getCurrentFramingEvidenceSidecar(
          vehicleMaster.id,
        ),
      });
      return output.items.filter((i) => i.generationAllowed);
    } catch {
      return [];
    }
  }, [applicable, vehicleMaster, runtime]);

  const runOne = async (item: PlannerItem) => {
    setResults((prev) => ({
      ...prev,
      [item.perspectiveSpecId]: { status: "pending" },
    }));
    try {
      const image = await generateFromPlannerItem({
        master: vehicleMaster,
        item,
        tier,
      });
      setResults((prev) => ({
        ...prev,
        [item.perspectiveSpecId]: { status: "done", image },
      }));
    } catch (e) {
      const message =
        e instanceof Error ? e.message : "Generierung fehlgeschlagen.";
      setResults((prev) => ({
        ...prev,
        [item.perspectiveSpecId]: { status: "error", error: message },
      }));
      toast.error(`${labelFor(item.perspectiveSpecId)}: ${message}`);
    }
  };

  const runAll = async () => {
    setBusy(true);
    try {
      for (const item of readyItems) {
        await runOne(item);
      }
    } finally {
      setBusy(false);
    }
  };

  const download = (item: PlannerItem, image: GeneratedReferenceImage) => {
    const link = document.createElement("a");
    link.href = image.dataUrl;
    link.download = `${vehicleMaster.id}-${item.perspectiveSpecId}.png`;
    document.body.appendChild(link);
    link.click();
    link.remove();
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Sparkles className="w-4 h-4" />
          Bildgenerierung (Strict Reference)
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          Generiert wird ausschließlich aus den freigegebenen Referenzbildern.
          Keine Marken-, Modell- oder Baujahrdaten gelangen in die Generierung.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-medium">Qualitätsstufe</span>
          {GENERATION_TIERS.map((t) => (
            <button
              key={t}
              type="button"
              aria-pressed={tier === t}
              onClick={() => setTier(t)}
              className={`rounded-full border px-3 py-1 text-xs transition ${
                tier === t
                  ? "border-accent bg-accent/10"
                  : "border-border text-muted-foreground hover:bg-muted"
              }`}
            >
              {TIER_LABELS[t]}
            </button>
          ))}
          <div className="ml-auto flex items-center gap-2">
            <Badge variant="outline" className="text-[10px]">
              {readyItems.length} freigegeben
            </Badge>
            <Button
              size="sm"
              className="h-8 text-xs"
              disabled={busy || readyItems.length === 0}
              onClick={runAll}
            >
              {busy ? (
                <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" />
              ) : (
                <Sparkles className="w-3.5 h-3.5 mr-1" />
              )}
              Alle generieren
            </Button>
          </div>
        </div>

        {readyItems.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            Noch keine Perspektive freigegeben. Es werden nur Perspektiven
            generiert, für die eine exakte, geprüfte Primärreferenz vorliegt.
          </p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {readyItems.map((item) => {
              const result = results[item.perspectiveSpecId];
              return (
                <div
                  key={item.perspectiveSpecId}
                  className="rounded-lg border border-border p-3 space-y-2"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">
                      {labelFor(item.perspectiveSpecId)}
                    </span>
                    <span className="text-[11px] text-muted-foreground">
                      {item.perspectiveSpecId}
                    </span>
                  </div>

                  <div className="aspect-video rounded-md border border-border bg-muted/40 overflow-hidden flex items-center justify-center">
                    {result?.status === "done" && result.image ? (
                      <img
                        src={result.image.dataUrl}
                        alt={`Generiert: ${labelFor(item.perspectiveSpecId)}`}
                        className="w-full h-full object-cover"
                      />
                    ) : result?.status === "pending" ? (
                      <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                    ) : result?.status === "error" ? (
                      <span className="flex items-center gap-1 px-3 text-[11px] text-destructive text-center">
                        <XCircle className="w-3.5 h-3.5 shrink-0" />
                        {result.error}
                      </span>
                    ) : (
                      <span className="text-[11px] text-muted-foreground">
                        noch nicht generiert
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs"
                      disabled={busy || result?.status === "pending"}
                      onClick={() => void runOne(item)}
                    >
                      {result?.status === "done"
                        ? "Neu generieren"
                        : "Generieren"}
                    </Button>
                    {result?.status === "done" && result.image && (
                      <>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 text-xs"
                          onClick={() => download(item, result.image!)}
                        >
                          <Download className="w-3.5 h-3.5 mr-1" />
                          Download
                        </Button>
                        <span className="text-[10px] text-muted-foreground ml-auto">
                          {result.image.model}
                        </span>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default GenerationPanel;
