import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  ImagePlus,
  Loader2,
  ShieldAlert,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import type {
  ReferenceAssetRecord,
  VehicleMasterRecord,
} from "../phase1/vehicle-master";
import type { SourceFramingInput } from "../phase1/output-format-policy";
import { BLOCKER_LABELS_DE } from "../phase1/vehicle-master";
import { listMasterPerspectivesForClass } from "../phase1/perspective-master";
import { useReferenceStore } from "../phase1/reference-store";
import {
  analyzeFileBatch,
  type AutomaticIntakeOutcome,
  type AutomaticIntakeProgress,
} from "./analysis-coordinator";
import {
  supabaseAnalyzerPort,
  toAnchorFileReferences,
  type ReferenceV2FileReference,
} from "./provider-adapter";
import { useCurrentFramingEvidenceRuntime } from "../phase2/framing-evidence-runtime";


/**
 * Reference V2 — Phase 1.5: Automatischer Referenz-Intake (Produktivpfad).
 *
 * The reference image defines WHAT the vehicle is. Metadata only describes
 * what we know ABOUT it. Metadata must never override visible vehicle identity.
 *
 * Der Admin waehlt KEINE Perspektive mehr: Vision klassifiziert jede Aufnahme
 * gegen PerspectiveMaster v1, danach entscheidet ausschliesslich die
 * bestehende Phase-1-Governance ueber Primary / Secondary / Rejected.
 */

interface Row {
  readonly fileName: string;
  readonly stage: AutomaticIntakeProgress["stage"];
  readonly message?: string;
  readonly outcome?: AutomaticIntakeOutcome;
  readonly role?: string;
  readonly blockers?: readonly string[];
}

const STAGE_LABEL: Record<AutomaticIntakeProgress["stage"], string> = {
  queued: "In Warteschlange",
  uploading: "Upload",
  analyzing: "KI-Analyse",
  classified: "Perspektive erkannt",
  governed: "Governance abgeschlossen",
  failed: "Abgewiesen",
};

/**
 * STRIKT: kein Ersatzwert. Schlaegt das Dekodieren fehl oder sind die
 * natuerlichen Dimensionen ungueltig, wird abgelehnt. Die alte
 * Phase-1-Governance bleibt unveraendert, weil der eingefrorene Coordinator
 * diesen Fehler faengt und seinen historischen Ersatzwert anwendet.
 */
async function measureAspectRatio(file: File): Promise<number> {
  const url = URL.createObjectURL(file);
  try {
    return await new Promise<number>((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const w = img.naturalWidth;
        const h = img.naturalHeight;
        if (!Number.isFinite(w) || !Number.isFinite(h) || w <= 0 || h <= 0) {
          reject(new Error("invalid natural image dimensions"));
          return;
        }
        const ratio = w / h;
        if (!Number.isFinite(ratio) || ratio <= 0) {
          reject(new Error("invalid aspect ratio"));
          return;
        }
        resolve(ratio);
      };
      img.onerror = () => reject(new Error("image decode failed"));
      img.src = url;
    });
  } finally {
    URL.revokeObjectURL(url);
  }
}

export interface ReferenceIntakePersistInput {
  readonly asset: ReferenceAssetRecord;
  readonly file: File;
  readonly framing: SourceFramingInput;
}

