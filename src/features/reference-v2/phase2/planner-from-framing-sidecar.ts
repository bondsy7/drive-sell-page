import {
  parsePlannerInput,
  type PlannerInput,
  type PlannerOutput,
} from "./planner-contract";
import {
  currentFramingEvidenceForPlanner,
  parseCurrentFramingEvidenceSidecar,
  type CurrentFramingEvidenceSidecar,
} from "./framing-evidence-sidecar";
import { buildReferencePlannerWithCurrentFraming } from "./planner-with-framing";

/**
 * Reference V2 — Phase 2.4D: reiner Adapter, der den eingefrorenen
 * 2.4B-Planner direkt aus einem eingefrorenen 2.4C-Sidecar speist.
 *
 * Bekannte Asset-IDs stammen AUSSCHLIESSLICH aus
 * `plannerInput.vehicleMaster.assets`. Veraltete oder fremde Evidenz faellt
 * ueber die 2.4C-Projektion fail-closed. Es gibt hier keine eigene
 * Readiness-, Crop- oder Auswahl-Logik. Kein I/O, keine Zeit, kein Zufall.
 */

export interface PlannerFromCurrentFramingSidecarInput {
  readonly plannerInput: PlannerInput;
  readonly framingSidecar: CurrentFramingEvidenceSidecar;
}

export class PlannerFromCurrentFramingSidecarInputError extends Error {
  readonly issues: readonly string[];
  constructor(issues: readonly string[]) {
    super(
      `planner from current framing sidecar input invalid: ${issues.join("; ")}`,
    );
    this.name = "PlannerFromCurrentFramingSidecarInputError";
    this.issues = issues;
  }
}

const ALLOWED_TOP_LEVEL_KEYS = ["plannerInput", "framingSidecar"] as const;

export function buildReferencePlannerFromCurrentFramingSidecar(
  raw: unknown,
): PlannerOutput {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    throw new PlannerFromCurrentFramingSidecarInputError([
      "root: expected a plain object",
    ]);
  }
  const record = raw as Record<string, unknown>;
  const allowed = new Set<string>(ALLOWED_TOP_LEVEL_KEYS);
  const unknownKeys = Object.keys(record).filter((k) => !allowed.has(k));
  if (unknownKeys.length > 0) {
    throw new PlannerFromCurrentFramingSidecarInputError([
      `root: unrecognized key(s): ${unknownKeys.join(", ")}`,
    ]);
  }
  if (!("plannerInput" in record)) {
    throw new PlannerFromCurrentFramingSidecarInputError([
      "plannerInput: required",
    ]);
  }
  if (!("framingSidecar" in record)) {
    throw new PlannerFromCurrentFramingSidecarInputError([
      "framingSidecar: required",
    ]);
  }

  const plannerInput = parsePlannerInput(record.plannerInput);
  const sidecar = parseCurrentFramingEvidenceSidecar(record.framingSidecar);
  const knownAssetIds = plannerInput.vehicleMaster.assets.map((a) => a.id);
  const framingEvidence = currentFramingEvidenceForPlanner(
    sidecar,
    knownAssetIds,
  );
  return buildReferencePlannerWithCurrentFraming({
    plannerInput,
    framingEvidence,
  });
}
