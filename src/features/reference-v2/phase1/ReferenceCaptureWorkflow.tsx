import { useMemo, useRef, useState } from "react";
import { AlertTriangle, CheckCircle2, ImagePlus, Loader2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import type { PerspectiveId } from "../domain/perspectives/types";
import { getPerspectiveSpec } from "../domain/perspectives/registry";
import type { VisionIntakeResult } from "../domain/vision-intake";
import {
  getPerspectiveMasterEntry,
  listMasterPerspectivesForClass,
} from "./perspective-master";
import { evaluateIngestion } from "./ingestion";
import { BLOCKER_LABELS_DE, type VehicleMasterRecord } from "./vehicle-master";
import { useReferenceStore } from "./reference-store";

/**
 * Reference V2 — Phase 1: ReferenceCaptureWorkflow.
 *
 * Perspektivgeführte Aufnahme/Erfassung. Die Bildanalyse ist in Phase 1
 * bewusst admin-deklarativ (kein Vision-Provider) — das Ergebnis wird jedoch
 * exakt in das Phase-0-`VisionIntakeResult` geschrieben, damit Phase 2 den
 * Provider ohne Vertragsänderung ersetzen kann.
 */

interface DeclaredIntake {
  azimuthDeg: number;
  fullVehicleVisible: boolean;
  paddingPct: number;
  sharpness: number;
  occlusion: number;
  glare: number;
  resolutionAdequacy: number;
  sameVehicleConfirmed: boolean;
  mirroredSuspected: boolean;
  vehicleDetected: boolean;
}

const DEFAULT_DECLARED: Omit<DeclaredIntake, "azimuthDeg"> = {
  fullVehicleVisible: true,
  paddingPct: 12,
  sharpness: 0.85,
  occlusion: 0.05,
  glare: 0.1,
  resolutionAdequacy: 0.9,
  sameVehicleConfirmed: true,
  mirroredSuspected: false,
  vehicleDetected: true,
};

function buildIntake(
  assetId: string,
  master: VehicleMasterRecord,
  perspectiveId: PerspectiveId,
  d: DeclaredIntake,
): VisionIntakeResult {
  const spec = getPerspectiveSpec(perspectiveId);
  const surfaceSet = new Set<string>(spec.requiredVisibleSurfaces);
  const vis = (s: string) => (surfaceSet.has(s) ? 0.95 : 0.15);
  return {
    schemaVersion: 1,
    assetId,
    vehicleDetected: d.vehicleDetected,
    vehicleClass: master.vehicleClass,
    identityClusterId: d.sameVehicleConfirmed
      ? master.identityClusterId
      : `foreign_${assetId}`,
    sameVehicleConfidence: d.sameVehicleConfirmed ? 0.95 : 0.1,
    pose: {
      canonicalPerspectiveId: perspectiveId,
      ...(getPerspectiveMasterEntry(perspectiveId).azimuthDeg !== null
        ? { azimuthDeg: d.azimuthDeg }
        : {}),
      elevationProfile: spec.pose.elevationProfile,
    },
    visibility: {
      front: vis("front"),
      rear: vis("rear"),
      leftSide: vis("left_side"),
      rightSide: vis("right_side"),
      roof: vis("roof"),
      surfaces: Object.fromEntries(
        spec.requiredVisibleSurfaces.map((s) => [s, 0.95]),
      ) as VisionIntakeResult["visibility"]["surfaces"],
    },
    framing: {
      fullVehicleVisible: d.fullVehicleVisible,
      cropped: !d.fullVehicleVisible,
      visibleWheelPositions: d.fullVehicleVisible
        ? [...spec.framing.requiredVisibleWheels]
        : [],
    },
    quality: {
      sharpness: d.sharpness,
      occlusion: d.occlusion,
      glare: d.glare,
      resolutionAdequacy: d.resolutionAdequacy,
      usableScore: Math.max(
        0,
        Math.min(1, (d.sharpness + d.resolutionAdequacy) / 2 - d.occlusion / 2),
      ),
    },
    classificationConfidence: 0.9,
    issues: [
      ...(d.mirroredSuspected
        ? [
            {
              code: "MIRRORED_SUSPECTED",
              severity: "critical" as const,
              message: "Bild wirkt gespiegelt",
            },
          ]
        : []),
      ...(d.vehicleDetected
        ? []
        : [
            {
              code: "NO_VEHICLE",
              severity: "critical" as const,
              message: "Kein Fahrzeug erkannt",
            },
          ]),
    ],
  };
}

export function ReferenceCaptureWorkflow({
  master,
}: {
  master: VehicleMasterRecord;
}) {
  const { ingestAsset } = useReferenceStore();
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  const perspectives = useMemo(
    () => listMasterPerspectivesForClass(master.vehicleClass),
    [master.vehicleClass],
  );
  const [perspectiveId, setPerspectiveId] = useState<PerspectiveId>(
    perspectives[0]?.id ?? "EXT_FRONT",
  );
  const masterEntry = getPerspectiveMasterEntry(perspectiveId);

  const [declared, setDeclared] = useState<DeclaredIntake>({
    ...DEFAULT_DECLARED,
    azimuthDeg: masterEntry.azimuthDeg ?? 0,
  });

  const patch = (p: Partial<DeclaredIntake>) =>
    setDeclared((prev) => ({ ...prev, ...p }));

  const onPerspectiveChange = (value: string) => {
    const id = value as PerspectiveId;
    setPerspectiveId(id);
    patch({ azimuthDeg: getPerspectiveMasterEntry(id).azimuthDeg ?? 0 });
  };

  const preview = useMemo(() => {
    const intake = buildIntake("preview", master, perspectiveId, declared);
    return evaluateIngestion({
      vehicleClass: master.vehicleClass,
      identityClusterId: master.identityClusterId,
      requestedPerspectiveId: perspectiveId,
      intake,
      framing: {
        sourceAspectRatio: 3 / 2,
        fullVehicleVisible: declared.fullVehicleVisible,
        paddingPct: declared.paddingPct,
      },
      fileAvailable: true,
    });
  }, [master, perspectiveId, declared]);

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setBusy(true);
    try {
      for (const file of Array.from(files)) {
        const previewUrl = URL.createObjectURL(file);
        const ratio = await new Promise<number>((resolve) => {
          const img = new Image();
          img.onload = () => resolve(img.naturalWidth / img.naturalHeight || 1.5);
          img.onerror = () => resolve(1.5);
          img.src = previewUrl;
        });
        const assetId = `${file.name}-${Date.now()}`;
        const asset = ingestAsset({
          vehicleMasterId: master.id,
          requestedPerspectiveId: perspectiveId,
          fileName: file.name,
          previewUrl,
          intake: buildIntake(assetId, master, perspectiveId, declared),
          framing: {
            sourceAspectRatio: ratio,
            fullVehicleVisible: declared.fullVehicleVisible,
            paddingPct: declared.paddingPct,
          },
          fileAvailable: true,
        });
        if (asset.role === "rejected") {
          toast.error(
            `${file.name} abgewiesen: ${asset.blockers.map((b) => BLOCKER_LABELS_DE[b]).join(", ")}`,
          );
        } else if (asset.role === "secondary_support") {
          toast.warning(`${file.name} nur als Sekundärreferenz übernommen.`);
        } else {
          toast.success(`${file.name} als Primärkandidat übernommen.`);
        }
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erfassung fehlgeschlagen");
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const RoleIcon =
    preview.role === "rejected"
      ? XCircle
      : preview.role === "secondary_support"
        ? AlertTriangle
        : CheckCircle2;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Referenz erfassen</CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="space-y-2">
          <Label>Perspektive (PerspectiveMaster v1)</Label>
          <Select value={perspectiveId} onValueChange={onPerspectiveChange}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="max-h-72">
              {perspectives.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.labelDe} — {p.id}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            v{masterEntry.version} · {masterEntry.category} ·{" "}
            {masterEntry.azimuthDeg === null
              ? "kein Azimut (semantisch)"
              : `${masterEntry.azimuthDeg}° ±${masterEntry.azimuthToleranceDeg}°`}{" "}
            · {masterEntry.targetFocalLengthMm} mm · Mindestscore{" "}
            {masterEntry.minimumPerspectiveScore}
          </p>
        </div>

        {masterEntry.azimuthDeg !== null && (
          <div className="space-y-2">
            <Label>
              Gemessener Azimut: {declared.azimuthDeg}° (Soll{" "}
              {masterEntry.azimuthDeg}°)
            </Label>
            <Slider
              min={-180}
              max={180}
              step={1}
              value={[declared.azimuthDeg]}
              onValueChange={([v]) => patch({ azimuthDeg: v })}
            />
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>Rand um das Fahrzeug: {declared.paddingPct}%</Label>
            <Slider
              min={0}
              max={40}
              step={1}
              value={[declared.paddingPct]}
              onValueChange={([v]) => patch({ paddingPct: v })}
            />
          </div>
          <div className="space-y-2">
            <Label>Schärfe: {declared.sharpness.toFixed(2)}</Label>
            <Slider
              min={0}
              max={1}
              step={0.05}
              value={[declared.sharpness]}
              onValueChange={([v]) => patch({ sharpness: v })}
            />
          </div>
          <div className="space-y-2">
            <Label>Verdeckung (Severity): {declared.occlusion.toFixed(2)}</Label>
            <Slider
              min={0}
              max={1}
              step={0.05}
              value={[declared.occlusion]}
              onValueChange={([v]) => patch({ occlusion: v })}
            />
          </div>
          <div className="space-y-2">
            <Label>Glare (Severity): {declared.glare.toFixed(2)}</Label>
            <Slider
              min={0}
              max={1}
              step={0.05}
              value={[declared.glare]}
              onValueChange={([v]) => patch({ glare: v })}
            />
          </div>
          <div className="space-y-2">
            <Label>
              Auflösung: {declared.resolutionAdequacy.toFixed(2)}
            </Label>
            <Slider
              min={0}
              max={1}
              step={0.05}
              value={[declared.resolutionAdequacy]}
              onValueChange={([v]) => patch({ resolutionAdequacy: v })}
            />
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <div className="flex items-center justify-between rounded-md border border-border p-3">
            <Label className="text-xs">Fahrzeug vollständig</Label>
            <Switch
              checked={declared.fullVehicleVisible}
              onCheckedChange={(v) => patch({ fullVehicleVisible: v })}
            />
          </div>
          <div className="flex items-center justify-between rounded-md border border-border p-3">
            <Label className="text-xs">Gleiches Fahrzeug</Label>
            <Switch
              checked={declared.sameVehicleConfirmed}
              onCheckedChange={(v) => patch({ sameVehicleConfirmed: v })}
            />
          </div>
          <div className="flex items-center justify-between rounded-md border border-border p-3">
            <Label className="text-xs">Spiegelung vermutet</Label>
            <Switch
              checked={declared.mirroredSuspected}
              onCheckedChange={(v) => patch({ mirroredSuspected: v })}
            />
          </div>
        </div>

        <div className="rounded-md border border-border bg-muted/40 p-3 space-y-2">
          <div className="flex items-center gap-2 text-sm font-medium">
            <RoleIcon className="w-4 h-4" />
            Vorabbewertung: {preview.role} · Score{" "}
            {preview.weightedScore.toFixed(1)}
          </div>
          <div className="flex flex-wrap gap-1">
            {preview.blockers.map((b) => (
              <Badge key={b} variant="destructive" className="text-[10px]">
                {BLOCKER_LABELS_DE[b]}
              </Badge>
            ))}
            {preview.outputReadyFormats.map((f) => (
              <Badge key={f} variant="secondary" className="text-[10px]">
                {f} bereit
              </Badge>
            ))}
          </div>
          {preview.warnings.length > 0 && (
            <ul className="text-xs text-muted-foreground list-disc pl-4">
              {preview.warnings.map((w) => (
                <li key={w}>{w}</li>
              ))}
            </ul>
          )}
        </div>

        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => handleFiles(e.target.files)}
        />
        <Button
          className="w-full"
          disabled={busy}
          onClick={() => fileRef.current?.click()}
        >
          {busy ? (
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          ) : (
            <ImagePlus className="w-4 h-4 mr-2" />
          )}
          Referenzbild(er) für {masterEntry.labelDe} erfassen
        </Button>
      </CardContent>
    </Card>
  );
}

export default ReferenceCaptureWorkflow;
