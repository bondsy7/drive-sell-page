import { getPerspectiveSpec } from "../domain/perspectives/registry";
import { PERSPECTIVE_REGISTRY_VERSION } from "../domain/perspectives/registry";
import { PERSPECTIVE_MASTER_VERSION } from "../phase1/perspective-master";
import { resolvePerspectiveIdsForClass } from "../domain/capability-profiles";
import type { PerspectiveId } from "../domain/perspectives/types";
import type { VisualSurface, WheelPosition } from "../domain/surfaces";
import type { OutputFormat } from "../phase1/output-format-policy";
import {
  PHASE2_MAX_SECONDARY_REFERENCES,
  PHASE2_PLANNER_VERSION,
  parsePlannerInput,
  parsePlannerOutput,
  resolveReferenceGeometryPerspectiveId,
  type PlannerCoverage,
  type PlannerInput,
  type PlannerItem,
  type PlannerOutput,
  type PlannerOutputFormatReadiness,
  type PlannerReason,
  type PlannerState,
  type SelectedPrimaryReference,
  type SelectedSecondaryReference,
  type SurfaceCoverageItem,
} from "./planner-contract";
import {
  assessTargetRelativeCandidate,
  type TargetRelativeCandidateAssessment,
} from "./candidate-scoring";

/**
 * Reference V2 — Phase 2.3: DETERMINISTIC REFERENCE SELECTION + PLANNER ASSEMBLY.
 *
 * Diese Datei waehlt pro angeforderter Ziel-Perspektive genau eine exakte
 * PRIMARY-Referenz sowie das MINIMALE Set gescopeter SECONDARY-Referenzen und
 * montiert daraus die eingefrorenen Phase-2.0-Contracts.
 *
 * KERNPRINZIPIEN
 * - Die visuelle Analyse (ueber Phase 2.2) ist die einzige Bewertungsautoritaet.
 *   Gespeicherte Phase-1-Felder (`asset.scores`, `asset.weightedScore`,
 *   `asset.outputReadyFormats`, `asset.requestedPerspectiveId`) werden hier
 *   NIEMALS gelesen.
 * - Exakte Primary-Geometrie ist Pflicht. Es gibt KEINE Adjazenz, KEINE
 *   Substitution, KEIN Spiegeln, KEINE Bildgenerierung.
 * - Fail closed: fehlende Evidenz blockiert.
 * - Minimalitaet: eine Sekundaerreferenz wird nur aufgenommen, wenn sie eine
 *   aktuell fehlende Pflicht-Flaeche des Ziels neu belegt.
 *
 * Reine Funktion: kein I/O, keine Zeitquelle, keine Persistenz, keine UI.
 */

// --------------------------------------------------------------------------
// Konstanten / Hilfsmengen
// --------------------------------------------------------------------------

/**
 * Blocking-Codes, die eine Datei-/Analyse-Unverfuegbarkeit beschreiben.
 * `FILE_UNAVAILABLE` ist ein Hard-Fail-Code, kein Reason-Code, und wird
 * separat beruecksichtigt.
 */
const FILE_LIFECYCLE_BLOCKING_CODES: ReadonlySet<PlannerReason["code"]> =
  new Set([
    "NO_ANALYSIS_RECORD",
    "FILE_NOT_ANALYZED",
    "FILE_PROVIDER_INVALID",
    "FILE_MIME_INVALID",
    "FILE_EXPIRED",
  ]);

const OUTPUT_FORMAT_FAIL_CLOSED_REASON_DE =
  "Aktuelle Source-Framing-Evidenz fehlt; Formatfreigabe wird nicht aus Phase-1-Altwerten übernommen.";

// --------------------------------------------------------------------------
// Deterministische Hilfen
// --------------------------------------------------------------------------

/** Plain code-point comparison — bewusst KEIN localeCompare. */
function compareAssetId(a: string, b: string): number {
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
}

function reasonKey(reason: PlannerReason): string {
  return [
    reason.code,
    reason.severity,
    reason.assetId ?? "",
    reason.surface ?? "",
    reason.messageDe,
  ].join("|");
}

function dedupeReasons(reasons: readonly PlannerReason[]): PlannerReason[] {
  const seen = new Set<string>();
  const out: PlannerReason[] = [];
  for (const r of reasons) {
    const key = reasonKey(r);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(r);
  }
  return out;
}

