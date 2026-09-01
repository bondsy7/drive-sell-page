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

/** Nur echte Record-Container: Object.prototype oder null als Prototyp. */
function isPlainRecord(value: unknown): value is Record<string, unknown> {
  if (typeof value !== "object" || value === null) return false;
  if (Array.isArray(value)) return false;
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

function hasOwn(record: Record<string, unknown>, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(record, key);
}

export function buildReferencePlannerFromCurrentFramingSidecar(
  raw: unknown,
): PlannerOutput {
  if (!isPlainRecord(raw)) {
    throw new PlannerFromCurrentFramingSidecarInputError([
      "root: expected a plain record object",
    ]);
  }
  const record = raw;
  const allowed = new Set<string>(ALLOWED_TOP_LEVEL_KEYS);
  const unknownKeys = Object.keys(record).filter((k) => !allowed.has(k));
  if (unknownKeys.length > 0) {
    throw new PlannerFromCurrentFramingSidecarInputError([
      `root: unrecognized key(s): ${unknownKeys.join(", ")}`,
    ]);
  }
  if (!hasOwn(record, "plannerInput")) {
    throw new PlannerFromCurrentFramingSidecarInputError([
      "plannerInput: required",
    ]);
  }
  if (!hasOwn(record, "framingSidecar")) {
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
