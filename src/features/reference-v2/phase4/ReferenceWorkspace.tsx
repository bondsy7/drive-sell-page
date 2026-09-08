import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Download,
  ImagePlus,
  Loader2,
  RefreshCw,
  Sparkles,
  XCircle,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import type { PerspectiveId } from "../domain/perspectives/types";
import { VEHICLE_CLASSES_V2, type VehicleClassV2 } from "../domain/vehicle-classes";
import {
  getPerspectiveMasterEntry,
  listMasterPerspectivesForClass,
} from "../phase1/perspective-master";
import {
  ReferenceStoreProvider,
  useReferenceStore,
} from "../phase1/reference-store";
import { CurrentFramingEvidenceRuntimeProvider } from "../phase2/framing-evidence-runtime";
import { useReferenceV2Persistence } from "../phase2/use-reference-v2-persistence";
import {
  analyzeFilesConcurrently,
  DEFAULT_INTAKE_CONCURRENCY,
  friendlyIntakeError,
  isTransientIntakeError,
} from "../phase1-5/concurrent-intake";

import {
  supabaseAnalyzerPort,
  toAnchorFileReferences,
} from "../phase1-5/provider-adapter";
import {
  normalizeReferenceFile,
  ReferenceFileNormalizationError,
} from "../phase1-5/normalize-reference-file";
import { GENERATION_TIERS, type GenerationTier } from "../phase3/generation-client";
import { generateFromAdvisoryReference } from "./advisory-generation";
import { DEFAULT_GENERATION_CONCURRENCY, runBatch } from "./batch-generation";
import { EXTERIOR_MAP_ORDER, ReferenceMap } from "./ReferenceMap";
import {
  applyManualAssignment,
  BASIS_LABELS_DE,
  CAPTURE_STATUS_LABELS_DE,
  chooseGenerationBasis,
  batchTransitionMessage,
  isBatchTerminal,
  reconcileBatchSides,
  removeManualAssignment,
  resolveAll,
  summarizeCapture,
  type BasisKind,
  type CaptureItem,
  type GenerationBasis,
  type ManualAssignment,
  type ManualRole,
} from "./capture-state";

/** Automatische Wiederholungen bei vorübergehenden Analysefehlern. */
const MAX_AUTO_RETRY_ROUNDS = 2;
const AUTO_RETRY_DELAY_MS = 1200;



/**
 * Reference V2 — Phase 4: Nutzeroberflaeche in vier Schritten.
 *
 * Bilder → Referenzmap → Generierung → QA & Ausgabe.
 *
 * Die Analyse beraet, sie blockiert nicht: jedes hochgeladene Bild bleibt
 * sichtbar und zuordenbar, auch wenn die Analyse fehlschlaegt. Die strikte
 * Governance/Preflight-Logik bleibt unveraendert erhalten und ist unter
 * "Technische Details" einsehbar.
 */

const VEHICLE_CLASS_LABELS: Record<VehicleClassV2, string> = {
  car: "Pkw",
  van: "Transporter",
  motorhome: "Wohnmobil",
  truck: "Lkw",
  motorcycle: "Motorrad",
  trailer: "Anhänger",
};

const TIER_LABELS: Record<GenerationTier, string> = {
  economy: "Schnell",
  standard: "Qualität",
  premium: "Premium",
};

type StepId = "images" | "map" | "generate" | "qa";

const STEPS: readonly { id: StepId; label: string }[] = [
  { id: "images", label: "Bilder" },
  { id: "map", label: "Referenzmap" },
  { id: "generate", label: "Generierung" },
  { id: "qa", label: "QA & Ausgabe" },
];

type QaStatus = "checking" | "checked" | "issues";

const QA_LABELS: Record<QaStatus, string> = {
  checking: "Prüfung läuft",
  checked: "Geprüft",
  issues: "Hinweise erkannt",
};

interface GenerationResult {
  readonly status: "pending" | "done" | "error";
  readonly dataUrl?: string;
  readonly model?: string;
  readonly error?: string;
  readonly accepted?: boolean;
  readonly basisKind?: BasisKind;
  readonly qaStatus?: QaStatus;
  /** Nur echte, gemessene Werte — keine erfundenen Scores. */
  readonly qaNote?: string;
}

/**
 * Nachgelagerte, nicht blockierende Pruefung des erzeugten Bildes.
 * Es werden ausschliesslich tatsaechlich messbare Eigenschaften geprueft
 * (Dekodierbarkeit und Bildgroesse) — es werden keine Scores erfunden.
 */
