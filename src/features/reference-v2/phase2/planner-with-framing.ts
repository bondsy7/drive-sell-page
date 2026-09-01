import {
  buildReferencePlanner,
} from "./planner";
import {
  parsePlannerInput,
  parsePlannerOutput,
  type PlannerInput,
  type PlannerItem,
  type PlannerOutput,
  type PlannerOutputFormatReadiness,
  type PlannerReason,
} from "./planner-contract";
import {
  evaluateCurrentFramingEvidence,
  parseCurrentFramingEvidence,
  type CurrentFramingEvidence,
} from "./framing-evidence";
import type { OutputFormat } from "../phase1/output-format-policy";

/**
 * Reference V2 — Phase 2.4B: reiner Wrapper aus eingefrorenem Planner
 * (Phase 2.3) und aktueller Framing-Evidenz (Phase 2.4A).
 *
 * Referenzauswahl, Coverage und READY/REVIEW/BLOCKED-Semantik bleiben zu 100 %
 * Autoritaet des eingefrorenen Planners. Die Output-Format-Freigabe stammt
 * AUSSCHLIESSLICH aus der aktuellen Framing-Evidenz der ausgewaehlten
 * Primary-Referenz. Gespeicherte Phase-1-Freigaben werden nie wieder
 * Autoritaet. Kein I/O, keine Systemzeit, kein Zufall, keine Mutation.
 */

const REQUESTED_FORMATS_KEY = "requestedOutputFormats";

const MISSING_PRIMARY_EVIDENCE_REASON_DE =
  "Aktuelle Framing-Evidenz für die ausgewählte Primary-Referenz fehlt.";

const NO_PRIMARY_REASON_DE =
  "Keine ausgewählte Primary-Referenz mit aktueller Framing-Evidenz vorhanden.";

// --------------------------------------------------------------------------
// Input contract
// --------------------------------------------------------------------------

export interface PlannerWithCurrentFramingInput {
  readonly plannerInput: PlannerInput;
  readonly framingEvidence: readonly CurrentFramingEvidence[];
}

export class PlannerWithCurrentFramingInputError extends Error {
  readonly issues: readonly string[];
  constructor(issues: readonly string[]) {
    super(`planner with current framing input invalid: ${issues.join("; ")}`);
    this.name = "PlannerWithCurrentFramingInputError";
    this.issues = issues;
  }
}

const ALLOWED_TOP_LEVEL_KEYS = ["plannerInput", "framingEvidence"] as const;

export function parsePlannerWithCurrentFramingInput(
  raw: unknown,
): PlannerWithCurrentFramingInput {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    throw new PlannerWithCurrentFramingInputError([
      "root: expected a plain object",
    ]);
  }
  const record = raw as Record<string, unknown>;
  const allowed = new Set<string>(ALLOWED_TOP_LEVEL_KEYS);
  const unknownKeys = Object.keys(record).filter((k) => !allowed.has(k));
  if (unknownKeys.length > 0) {
    throw new PlannerWithCurrentFramingInputError([
      `root: unrecognized key(s): ${unknownKeys.join(", ")}`,
    ]);
  }
  if (!("plannerInput" in record)) {
    throw new PlannerWithCurrentFramingInputError(["plannerInput: required"]);
  }
  if (!Array.isArray(record.framingEvidence)) {
    throw new PlannerWithCurrentFramingInputError([
      "framingEvidence: expected an array",
    ]);
  }

  const plannerInput = parsePlannerInput(record.plannerInput);
  const framingEvidence = record.framingEvidence.map((entry) =>
    parseCurrentFramingEvidence(entry),
  );

  const seen = new Set<string>();
  for (const entry of framingEvidence) {
    if (seen.has(entry.assetId)) {
      throw new PlannerWithCurrentFramingInputError([
        `framingEvidence: duplicate assetId ${entry.assetId}`,
      ]);
    }
    seen.add(entry.assetId);
  }

  const knownAssetIds = new Set<string>(
    plannerInput.vehicleMaster.assets.map((a) => a.id),
  );
  for (const entry of framingEvidence) {
    if (!knownAssetIds.has(entry.assetId)) {
      throw new PlannerWithCurrentFramingInputError([
        `framingEvidence: unknown assetId ${entry.assetId}`,
      ]);
    }
  }

  return { plannerInput, framingEvidence };
}

// --------------------------------------------------------------------------
// Helpers
// --------------------------------------------------------------------------

function buildReferenceOnlyInput(plannerInput: PlannerInput): unknown {
  const baseline: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(
    plannerInput as unknown as Record<string, unknown>,
  )) {
    if (key === REQUESTED_FORMATS_KEY) continue;
    baseline[key] = value;
  }
  return baseline;
}