// --------------------------------------------------------------------------
// Coverage-Bausteine
// --------------------------------------------------------------------------

interface GeometryRequirements {
  readonly geometryId: PerspectiveId;
  readonly requiredSurfaces: readonly VisualSurface[];
  readonly requiredWheelPositions: readonly WheelPosition[];
}

function resolveGeometryRequirements(
  targetPerspectiveId: PerspectiveId,
): GeometryRequirements {
  const geometryId = resolveReferenceGeometryPerspectiveId(targetPerspectiveId);
  const spec = getPerspectiveSpec(geometryId);
  return {
    geometryId,
    requiredSurfaces: spec.referenceRequirements.requiredCoverageSurfaces,
    requiredWheelPositions: spec.framing.requiredVisibleWheels,
  };
}

function emptyCoverage(req: GeometryRequirements): PlannerCoverage {
  const items: SurfaceCoverageItem[] = req.requiredSurfaces.map((surface) => ({
    surface,
    visibilityScore: 0,
    met: false,
    sourceAssetIds: [],
  }));
  return {
    requiredSurfaces: [...req.requiredSurfaces] as PlannerCoverage["requiredSurfaces"],
    items,
    allMandatorySurfacesMet: items.every((i) => i.met),
    requiredWheelPositions: [...req.requiredWheelPositions],
    visibleWheelPositions: [],
  };
}

function surfaceEvidence(
  assessment: TargetRelativeCandidateAssessment,
  surface: VisualSurface,
): { visibility: number; met: boolean } {
  const e = assessment.requiredSurfaceEvidence.find(
    (x) => x.surface === surface,
  );
  return { visibility: e?.visibility ?? 0, met: e?.met ?? false };
}

// --------------------------------------------------------------------------
// Output-Format-Readiness (fail closed)
// --------------------------------------------------------------------------

function buildOutputFormatReadiness(
  requestedFormats: readonly OutputFormat[] | undefined,
): PlannerOutputFormatReadiness[] {
  if (!requestedFormats || requestedFormats.length === 0) return [];
  return requestedFormats.map((format) => ({
    format,
    ready: false,
    reason: OUTPUT_FORMAT_FAIL_CLOSED_REASON_DE,
  }));
}

function buildOutputFormatBlockers(
  requestedFormats: readonly OutputFormat[] | undefined,
): PlannerReason[] {
  if (!requestedFormats || requestedFormats.length === 0) return [];
  return requestedFormats.map<PlannerReason>((format) => ({
    code: "OUTPUT_FORMAT_NOT_READY",
    severity: "BLOCKING",
    messageDe: `Ausgabeformat ${format} ist nicht freigegeben: ${OUTPUT_FORMAT_FAIL_CLOSED_REASON_DE}`,
    metadata: { format },
  }));
}

// --------------------------------------------------------------------------
// Primary-Bewertung
// --------------------------------------------------------------------------

function assessAllPrimaries(
  input: PlannerInput,
  targetPerspectiveId: PerspectiveId,
): TargetRelativeCandidateAssessment[] {
  return input.vehicleMaster.assets.map((asset) =>
    assessTargetRelativeCandidate({
      vehicleMaster: input.vehicleMaster,
      assetId: asset.id,
      targetPerspectiveId,
      intendedRole: "primary",
      nowIso: input.nowIso,
    }),
  );
}

function isQualifiedPrimary(a: TargetRelativeCandidateAssessment): boolean {
  return (
    a.rankable &&
    a.eligibility.exactPerspective &&
    a.detectedPerspectiveId === a.referenceGeometryPerspectiveId &&
    a.minimumPerspectiveScoreMet &&
    a.primaryQualityThresholdMet
  );
}

/** Deterministischer Primary-Vergleich (siehe Phase-2.3-Spezifikation). */
function comparePrimaries(
  a: TargetRelativeCandidateAssessment,
  b: TargetRelativeCandidateAssessment,
): number {
  if (a.weightedScore !== b.weightedScore) return b.weightedScore - a.weightedScore;
  if (a.scores.quality !== b.scores.quality) {
    return b.scores.quality - a.scores.quality;
  }
  if (a.scores.requiredSurfaceCoverage !== b.scores.requiredSurfaceCoverage) {
    return b.scores.requiredSurfaceCoverage - a.scores.requiredSurfaceCoverage;
  }
  if (a.scores.cameraAngle !== b.scores.cameraAngle) {
    return b.scores.cameraAngle - a.scores.cameraAngle;
  }
  return compareAssetId(a.assetId, b.assetId);
}