async function inspectGeneratedImage(
  dataUrl: string,
): Promise<{ status: QaStatus; note: string }> {
  return await new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const { naturalWidth: w, naturalHeight: h } = img;
      if (w < 512 || h < 512) {
        resolve({
          status: "issues",
          note: `Auflösung gering: ${w}×${h} px`,
        });
        return;
      }
      resolve({ status: "checked", note: `${w}×${h} px` });
    };
    img.onerror = () =>
      resolve({ status: "issues", note: "Bild konnte nicht gelesen werden." });
    img.src = dataUrl;
  });
}


async function measureAspectRatio(file: File): Promise<number> {
  const url = URL.createObjectURL(file);
  try {
    return await new Promise<number>((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const ratio = img.naturalWidth / img.naturalHeight;
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

function statusTone(status: CaptureItem["status"]): string {
  switch (status) {
    case "analyzed":
      return "border-emerald-500/60 bg-emerald-500/10";
    case "warning":
      return "border-amber-500/60 bg-amber-500/10";
    case "unavailable":
      return "border-border bg-muted/40";
    default:
      return "border-sky-500/50 bg-sky-500/10";
  }
}

function ReferenceWorkspaceInner() {
  const store = useReferenceStore();
  const { activeMaster, createMaster, hydrateMaster, ingestAsset } = store;
  const persistence = useReferenceV2Persistence({ onHydrated: hydrateMaster });

  const [step, setStep] = useState<StepId>("images");
  const [vehicleClass, setVehicleClass] = useState<VehicleClassV2>("car");
  const [items, setItems] = useState<readonly CaptureItem[]>([]);
  const [assignments, setAssignments] = useState<readonly ManualAssignment[]>([]);
  const [results, setResults] = useState<Record<string, GenerationResult>>({});
  const [tier, setTier] = useState<GenerationTier>("standard");
  const [busy, setBusy] = useState(false);
  const [showTechnical, setShowTechnical] = useState(false);
  const [deselectedTargets, setDeselectedTargets] = useState<readonly string[]>([]);
  const [batchAck, setBatchAck] = useState(false);
  const [batchProgress, setBatchProgress] = useState<{
    done: number;
    total: number;
  } | null>(null);
  /** Offene Analysecharge — loest genau EINEN automatischen Wechsel aus. */
  const [pendingBatch, setPendingBatch] = useState<readonly string[] | null>(null);
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);
  const filesRef = useRef<Map<string, File>>(new Map());
  const urlsRef = useRef<Set<string>>(new Set());


  useEffect(() => {
    void persistence.loadVehicles();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const urls = urlsRef.current;
    return () => {
      urls.forEach((u) => URL.revokeObjectURL(u));
      urls.clear();
    };
  }, []);

  // Ein Arbeitsbereich pro Sitzung: kein Formular noetig.
  useEffect(() => {
    if (!activeMaster) {
      createMaster({
        label: `Referenzfahrzeug ${new Date().toLocaleDateString("de-DE")}`,
        vehicleClass,
        colorFamily: null,
      });
    }
  }, [activeMaster, createMaster, vehicleClass]);

  const effectiveClass = activeMaster?.vehicleClass ?? vehicleClass;

  const exteriorTargets = useMemo(
    () =>
      EXTERIOR_MAP_ORDER.filter((id) =>
        listMasterPerspectivesForClass(effectiveClass).some((p) => p.id === id),
      ),
    [effectiveClass],
  );

  const resolutions = useMemo(
    () => resolveAll(exteriorTargets, items, assignments),
    [exteriorTargets, items, assignments],
  );

  const summary = useMemo(
    () => summarizeCapture(items, resolutions),
    [items, resolutions],
  );

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

  const bases = useMemo<readonly GenerationBasis[]>(
    () =>
      exteriorTargets.map((id) =>
        chooseGenerationBasis(id, items, assignments, azimuthDeps),
      ),
    [exteriorTargets, items, assignments, azimuthDeps],
  );

  const basisFor = useCallback(
    (perspectiveId: PerspectiveId) =>
      chooseGenerationBasis(perspectiveId, items, assignments, azimuthDeps),
    [items, assignments, azimuthDeps],
  );

  const selectedTargets = useMemo(
    () => exteriorTargets.filter((id) => !deselectedTargets.includes(id)),
    [exteriorTargets, deselectedTargets],
  );

  const selectedBases = useMemo(
    () => bases.filter((b) => selectedTargets.includes(b.perspectiveId)),
    [bases, selectedTargets],
  );

  const batchCounts = useMemo(
    () => ({
      selected: selectedBases.length,
      optimal: selectedBases.filter((b) => b.kind === "direct").length,
      warning: selectedBases.filter((b) => b.kind === "substitute").length,
      estimated: selectedBases.filter((b) => b.kind === "estimated").length,
      unusable: selectedBases.filter((b) => b.kind === "none").length,
    }),
    [selectedBases],
  );

  // Automatischer Wechsel zur Referenzmap — genau einmal je Upload-Charge.
  useEffect(() => {
    if (!pendingBatch) return;
    if (!isBatchTerminal(items, pendingBatch)) return;
    const message = batchTransitionMessage(items, pendingBatch);
    setPendingBatch(null);
    setStep("map");
    toast.success(message);
  }, [items, pendingBatch]);


  const patchItem = useCallback((id: string, patch: Partial<CaptureItem>) => {
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, ...patch } : i)));
  }, []);

  const analyzeOnce = useCallback(
    async (
      targets: readonly { item: CaptureItem; file: File }[],
    ): Promise<readonly { item: CaptureItem; file: File }[]> => {
      const retryable: { item: CaptureItem; file: File }[] = [];
      if (targets.length === 0 || !activeMaster) return retryable;
      const allowedPerspectiveIds = listMasterPerspectivesForClass(
        activeMaster.vehicleClass,
      ).map((p) => p.id);
      const anchorFiles = toAnchorFileReferences(
        activeMaster.assets
          .filter((a) => a.role === "primary" || a.protection === "protected")
          .map((a) => a.analysis)
          .filter((x): x is NonNullable<typeof x> => Boolean(x)),
      );

      targets.forEach((t) => patchItem(t.item.id, { status: "analyzing" }));

      await analyzeFilesConcurrently(
        targets.map((t) => t.file),
        {
          vehicleClass: activeMaster.vehicleClass,
          identityClusterId: activeMaster.identityClusterId,
          allowedPerspectiveIds,
          anchorFiles,
        },
        { port: supabaseAnalyzerPort, measureAspectRatio },
        {
          concurrency: DEFAULT_INTAKE_CONCURRENCY,
          onOutcome: (outcome, index) => {
            const target = targets[index];
            if (!target) return;
            const id = target.item.id;
            const response = outcome.response;
            const confidence = response?.perspectiveConfidence;
            // Messwerte der Analyse fuer die Seiten-Gegenprobe sichern.
            const sideEvidencePatch: Partial<CaptureItem> = response
              ? {
                  azimuthDeg: response.azimuthDeg ?? null,
                  leftVisibility: response.visibility?.leftSide,
                  rightVisibility: response.visibility?.rightSide,
                  mirroredSuspected: response.mirroredSuspected,
                }
              : {};

            if (!outcome.ok || !outcome.intake || !outcome.framing || !outcome.perspectiveId) {
              if (!outcome.perspectiveId && isTransientIntakeError(outcome.errorMessage)) {
                retryable.push(target);
              }
              patchItem(id, {
                status: outcome.perspectiveId ? "warning" : "unavailable",
                message: friendlyIntakeError(outcome.errorMessage),
                ...(outcome.perspectiveId
                  ? { perspectiveId: outcome.perspectiveId }
                  : {}),
                ...(typeof confidence === "number" ? { confidence } : {}),
                ...sideEvidencePatch,
                diagnostics: [...outcome.gateCodes],
              });
              return;
            }

            // Strikte Governance bleibt erhalten — aber nur als Diagnose.
            let assetId: string | undefined;
            let diagnostics: string[] = [];
            let role: string | undefined;
            try {
              const asset = ingestAsset({
                vehicleMasterId: activeMaster.id,
                requestedPerspectiveId: outcome.perspectiveId,
                fileName: outcome.fileName,
                previewUrl: target.item.previewUrl,
                intake: outcome.intake,
                framing: outcome.framing,
                fileAvailable: true,
                ...(outcome.analysis ? { analysis: outcome.analysis } : {}),
                isAutomatic: true,
              });
              assetId = asset.id;
              role = asset.role;
              diagnostics = [...asset.blockers];
              if (persistence.persistenceReady) {
                void persistence
                  .persistAsset({
                    asset,
                    file: target.file,
                    framing: outcome.framing,
                  })
                  .catch(() => undefined);
              }
            } catch {
              diagnostics = ["INGESTION_DIAGNOSTIC_FAILED"];
            }

            const weak =
              role === "rejected" ||
              diagnostics.length > 0 ||
              (confidence ?? 0) < 0.7;
            patchItem(id, {
              status: weak ? "warning" : "analyzed",
              perspectiveId: outcome.perspectiveId,
              ...(typeof confidence === "number" ? { confidence } : {}),
              ...(assetId ? { assetId } : {}),
              ...sideEvidencePatch,
              diagnostics,
              ...(weak
                ? {
                    message:
                      "Erkennung unsicher — bitte in der Referenzmap bestätigen.",
                  }
                : { message: undefined }),
            });
          },
        },
      );
      return retryable;
    },
    [activeMaster, ingestAsset, patchItem, persistence],
  );

  /** Perspektiven, die es fuer die aktive Fahrzeugklasse wirklich gibt. */
  const isKnownPerspective = useCallback(
    (id: PerspectiveId) =>
      listMasterPerspectivesForClass(effectiveClass).some((p) => p.id === id),
    [effectiveClass],
  );

  const analyzeItems = useCallback(
    async (targets: readonly { item: CaptureItem; file: File }[]) => {
      if (targets.length === 0) return;
      setBusy(true);
      try {
        let pending = targets;
        // Bis zu zwei automatische Wiederholungen — nur bei vorübergehenden
        // Fehlern, damit der Nutzer nicht manuell nachstarten muss.
        for (let round = 0; round <= MAX_AUTO_RETRY_ROUNDS && pending.length > 0; round++) {
          if (round > 0) {
            await new Promise((r) => setTimeout(r, AUTO_RETRY_DELAY_MS));
          }
          pending = await analyzeOnce(pending);
        }
      } finally {
        // Seiten-Gegenprobe und Doppelbelegungen nach jeder Runde anwenden.
        setItems((prev) => reconcileBatchSides(prev, isKnownPerspective));
        setBusy(false);
      }
    },
    [analyzeOnce, isKnownPerspective],
  );


  const handleFiles = useCallback(
    async (fileList: FileList | null) => {
      if (!fileList || fileList.length === 0) return;
      const incoming = Array.from(fileList);

      // 1) Sofort sichtbar machen — noch vor jeder Analyse.
      const created: CaptureItem[] = incoming.map((file) => {
        const url = URL.createObjectURL(file);
        urlsRef.current.add(url);
        const id = `cap_${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36)}`;
        filesRef.current.set(id, file);
        return {
          id,
          fileName: file.name,
          previewUrl: url,
          status: "queued" as const,
        };
      });
      setItems((prev) => [...prev, ...created]);
      setPendingBatch(created.map((c) => c.id));
      if (inputRef.current) inputRef.current.value = "";


      // 2) Normalisieren (AVIF → PNG) und danach nebenlaeufig analysieren.
      const targets: { item: CaptureItem; file: File }[] = [];
      for (const item of created) {
        const original = filesRef.current.get(item.id)!;
        try {
          const normalized = await normalizeReferenceFile(original);
          filesRef.current.set(item.id, normalized);
          targets.push({ item, file: normalized });
        } catch (e) {
          patchItem(item.id, {
            status: "unavailable",
            message:
              e instanceof ReferenceFileNormalizationError
                ? e.message
                : "Format konnte nicht gelesen werden — manuelle Zuordnung möglich.",
          });
        }
      }
      await analyzeItems(targets);
    },
    [analyzeItems, patchItem],
  );

  const retryItem = useCallback(
    async (item: CaptureItem) => {
      const file = filesRef.current.get(item.id);
      if (!file) {
        toast.error("Originaldatei nicht mehr verfügbar — bitte neu hochladen.");
        return;
      }
      await analyzeItems([{ item, file }]);
    },
    [analyzeItems],
  );

  const assign = useCallback(
    (perspectiveId: PerspectiveId, itemId: string, role: ManualRole) => {
      setAssignments((prev) =>
        applyManualAssignment(prev, { perspectiveId, itemId, role }),
      );
      toast.success("Zuordnung gespeichert.");
    },
    [],
  );

  const clearAssignment = useCallback(
    (perspectiveId: PerspectiveId, itemId: string) => {
      setAssignments((prev) => removeManualAssignment(prev, perspectiveId, itemId));
    },
    [],
  );

  const generateOne = useCallback(
    async (perspectiveId: PerspectiveId) => {
      const basis = basisFor(perspectiveId);
      const primary = items.find((i) => i.id === basis.primaryItemId);
      if (!primary) {
        throw new Error(
          "Keine nutzbare Fahrzeugreferenz vorhanden — bitte zuerst ein Bild hochladen.",
        );
      }
      setResults((prev) => ({
        ...prev,
        [perspectiveId]: { status: "pending", basisKind: basis.kind },
      }));
      try {
        const image = await generateFromAdvisoryReference({
          perspectiveId,
          primaryPreviewUrl: primary.previewUrl,
          primaryAssetId: primary.assetId ?? primary.id,
          exactPerspective: basis.kind === "direct" && !basis.warningText,
          secondaryReferences: basis.secondaryItemIds
            .map((id) => items.find((i) => i.id === id))
            .filter((i): i is CaptureItem => Boolean(i))
            .map((i) => ({ assetId: i.assetId ?? i.id, previewUrl: i.previewUrl })),
          tier,
        });
        setResults((prev) => ({
          ...prev,
          [perspectiveId]: {
            status: "done",
            dataUrl: image.dataUrl,
            model: image.model,
            basisKind: basis.kind,
            qaStatus: "checking",
          },
        }));
        // QA laeuft im Hintergrund und verdeckt das Ergebnis nie.
        void inspectGeneratedImage(image.dataUrl).then((qa) => {
          setResults((prev) => {
            const current = prev[perspectiveId];
            if (!current || current.dataUrl !== image.dataUrl) return prev;
            return {
              ...prev,
              [perspectiveId]: {
                ...current,
                qaStatus: qa.status,
                qaNote: qa.note,
              },
            };
          });
        });
      } catch (e) {
        const message =
          e instanceof Error ? e.message : "Generierung fehlgeschlagen.";
        setResults((prev) => ({
          ...prev,
          [perspectiveId]: { status: "error", error: message, basisKind: basis.kind },
        }));
        throw new Error(message);
      }
    },
    [basisFor, items, tier],
  );

  const runGeneration = useCallback(
    async (perspectiveId: PerspectiveId) => {
      const basis = basisFor(perspectiveId);
      if (basis.kind === "none") {
        toast.error(
          "Keine nutzbare Fahrzeugreferenz vorhanden — bitte zuerst Bilder hochladen.",
        );
        return;
      }
      if (basis.requiresAcknowledgement && !batchAck) {
        const ok = window.confirm(
          `${basis.warningText}\n\nTrotzdem generieren?`,
        );
        if (!ok) return;
      }
      setStep("generate");
      try {
        await generateOne(perspectiveId);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Generierung fehlgeschlagen.");
      }
    },
    [basisFor, batchAck, generateOne],
  );

  const runAll = useCallback(async () => {
    const targets = selectedBases.filter((b) => b.kind !== "none");
    if (targets.length === 0) {
      toast.error("Keine nutzbare Fahrzeugreferenz vorhanden.");
      return;
    }
    const needsAck = targets.some((b) => b.requiresAcknowledgement);
    if (needsAck && !batchAck) {
      toast.error(
        "Bitte die Hinweise zu geschätzten Referenzen bestätigen (Checkbox oben).",
      );
      return;
    }
    setStep("generate");
    setBatchProgress({ done: 0, total: targets.length });
    let failed = 0;
    await runBatch(
      targets.map((b) => b.perspectiveId),
      async (key) => {
        await generateOne(key as PerspectiveId);
      },
      {
        concurrency: DEFAULT_GENERATION_CONCURRENCY,
        onOutcome: (o) => {
          if (!o.ok) failed += 1;
        },
        onProgress: (done, total) => setBatchProgress({ done, total }),
      },
    );
    setBatchProgress(null);
    if (failed === 0) {
      toast.success(`${targets.length} Ansichten generiert.`);
    } else {
      toast.warning(
        `${targets.length - failed} von ${targets.length} Ansichten generiert – ${failed} fehlgeschlagen.`,
      );
    }
  }, [batchAck, generateOne, selectedBases]);


  const download = (perspectiveId: string, dataUrl: string) => {
    const link = document.createElement("a");
    link.href = dataUrl;
    link.download = `${perspectiveId}.png`;
    document.body.appendChild(link);
    link.click();
    link.remove();
  };

  const generatedEntries = Object.entries(results).filter(
    ([, r]) => r.status === "done" || r.status === "pending",
  );

  return (
    <div className="space-y-5">
      <header className="space-y-3">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-xl font-bold">Fahrzeug-Referenzen</h1>
          <Badge variant="outline" className="text-[10px]">
            Analyse berät — sie blockiert nicht
          </Badge>
          <div className="ml-auto flex flex-wrap items-center gap-2">
            <Select
              value={effectiveClass}
              onValueChange={(v) => setVehicleClass(v as VehicleClassV2)}
            >
              <SelectTrigger className="h-8 w-36 text-xs">
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
            <Select
              value={persistence.vehicleId ?? undefined}
              onValueChange={(v) => {
                void persistence.selectVehicle(v).then(() => {
                  if (activeMaster) void persistence.bindMaster(activeMaster);
                });
              }}
            >
              <SelectTrigger className="h-8 w-56 text-xs">
                <SelectValue placeholder="Fahrzeug zuordnen (optional)" />
              </SelectTrigger>
              <SelectContent>
                {persistence.vehicles.map((v) => (
                  <SelectItem key={v.id} value={v.id}>
                    {v.display}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Badge
              variant={persistence.persistenceReady ? "default" : "secondary"}
              className="text-[10px]"
            >
              {persistence.persistenceReady ? "Dauerhaft gespeichert" : "Nur Sitzung"}
            </Badge>
          </div>
        </div>

        <ol className="flex flex-wrap items-center gap-2">
          {STEPS.map((s, i) => (
            <li key={s.id}>
              <button
                type="button"
                onClick={() => setStep(s.id)}
                className={`flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs transition ${
                  step === s.id
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border hover:bg-muted"
                }`}
              >
                <span className="font-semibold">{i + 1}</span>
                {s.label}
              </button>
            </li>
          ))}
        </ol>
      </header>

      {step === "images" && (
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,300px)]">
          <Card>
            <CardContent className="p-4">
              <input
                ref={inputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/avif"
                multiple
                className="hidden"
                onChange={(e) => void handleFiles(e.target.files)}
              />
              <button
                type="button"
                onClick={() => inputRef.current?.click()}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  void handleFiles(e.dataTransfer.files);
                }}
                className="flex w-full flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-border px-4 py-10 text-center transition hover:bg-muted/50"
              >
                <ImagePlus className="h-7 w-7 text-muted-foreground" />
                <span className="text-sm font-medium">
                  Bilder hierher ziehen oder auswählen
                </span>
                <span className="text-xs text-muted-foreground">
                  JPEG, PNG, WebP, AVIF · mehrere Bilder gleichzeitig ·
                  Analyse läuft im Hintergrund
                </span>
              </button>

              {items.length > 0 && (
                <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
                  {items.map((item) => (
                    <div
                      key={item.id}
                      className={`rounded-lg border p-2 ${statusTone(item.status)}`}
                    >
                      <div className="aspect-[4/3] overflow-hidden rounded-md bg-background">
                        <img
                          src={item.previewUrl}
                          alt={item.fileName}
                          className="h-full w-full object-cover"
                          loading="lazy"
                        />
                      </div>
                      <div className="mt-1.5 flex items-center gap-1">
                        {item.status === "analyzed" ? (
                          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                        ) : item.status === "warning" ? (
                          <AlertTriangle className="h-3.5 w-3.5 text-amber-600" />
                        ) : item.status === "unavailable" ? (
                          <XCircle className="h-3.5 w-3.5 text-muted-foreground" />
                        ) : (
                          <Loader2 className="h-3.5 w-3.5 animate-spin text-sky-600" />
                        )}
                        <span className="truncate text-[11px] font-medium">
                          {CAPTURE_STATUS_LABELS_DE[item.status]}
                        </span>
                      </div>
                      <p className="truncate text-[10px] text-muted-foreground">
                        {item.fileName}
                      </p>
                      {item.perspectiveId && (
                        <p className="truncate text-[10px]">
                          {getPerspectiveMasterEntry(item.perspectiveId).labelDe}
                          {typeof item.confidence === "number"
                            ? ` · ${(item.confidence * 100).toFixed(0)}%`
                            : ""}
                        </p>
                      )}
                      {item.message && (
                        <p className="mt-0.5 text-[10px] text-muted-foreground">
                          {item.message}
                        </p>
                      )}
                      {(item.status === "warning" ||
                        item.status === "unavailable") && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="mt-1 h-6 w-full text-[10px]"
                          onClick={() => void retryItem(item)}
                        >
                          <RefreshCw className="mr-1 h-3 w-3" />
                          Erneut analysieren
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <div className="space-y-3">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Übersicht</CardTitle>
              </CardHeader>
              <CardContent className="space-y-1.5 text-xs">
                {(
                  [
                    ["Bilder gesamt", `${summary.total}`],
                    ["Analysiert", `${summary.analyzed}`],
                    ["Analyse läuft", `${summary.running}`],
                    ["Warnungen", `${summary.warnings}`],
                    ["Analyse nicht verfügbar", `${summary.unavailable}`],
                    [
                      "Außen abgedeckt",
                      `${summary.coveredPerspectives} / ${summary.totalPerspectives} (${summary.coveragePct}%)`,
                    ],
                  ] as const
                ).map(([k, v]) => (
                  <div key={k} className="flex justify-between gap-2">
                    <span className="text-muted-foreground">{k}</span>
                    <span className="font-medium">{v}</span>
                  </div>
                ))}
                <Button
                  size="sm"
                  className="mt-2 h-8 w-full text-xs"
                  onClick={() => setStep("map")}
                >
                  Weiter zur Referenzmap
                </Button>
                {busy && (
                  <p className="text-[10px] text-muted-foreground">
                    Analyse läuft im Hintergrund — du kannst weiterarbeiten.
                  </p>
                )}
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Tipps für gute Referenzen</CardTitle>
              </CardHeader>
              <CardContent className="space-y-1 text-[11px] text-muted-foreground">
                <p>· Fahrzeug vollständig im Bild, gleichmäßiges Licht.</p>
                <p>· Die acht Außenwinkel rundum aufnehmen.</p>
                <p>· Keine Spiegelung/Seitenwechsel — jede Seite einzeln fotografieren.</p>
                <p>· Marke, Modell und VIN fließen nie in die Generierung ein.</p>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {step === "map" && (
        <ReferenceMap
          vehicleClass={effectiveClass}
          items={items}
          assignments={assignments}
          onAssign={assign}
          onClear={clearAssignment}
          onGenerate={(id) => void runGeneration(id)}
        />
      )}

      {step === "generate" && (
        <div className="space-y-4">
          <Card>
            <CardContent className="space-y-3 p-4">
              <div className="flex flex-wrap items-center gap-3">
                <Sparkles className="h-4 w-4" />
                <span className="text-base font-semibold">Generierung</span>
                <div className="ml-auto flex flex-wrap items-center gap-2">
                  <div className="flex items-center gap-1">
                    {GENERATION_TIERS.map((t) => (
                      <button
                        key={t}
                        type="button"
                        aria-pressed={tier === t}
                        onClick={() => setTier(t)}
                        className={`rounded-full border px-3 py-1 text-xs transition ${
                          tier === t
                            ? "border-primary bg-primary/10"
                            : "border-border text-muted-foreground hover:bg-muted"
                        }`}
                      >
                        {TIER_LABELS[t]}
                      </button>
                    ))}
                  </div>
                  <Badge variant="outline" className="text-[10px]">
                    Showroom: Standard
                  </Badge>
                  <Badge variant="outline" className="text-[10px]">
                    Logo: folgt als Overlay
                  </Badge>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
                <span>
                  <b className="text-foreground">{batchCounts.selected}</b> ausgewählt
                </span>
                <span>
                  <b className="text-emerald-600">{batchCounts.optimal}</b> optimal
                </span>
                <span>
                  <b className="text-amber-600">{batchCounts.warning}</b> Ersatzreferenz
                </span>
                <span>
                  <b className="text-amber-700">{batchCounts.estimated}</b> geschätzt
                </span>
                {batchCounts.unusable > 0 && (
                  <span>{batchCounts.unusable} ohne Referenz</span>
                )}
                {batchProgress && (
                  <span className="font-medium text-foreground">
                    {batchProgress.done} / {batchProgress.total} generiert
                  </span>
                )}
              </div>

              {batchCounts.estimated + batchCounts.warning > 0 && (
                <label className="flex items-start gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 p-2 text-[11px]">
                  <input
                    type="checkbox"
                    className="mt-0.5"
                    checked={batchAck}
                    onChange={(e) => setBatchAck(e.target.checked)}
                  />
                  <span>
                    Ich habe verstanden: Für einzelne Ansichten fehlt eine direkte
                    Referenz. Diese werden aus den vorhandenen Fahrzeugbildern
                    rekonstruiert und können stärker vom Original abweichen.
                  </span>
                </label>
              )}

              <div className="flex flex-wrap gap-2">
                <Button
                  className="h-9"
                  disabled={
                    batchProgress !== null || batchCounts.selected === 0
                  }
                  onClick={() => void runAll()}
                >
                  {batchProgress ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      {batchProgress.done} / {batchProgress.total} generiert
                    </>
                  ) : (
                    <>
                      <Sparkles className="mr-2 h-4 w-4" />
                      Alle generieren
                    </>
                  )}
                </Button>
                <Button
                  variant="outline"
                  className="h-9"
                  onClick={() => setStep("map")}
                >
                  Referenzen anpassen
                </Button>
              </div>
            </CardContent>
          </Card>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {bases.map((basis) => {
              const entry = getPerspectiveMasterEntry(basis.perspectiveId);
              const result = results[basis.perspectiveId];
              const primary = items.find((i) => i.id === basis.primaryItemId);
              const isSelected = selectedTargets.includes(basis.perspectiveId);
              const tone =
                basis.kind === "direct"
                  ? "bg-emerald-500"
                  : basis.kind === "none"
                    ? "bg-muted-foreground/40"
                    : "bg-amber-500";
              return (
                <div
                  key={basis.perspectiveId}
                  className={`space-y-2 rounded-lg border p-3 ${
                    isSelected ? "" : "opacity-50"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      aria-label={`${entry.labelDe} auswählen`}
                      checked={isSelected}
                      onChange={(e) =>
                        setDeselectedTargets((prev) =>
                          e.target.checked
                            ? prev.filter((id) => id !== basis.perspectiveId)
                            : [...prev, basis.perspectiveId],
                        )
                      }
                    />
                    <span className={`h-2 w-2 rounded-full ${tone}`} />
                    <span className="truncate text-sm font-medium">
                      {entry.labelDe}
                    </span>
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    {BASIS_LABELS_DE[basis.kind]}
                    {basis.sourcePerspectiveId &&
                      basis.kind !== "direct" &&
                      ` · aus ${getPerspectiveMasterEntry(basis.sourcePerspectiveId).labelDe}`}
                  </p>
                  <div className="flex aspect-video items-center justify-center overflow-hidden rounded-md border bg-muted/40">
                    {result?.status === "done" && result.dataUrl ? (
                      <img
                        src={result.dataUrl}
                        alt={`Generiert: ${entry.labelDe}`}
                        className="h-full w-full object-cover"
                      />
                    ) : result?.status === "pending" ? (
                      <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                    ) : result?.status === "error" ? (
                      <span className="px-2 text-center text-[10px] text-destructive">
                        {result.error}
                      </span>
                    ) : primary ? (
                      <img
                        src={primary.previewUrl}
                        alt={entry.labelDe}
                        className="h-full w-full object-cover opacity-60"
                      />
                    ) : (
                      <span className="text-[10px] text-muted-foreground">
                        keine Referenz vorhanden
                      </span>
                    )}
                  </div>
                  {result?.qaStatus && (
                    <p className="text-[10px] text-muted-foreground">
                      {QA_LABELS[result.qaStatus]}
                      {result.qaNote ? ` · ${result.qaNote}` : ""}
                    </p>
                  )}
                  {basis.warningText && (
                    <p className="text-[10px] text-amber-700 dark:text-amber-400">
                      {basis.warningText}
                    </p>
                  )}
                  <div className="flex gap-1">
                    <Button
                      size="sm"
                      variant={basis.kind === "direct" ? "default" : "outline"}
                      className="h-7 flex-1 text-[11px]"
                      disabled={basis.kind === "none" || result?.status === "pending"}
                      onClick={() => void runGeneration(basis.perspectiveId)}
                    >
                      {result?.status === "done"
                        ? "Neu generieren"
                        : basis.kind === "direct"
                          ? "Generieren"
                          : "Trotzdem generieren"}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 text-[11px]"
                      onClick={() => setStep("map")}
                    >
                      Referenz wählen
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}


      {step === "qa" && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">QA & Ausgabe</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-xs text-muted-foreground">
              Ergebnisse erscheinen sofort. Die Prüfung läuft danach im
              Hintergrund und verdeckt das Bild nie — angezeigt werden nur
              tatsächlich gemessene Werte.
            </p>

            {generatedEntries.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                Noch nichts generiert.
              </p>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {generatedEntries.map(([perspectiveId, result]) => (
                  <div key={perspectiveId} className="space-y-2 rounded-lg border p-3">
                    <div className="flex items-center gap-2">
                      <span className="truncate text-sm font-medium">
                        {getPerspectiveMasterEntry(
                          perspectiveId as PerspectiveId,
                        ).labelDe}
                      </span>
                      <Badge variant="secondary" className="ml-auto text-[10px]">
                        {result.accepted
                          ? "Übernommen"
                          : result.qaStatus
                            ? QA_LABELS[result.qaStatus]
                            : result.status === "pending"
                              ? "Generierung läuft"
                              : "Sichtprüfung offen"}
                      </Badge>
                    </div>
                    {result.qaNote && (
                      <p className="text-[10px] text-muted-foreground">
                        {result.qaNote}
                      </p>
                    )}

                    <div className="flex aspect-video items-center justify-center overflow-hidden rounded-md border bg-muted/40">
                      {result.dataUrl ? (
                        <img
                          src={result.dataUrl}
                          alt={perspectiveId}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                      )}
                    </div>
                    {result.dataUrl && (
                      <div className="flex gap-1">
                        <Button
                          size="sm"
                          className="h-7 flex-1 text-[11px]"
                          onClick={() => {
                            setResults((prev) => ({
                              ...prev,
                              [perspectiveId]: { ...result, accepted: true },
                            }));
                            download(perspectiveId, result.dataUrl!);
                          }}
                        >
                          <Download className="mr-1 h-3 w-3" />
                          Übernehmen
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-[11px]"
                          onClick={() =>
                            void runGeneration(perspectiveId as PerspectiveId)
                          }
                        >
                          Neu generieren
                        </Button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <div className="rounded-lg border">
        <button
          type="button"
          onClick={() => setShowTechnical((v) => !v)}
          className="flex w-full items-center justify-between px-4 py-2 text-xs text-muted-foreground"
        >
          Technische Details (Vehicle Master, Governance, Preflight)
          <span>{showTechnical ? "−" : "+"}</span>
        </button>
        {showTechnical && (
          <div className="space-y-2 border-t p-4 text-xs text-muted-foreground">
            <p>
              Strikte Governance, Identity-Cluster, Preflight-Codes und
              Framing-Nachweise bleiben unverändert erhalten und sind in der
              technischen Ansicht einsehbar.
            </p>
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-[11px]"
              onClick={() => navigate("/admin/reference-v2/technik")}
            >
              Technische Ansicht öffnen
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

export default function ReferenceWorkspace() {
  return (
    <ReferenceStoreProvider>
      <CurrentFramingEvidenceRuntimeProvider>
        <ReferenceWorkspaceInner />
      </CurrentFramingEvidenceRuntimeProvider>
    </ReferenceStoreProvider>
  );
}