export function AutomaticReferenceIntake({
  master,
  onPersistAsset,
}: {
  master: VehicleMasterRecord;
  /**
   * Phase 2.6D: optionale durable Persistenz. Fehlt der Handler, bleibt der
   * Intake exakt wie bisher rein lokal.
   */
  onPersistAsset?: (input: ReferenceIntakePersistInput) => Promise<void>;
}) {
  const { ingestAsset } = useReferenceStore();
  const { recordCurrentFramingEvidence } = useCurrentFramingEvidenceRuntime();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [rows, setRows] = useState<Row[]>([]);
  /** Alle noch nicht freigegebenen Object-URLs dieses Komponentenlebens. */
  const objectUrlsRef = useRef<Set<string>>(new Set());

  const releaseUrl = useCallback((url: string | undefined) => {
    if (!url) return;
    if (objectUrlsRef.current.delete(url)) URL.revokeObjectURL(url);
  }, []);

  useEffect(() => {
    const urls = objectUrlsRef.current;
    return () => {
      urls.forEach((u) => URL.revokeObjectURL(u));
      urls.clear();
    };
  }, []);

  const allowedPerspectiveIds = useMemo(
    () => listMasterPerspectivesForClass(master.vehicleClass).map((p) => p.id),
    [master.vehicleClass],
  );

  /**
   * Wenige Anker (max. 3) — geschuetzte/primaere Referenzen zuerst.
   * FAIL-CLOSED: Analysen ohne bekannten MIME-Type werden uebersprungen; ein
   * MIME-Type wird niemals geraten.
   */
  const anchorFiles: readonly ReferenceV2FileReference[] = useMemo(() => {
    return toAnchorFileReferences(
      master.assets
        .filter((a) => a.role === "primary" || a.protection === "protected")
        .map((a) => a.analysis)
        .filter((x): x is NonNullable<typeof x> => Boolean(x)),
    );
  }, [master.assets]);


  const patchRow = useCallback((fileName: string, patch: Partial<Row>) => {
    setRows((prev) =>
      prev.map((r) => (r.fileName === fileName ? { ...r, ...patch } : r)),
    );
  }, []);

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const list = Array.from(files);
    setRows(list.map((f) => ({ fileName: f.name, stage: "queued" as const })));
    setBusy(true);

    // Index-basierte Paarung: Dateinamen sind NICHT eindeutig.
    const previewByIndex: string[] = list.map((f) => {
      const url = URL.createObjectURL(f);
      objectUrlsRef.current.add(url);
      return url;
    });

    try {
      const outcomes = await analyzeFileBatch(
        list,
        {
          vehicleClass: master.vehicleClass,
          identityClusterId: master.identityClusterId,
          allowedPerspectiveIds,
          anchorFiles,
        },
        {
          port: supabaseAnalyzerPort,
          measureAspectRatio,
          onProgress: (p) =>
            patchRow(p.fileName, { stage: p.stage, message: p.message }),
        },
      );

      for (let index = 0; index < outcomes.length; index += 1) {
        const outcome = outcomes[index];
        const originalFile = list[index];
        const previewUrl = previewByIndex[index];
        // Fail-closed: nur vollstaendig analysierte Aufnahmen erreichen
        // ueberhaupt die Phase-1-Governance.
        if (!outcome.ok || !outcome.intake || !outcome.framing || !outcome.perspectiveId) {
          patchRow(outcome.fileName, {
            stage: "failed",
            message: outcome.errorMessage,
            outcome,
          });
          toast.error(`${outcome.fileName}: ${outcome.errorMessage ?? "abgewiesen"}`);
          // Abgewiesene Dateien werden nicht angezeigt — Preview sofort freigeben.
          releaseUrl(previewUrl);
          continue;
        }
        try {
          const asset = ingestAsset({
            vehicleMasterId: master.id,
            requestedPerspectiveId: outcome.perspectiveId,
            fileName: outcome.fileName,
            previewUrl: previewUrl ?? "",
            intake: outcome.intake,
            framing: outcome.framing,
            fileAvailable: true,
            analysis: outcome.analysis,
            isAutomatic: true,
          });
          patchRow(outcome.fileName, {
            stage: "governed",
            outcome,
            role: asset.role,
            blockers: asset.blockers.map((b) => BLOCKER_LABELS_DE[b]),
          });

          // Phase 2.4D: aktuelle Framing-Evidenz AUSSCHLIESSLICH unter der
          // persistierten Asset-ID, erst nach erfolgreicher Ingestion.
          // Kein Ersatzwert: schlaegt die strikte Messung fehl, bleibt die
          // Evidenz fehlend (fail-closed), das Asset bleibt ingestiert.
          try {
            const strictAspectRatio = await measureAspectRatio(originalFile);
            recordCurrentFramingEvidence(master.id, asset.id, {
              sourceAspectRatio: strictAspectRatio,
              fullVehicleVisible: outcome.intake.framing.fullVehicleVisible,
              cropped: outcome.intake.framing.cropped,
              paddingPct: outcome.framing.paddingPct,
            });
          } catch {
            toast.warning(
              `${outcome.fileName}: aktuelle Format-Evidenz nicht messbar.`,
            );
          }

          // Phase 2.6D: durable Persistenz (Original + DB). Schlaegt sie fehl,
          // bleibt das Asset lokal sichtbar, wird aber klar als nicht
          // gespeichert gemeldet — kein stiller Datenverlust.
          if (onPersistAsset) {
            try {
              await onPersistAsset({
                asset,
                file: originalFile,
                framing: outcome.framing,
              });
            } catch (e) {
              toast.error(
                `${outcome.fileName}: nicht dauerhaft gespeichert — ${
                  e instanceof Error ? e.message : "unbekannter Fehler"
                }`,
              );
            }
          }


          if (asset.role === "rejected") {
            toast.error(
              `${outcome.fileName} abgewiesen: ${asset.blockers
                .map((b) => BLOCKER_LABELS_DE[b])
                .join(", ")}`,
            );
          } else if (asset.role === "secondary_support") {
            toast.warning(`${outcome.fileName}: nur Sekundärreferenz.`);
          } else {
            toast.success(
              `${outcome.fileName}: Primär-Kandidat (${outcome.perspectiveId}).`,
            );
          }
        } catch (e) {
          releaseUrl(previewUrl);
          patchRow(outcome.fileName, {
            stage: "failed",
            message: e instanceof Error ? e.message : "Ingestion fehlgeschlagen",
          });
        }
      }
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <ShieldAlert className="h-4 w-4" />
          Referenzen hochladen — automatische KI-Analyse
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-xs text-muted-foreground">
          Perspektive, Seite, Azimut und Bildqualität werden ausschließlich aus
          dem Bild bestimmt. Es werden keine Fahrzeugdaten (Marke, Modell,
          Baujahr, VIN) an die Analyse übergeben.
        </p>

        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          multiple
          className="hidden"
          onChange={(e) => handleFiles(e.target.files)}
        />
        <Button
          onClick={() => inputRef.current?.click()}
          disabled={busy}
          className="w-full"
        >
          {busy ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <ImagePlus className="h-4 w-4 mr-2" />
          )}
          Bilder auswählen
        </Button>

        {rows.length > 0 && (
          <div className="space-y-2">
            {rows.map((row) => {
              const r = row.outcome?.response;
              const Icon =
                row.stage === "failed" || row.role === "rejected"
                  ? XCircle
                  : row.role === "secondary_support"
                    ? AlertTriangle
                    : row.stage === "governed"
                      ? CheckCircle2
                      : Loader2;
              return (
                <div key={row.fileName} className="rounded-md border p-3 space-y-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-medium truncate flex items-center gap-2">
                      <Icon
                        className={`h-3.5 w-3.5 ${
                          row.stage !== "governed" && row.stage !== "failed"
                            ? "animate-spin"
                            : ""
                        }`}
                      />
                      {row.fileName}
                    </span>
                    <Badge
                      variant={
                        row.role === "rejected" || row.stage === "failed"
                          ? "destructive"
                          : row.role === "primary_candidate"
                            ? "default"
                            : "secondary"
                      }
                    >
                      {row.stage === "governed"
                        ? row.role === "primary_candidate"
                          ? "Primär-Kandidat"
                          : row.role === "secondary_support"
                            ? "Sekundär"
                            : "Abgewiesen"
                        : STAGE_LABEL[row.stage]}
                    </Badge>
                  </div>
                  {r && (
                    <div className="text-[11px] text-muted-foreground">
                      {r.canonicalPerspectiveId ?? "Perspektive unbestimmt"} ·
                      Konfidenz {(r.perspectiveConfidence * 100).toFixed(0)}% ·
                      Klasse {r.vehicleClass ?? "?"} ·
                      {r.azimuthDeg !== null ? ` ${r.azimuthDeg.toFixed(0)}° ·` : ""}
                      {r.framing.cropped ? " angeschnitten ·" : " vollständig ·"}
                      {r.sameVehicleConfidence !== null
                        ? ` Identität ${(r.sameVehicleConfidence * 100).toFixed(0)}%`
                        : " kein Anker"}
                    </div>
                  )}
                  {row.message && (
                    <div className="text-[11px] text-destructive">{row.message}</div>
                  )}
                  {row.blockers && row.blockers.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {row.blockers.map((b) => (
                        <Badge key={b} variant="destructive" className="text-[10px]">
                          {b}
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