function fixedReadiness(
  requestedFormats: readonly OutputFormat[],
  reason: string,
): PlannerOutputFormatReadiness[] {
  return requestedFormats.map((format) => ({ format, ready: false, reason }));
}

function currentReadinessFor(
  item: PlannerItem,
  evidenceByAssetId: ReadonlyMap<string, CurrentFramingEvidence>,
  requestedFormats: readonly OutputFormat[],
): PlannerOutputFormatReadiness[] {
  const primary = item.selection.primary;
  if (!primary) {
    return fixedReadiness(requestedFormats, NO_PRIMARY_REASON_DE);
  }
  const evidence = evidenceByAssetId.get(primary.assetId);
  if (!evidence) {
    return fixedReadiness(requestedFormats, MISSING_PRIMARY_EVIDENCE_REASON_DE);
  }
  const assessment = evaluateCurrentFramingEvidence({
    evidence,
    targetPerspectiveId: item.perspectiveSpecId,
    requestedFormats: [...requestedFormats],
  });
  return assessment.readiness.map((entry) =>
    entry.reason === undefined
      ? { format: entry.format, ready: entry.ready }
      : { format: entry.format, ready: entry.ready, reason: entry.reason },
  );
}

function formatBlockersFor(
  readiness: readonly PlannerOutputFormatReadiness[],
): PlannerReason[] {
  const out: PlannerReason[] = [];
  const seen = new Set<string>();
  for (const entry of readiness) {
    if (entry.ready) continue;
    const messageDe = entry.reason ?? MISSING_PRIMARY_EVIDENCE_REASON_DE;
    const key = `${entry.format}|${messageDe}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({
      code: "OUTPUT_FORMAT_NOT_READY",
      severity: "BLOCKING",
      messageDe,
      metadata: { format: entry.format },
    });
  }
  return out;
}

function enrichItem(
  item: PlannerItem,
  evidenceByAssetId: ReadonlyMap<string, CurrentFramingEvidence>,
  requestedFormats: readonly OutputFormat[],
): PlannerItem {
  const readiness = currentReadinessFor(
    item,
    evidenceByAssetId,
    requestedFormats,
  );
  const blockers = formatBlockersFor(readiness);
  const reasons: PlannerReason[] = [...item.reasons, ...blockers];

  if (item.state === "BLOCKED") {
    return {
      ...item,
      outputFormatReadiness: readiness,
      reasons,
      generationAllowed: false,
    };
  }

  if (blockers.length > 0) {
    return {
      ...item,
      state: "BLOCKED",
      fineGrainedReadiness: "INSUFFICIENT_REFERENCE",
      outputFormatReadiness: readiness,
      reasons,
      generationAllowed: false,
    };
  }

  if (item.state === "REVIEW") {
    return {
      ...item,
      fineGrainedReadiness: "NEEDS_CONFIRMATION",
      outputFormatReadiness: readiness,
      reasons,
      generationAllowed: false,
    };
  }

  return {
    ...item,
    outputFormatReadiness: readiness,
    reasons,
    generationAllowed: true,
  };
}

// --------------------------------------------------------------------------
// Public API
// --------------------------------------------------------------------------

/**
 * Fuehrt den eingefrorenen Planner referenz-only aus und ergaenzt die
 * Output-Format-Freigabe ausschliesslich aus der aktuellen Framing-Evidenz
 * der ausgewaehlten Primary-Referenz.
 */
export function buildReferencePlannerWithCurrentFraming(
  rawInput: unknown,
): PlannerOutput {
  const { plannerInput, framingEvidence } =
    parsePlannerWithCurrentFramingInput(rawInput);

  const baseline = buildReferencePlanner(buildReferenceOnlyInput(plannerInput));

  const requestedFormats: readonly OutputFormat[] =
    plannerInput.requestedOutputFormats ?? [];
  if (requestedFormats.length === 0) return baseline;

  const evidenceByAssetId = new Map<string, CurrentFramingEvidence>(
    framingEvidence.map((entry) => [entry.assetId, entry]),
  );

  const items = baseline.items.map((item) =>
    enrichItem(item, evidenceByAssetId, requestedFormats),
  );

  return parsePlannerOutput({
    plannerVersion: baseline.plannerVersion,
    registryVersion: baseline.registryVersion,
    perspectiveMasterVersion: baseline.perspectiveMasterVersion,
    plannedAtIso: baseline.plannedAtIso,
    items,
    summary: {
      readyCount: items.filter((i) => i.state === "READY").length,
      reviewCount: items.filter((i) => i.state === "REVIEW").length,
      blockedCount: items.filter((i) => i.state === "BLOCKED").length,
      generationAllowed: items.every(
        (i) => i.state === "READY" && i.generationAllowed === true,
      ),
    },
  });
}