// --------------------------------------------------------------------------
// Blocked-Klassifikation ohne Primary
// --------------------------------------------------------------------------

function hasIdentityConflict(a: TargetRelativeCandidateAssessment): boolean {
  return (
    a.eligibility.hardFailures.includes("IDENTITY_CLUSTER_CONFLICT") ||
    a.eligibility.reasons.some((r) => r.code === "IDENTITY_CLUSTER_MIXED")
  );
}

function isFileUnavailabilityBlocked(
  a: TargetRelativeCandidateAssessment,
): boolean {
  const blocking = a.eligibility.reasons.filter(
    (r) => r.severity === "BLOCKING",
  );
  const fileHardFail = a.eligibility.hardFailures.includes("FILE_UNAVAILABLE");
  const fileBlocking = blocking.filter((r) =>
    FILE_LIFECYCLE_BLOCKING_CODES.has(r.code),
  );
  if (fileBlocking.length === 0 && !fileHardFail) return false;
  // Keine anderen blockierenden Ursachen als Datei-/Analyse-Unverfuegbarkeit.
  const otherBlocking = blocking.length - fileBlocking.length;
  const otherHardFailures = a.eligibility.hardFailures.filter(
    (c) => c !== "FILE_UNAVAILABLE",
  ).length;
  return (
    otherBlocking === 0 &&
    otherHardFailures === 0 &&
    a.eligibility.intrinsicBlockers.length === 0
  );
}

function classifyNoPrimaryReadiness(
  assessments: readonly TargetRelativeCandidateAssessment[],
): PlannerItem["fineGrainedReadiness"] {
  if (assessments.length === 0) return "INSUFFICIENT_REFERENCE";
  if (assessments.some(hasIdentityConflict)) return "BLOCKED_IDENTITY_CONFLICT";
  const nonRankable = assessments.filter((a) => !a.rankable);
  const rankable = assessments.filter((a) => a.rankable);
  if (
    rankable.length === 0 &&
    nonRankable.length > 0 &&
    nonRankable.every(isFileUnavailabilityBlocked)
  ) {
    return "BLOCKED_FILE_UNAVAILABLE";
  }
  return "INSUFFICIENT_REFERENCE";
}

/** Kompakte, eindeutige Diagnostik: max. eine Reason je (code, assetId). */
function propagateBlockingDiagnostics(
  assessments: readonly TargetRelativeCandidateAssessment[],
): PlannerReason[] {
  const seen = new Set<string>();
  const out: PlannerReason[] = [];
  for (const a of assessments) {
    for (const r of a.eligibility.reasons) {
      if (r.severity !== "BLOCKING") continue;
      const key = `${r.code}|${r.assetId ?? ""}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(r);
    }
  }
  return out;
}

// --------------------------------------------------------------------------
// Item-Assembly
// --------------------------------------------------------------------------

function blockedItem(
  targetPerspectiveId: PerspectiveId,
  coverage: PlannerCoverage,
  fineGrainedReadiness: PlannerItem["fineGrainedReadiness"],
  reasons: readonly PlannerReason[],
  outputFormatReadiness: readonly PlannerOutputFormatReadiness[],
): PlannerItem {
  return {
    perspectiveSpecId: targetPerspectiveId,
    perspectiveSpecVersion: getPerspectiveSpec(targetPerspectiveId).version,
    state: "BLOCKED",
    fineGrainedReadiness,
    selection: { secondaryReferences: [] },
    coverage,
    outputFormatReadiness: [...outputFormatReadiness],
    substitution: null,
    reasons: dedupeReasons(reasons),
    generationAllowed: false,
  };
}

// --------------------------------------------------------------------------
// Planung einer Ziel-Perspektive
// --------------------------------------------------------------------------

function planPerspective(
  input: PlannerInput,
  targetPerspectiveId: PerspectiveId,
): PlannerItem {
  const requestedFormats = input.requestedOutputFormats;
  const formatReadiness = buildOutputFormatReadiness(requestedFormats);
  const formatBlockers = buildOutputFormatBlockers(requestedFormats);

  // --- 3. Ziel-Anwendbarkeit --------------------------------------------
  const applicable = resolvePerspectiveIdsForClass(
    input.vehicleMaster.vehicleClass,
  );
  const req = resolveGeometryRequirements(targetPerspectiveId);

  if (!applicable.includes(targetPerspectiveId)) {
    return blockedItem(
      targetPerspectiveId,
      emptyCoverage(req),
      "INSUFFICIENT_REFERENCE",
      [
        {
          code: "VEHICLE_CLASS_NOT_APPLICABLE",
          severity: "BLOCKING",
          messageDe: `Perspektive ${targetPerspectiveId} ist für die Fahrzeugklasse ${input.vehicleMaster.vehicleClass} nicht verfügbar.`,
        },
        ...formatBlockers,
      ],
      formatReadiness,
    );
  }

  // --- 4. Primary-Bewertung ---------------------------------------------
  const primaryAssessments = assessAllPrimaries(input, targetPerspectiveId);
  const qualified = primaryAssessments.filter(isQualifiedPrimary);

  if (qualified.length === 0) {
    const reasons: PlannerReason[] = [];
    const rankableExact = primaryAssessments.filter(
      (a) => a.rankable && a.eligibility.exactPerspective,
    );
    if (rankableExact.length > 0) {
      const best = [...rankableExact].sort(comparePrimaries)[0];
      const spec = getPerspectiveSpec(best.referenceGeometryPerspectiveId);
      reasons.push({
        code: "SCORE_BELOW_MINIMUM",
        severity: "BLOCKING",
        messageDe: `Bester exakter Kandidat erfüllt eine oder mehrere Mindestanforderungen nicht (Score ${best.weightedScore} / mindestens ${spec.validationRules.minimumPerspectiveScore}, Bildqualität ${best.primaryQualityThresholdMet ? "erfüllt" : "nicht erfüllt"} / mindestens ${spec.referenceRequirements.minPrimaryQualityScore}).`,
        assetId: best.assetId,
        metadata: {
          weightedScore: best.weightedScore,
          minimumPerspectiveScore: spec.validationRules.minimumPerspectiveScore,
          minimumPerspectiveScoreMet: best.minimumPerspectiveScoreMet,
          primaryQualityThresholdMet: best.primaryQualityThresholdMet,
          minPrimaryQualityScore:
            spec.referenceRequirements.minPrimaryQualityScore,
        },
      });

      reasons.push({
        code: "NO_ELIGIBLE_PRIMARY",
        severity: "BLOCKING",
        messageDe:
          "Keine qualifizierte exakte Primary-Referenz für diese Perspektive vorhanden.",
      });
    } else {
      reasons.push({
        code: "NO_ELIGIBLE_PRIMARY",
        severity: "BLOCKING",
        messageDe:
          "Keine qualifizierte exakte Primary-Referenz für diese Perspektive vorhanden.",
      });
      reasons.push(...propagateBlockingDiagnostics(primaryAssessments));
    }
    return blockedItem(
      targetPerspectiveId,
      emptyCoverage(req),
      classifyNoPrimaryReadiness(primaryAssessments),
      [...reasons, ...formatBlockers],
      formatReadiness,
    );
  }

  // --- 5. Deterministisches Primary-Ranking ------------------------------
  const primary = [...qualified].sort(comparePrimaries)[0];
  const selectedPrimary: SelectedPrimaryReference = {
    assetId: primary.assetId,
    perspectiveId: primary.referenceGeometryPerspectiveId,
    role: "primary",
    exactPerspective: true,
  };

  // --- 6./7. Sekundaerauswahl (greedy, minimal) --------------------------
  const missing: VisualSurface[] = req.requiredSurfaces.filter((s) =>
    primary.unprovenRequiredSurfaces.includes(s),
  );

  const secondaryAssessments: TargetRelativeCandidateAssessment[] = [];
  if (missing.length > 0) {
    for (const asset of input.vehicleMaster.assets) {
      if (asset.id === primary.assetId) continue;
      const a = assessTargetRelativeCandidate({
        vehicleMaster: input.vehicleMaster,
        assetId: asset.id,
        targetPerspectiveId,
        intendedRole: "secondary",
        nowIso: input.nowIso,
      });
      if (!a.rankable) continue;
      if (!a.contributesToTarget) continue;
      if (a.detectedPerspectiveId === null) continue;
      secondaryAssessments.push(a);
    }
  }

  const budget = Math.min(
    input.policy.maxSecondaryReferences,
    PHASE2_MAX_SECONDARY_REFERENCES,
  );
  const selectedSecondaries: SelectedSecondaryReference[] = [];
  const selectedSecondaryAssessments: TargetRelativeCandidateAssessment[] = [];
  let remainingMissing: VisualSurface[] = [...missing];

  while (remainingMissing.length > 0 && selectedSecondaries.length < budget) {
    const pool = secondaryAssessments.filter(
      (a) => !selectedSecondaries.some((s) => s.assetId === a.assetId),
    );
    let best: TargetRelativeCandidateAssessment | null = null;
    let bestGain: VisualSurface[] = [];
    for (const candidate of pool) {
      const gain = remainingMissing.filter((s) =>
        candidate.secondaryScopes.includes(s),
      );
      if (gain.length === 0) continue;
      if (best === null || gain.length > bestGain.length) {
        best = candidate;
        bestGain = gain;
        continue;
      }
      if (gain.length < bestGain.length) continue;
      if (candidate.weightedScore !== best.weightedScore) {
        if (candidate.weightedScore > best.weightedScore) {
          best = candidate;
          bestGain = gain;
        }
        continue;
      }
      if (candidate.scores.quality !== best.scores.quality) {
        if (candidate.scores.quality > best.scores.quality) {
          best = candidate;
          bestGain = gain;
        }
        continue;
      }
      if (compareAssetId(candidate.assetId, best.assetId) < 0) {
        best = candidate;
        bestGain = gain;
      }
    }
    if (best === null || bestGain.length === 0) break;
    // Scope in TARGET-Registry-Reihenfolge auf die NEU belegten Flaechen.
    const scopes = req.requiredSurfaces.filter((s) => bestGain.includes(s));
    selectedSecondaries.push({
      assetId: best.assetId,
      perspectiveId: best.detectedPerspectiveId as PerspectiveId,
      role: "secondary",
      scopes: scopes as SelectedSecondaryReference["scopes"],
    });
    selectedSecondaryAssessments.push(best);
    remainingMissing = remainingMissing.filter((s) => !scopes.includes(s));
  }

  // --- 8. Coverage-Assembly ---------------------------------------------
  const items: SurfaceCoverageItem[] = req.requiredSurfaces.map((surface) => {
    const sourceAssetIds: string[] = [];
    let visibility = 0;

    const primaryEvidence = surfaceEvidence(primary, surface);
    if (primaryEvidence.met) sourceAssetIds.push(primary.assetId);
    visibility = Math.max(visibility, primaryEvidence.visibility);

    selectedSecondaries.forEach((ref, index) => {
      const assessment = selectedSecondaryAssessments[index];
      const evidence = surfaceEvidence(assessment, surface);
      visibility = Math.max(visibility, evidence.visibility);
      if (
        (ref.scopes as readonly VisualSurface[]).includes(surface) &&
        evidence.met &&
        !sourceAssetIds.includes(ref.assetId)
      ) {
        sourceAssetIds.push(ref.assetId);
      }
    });

    return {
      surface,
      visibilityScore: visibility,
      met: sourceAssetIds.length > 0,
      sourceAssetIds,
    };
  });

  // Wheels: ausschliesslich Primary-Framing.
  const visibleWheelPositions = req.requiredWheelPositions.filter((w) =>
    primary.requiredWheelEvidence.some(
      (e) => e.wheelPosition === w && e.visible,
    ),
  );
  const missingWheels = req.requiredWheelPositions.filter(
    (w) => !visibleWheelPositions.includes(w),
  );

  const coverage: PlannerCoverage = {
    requiredSurfaces: [...req.requiredSurfaces] as PlannerCoverage["requiredSurfaces"],
    items,
    allMandatorySurfacesMet: items.every((i) => i.met),
    requiredWheelPositions: [...req.requiredWheelPositions],
    visibleWheelPositions: [...visibleWheelPositions],
  };

  // --- 9. Blocking-Gruende ----------------------------------------------
  const blocking: PlannerReason[] = [];
  for (const item of items) {
    if (item.met) continue;
    blocking.push({
      code: "REQUIRED_SURFACE_UNPROVEN",
      severity: "BLOCKING",
      messageDe: `Pflicht-Fläche ${item.surface} ist durch die ausgewählten Referenzen nicht belegt.`,
      surface: item.surface,
    });
  }

  const stillMissing = items.filter((i) => !i.met).map((i) => i.surface);
  if (stillMissing.length > 0 && selectedSecondaries.length >= budget) {
    const rescuePossible = secondaryAssessments.some(
      (a) =>
        !selectedSecondaries.some((s) => s.assetId === a.assetId) &&
        a.secondaryScopes.some((s) => stillMissing.includes(s)),
    );
    if (rescuePossible) {
      blocking.push({
        code: "SECONDARY_BUDGET_TRUNCATED",
        severity: "BLOCKING",
        messageDe: `Das Budget für Sekundärreferenzen (${budget}) ist ausgeschöpft; weitere belegbare Pflicht-Flächen bleiben offen.`,
        metadata: { maxSecondaryReferences: budget },
      });
    }
  }

  for (const wheelPosition of missingWheels) {
    blocking.push({
      code: "REQUIRED_SURFACE_UNPROVEN",
      severity: "BLOCKING",
      messageDe: `Pflicht-Radposition ${wheelPosition} ist im exakten Primary-Framing nicht belegt.`,
      metadata: { wheelPosition },
    });
  }

  blocking.push(...formatBlockers);

  // --- 10. Review-Propagation -------------------------------------------
  const reviewReasons: PlannerReason[] = [];
  for (const r of primary.eligibility.reasons) {
    if (r.severity === "REVIEW" || r.severity === "INFO") reviewReasons.push(r);
  }
  for (const a of selectedSecondaryAssessments) {
    for (const r of a.eligibility.reasons) {
      if (r.severity === "REVIEW" || r.severity === "INFO") reviewReasons.push(r);
    }
  }
  const propagatedReasons = dedupeReasons(reviewReasons);
  const hasReview = propagatedReasons.some((r) => r.severity === "REVIEW");

  // --- 12. Zustands-Praezedenz -------------------------------------------
  const selection = {
    primary: selectedPrimary,
    secondaryReferences: selectedSecondaries,
  };

  if (blocking.length > 0) {
    return {
      perspectiveSpecId: targetPerspectiveId,
      perspectiveSpecVersion: getPerspectiveSpec(targetPerspectiveId).version,
      state: "BLOCKED",
      fineGrainedReadiness: "INSUFFICIENT_REFERENCE",
      selection,
      coverage,
      outputFormatReadiness: formatReadiness,
      substitution: null,
      reasons: dedupeReasons([...blocking, ...propagatedReasons]),
      generationAllowed: false,
    };
  }

  const state: PlannerState = hasReview ? "REVIEW" : "READY";
  return {
    perspectiveSpecId: targetPerspectiveId,
    perspectiveSpecVersion: getPerspectiveSpec(targetPerspectiveId).version,
    state,
    fineGrainedReadiness: hasReview
      ? "NEEDS_CONFIRMATION"
      : selectedSecondaries.length > 0
        ? "READY_MULTI_REFERENCE"
        : "READY_EXACT",
    selection,
    coverage,
    outputFormatReadiness: formatReadiness,
    substitution: null,
    reasons: propagatedReasons,
    generationAllowed: state === "READY",
  };
}

// --------------------------------------------------------------------------
// Public API
// --------------------------------------------------------------------------

/**
 * Plant deterministisch fuer JEDE angeforderte Ziel-Perspektive die
 * Referenzauswahl und liefert das eingefrorene Phase-2.0-Planner-Ergebnis.
 * Rein: kein I/O, keine Systemzeit — `plannedAtIso` ist immer `input.nowIso`.
 */
export function buildReferencePlanner(rawInput: unknown): PlannerOutput {
  const input = parsePlannerInput(rawInput);

  const items = input.requestedPerspectiveIds.map((id) =>
    planPerspective(input, id),
  );

  const readyCount = items.filter((i) => i.state === "READY").length;
  const reviewCount = items.filter((i) => i.state === "REVIEW").length;
  const blockedCount = items.filter((i) => i.state === "BLOCKED").length;

  return parsePlannerOutput({
    plannerVersion: PHASE2_PLANNER_VERSION,
    registryVersion: PERSPECTIVE_REGISTRY_VERSION,
    perspectiveMasterVersion: PERSPECTIVE_MASTER_VERSION,
    plannedAtIso: input.nowIso,
    items,
    summary: {
      readyCount,
      reviewCount,
      blockedCount,
      generationAllowed: items.every(
        (i) => i.state === "READY" && i.generationAllowed === true,
      ),
    },
  });
}
