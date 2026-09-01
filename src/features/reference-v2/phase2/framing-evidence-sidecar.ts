import { z } from "zod";
import {
  CURRENT_FRAMING_EVIDENCE_SCHEMA_VERSION,
  CurrentFramingEvidenceSchema,
  parseCurrentFramingEvidence,
  type CurrentFramingEvidence,
} from "./framing-evidence";

/**
 * Reference V2 — Phase 2.4C: reiner Sidecar-Lebenszyklus fuer aktuelle
 * Framing-Evidenz.
 *
 * Autoritaet ist ausschliesslich die Phase-2.4A `CurrentFramingEvidence`.
 * Der Sidecar wird ueber die PERSISTIERTE Referenz-Asset-ID gekeyt, niemals
 * ueber transiente Datei-/Analyzer-IDs. Rein/deterministisch: kein I/O,
 * keine Zeit, kein Zufall, kein DOM, keine Provider-Aufrufe.
 */

// --------------------------------------------------------------------------
// Errors
// --------------------------------------------------------------------------

export class CurrentFramingEvidenceSidecarError extends Error {
  readonly issues: readonly string[];
  constructor(label: string, issues: readonly string[]) {
    super(`${label} invalid: ${issues.join("; ")}`);
    this.name = "CurrentFramingEvidenceSidecarError";
    this.issues = issues;
  }
}

// --------------------------------------------------------------------------
// 1) Facts contract derived from Phase 2.4A
// --------------------------------------------------------------------------

export const CurrentFramingFactsSchema = CurrentFramingEvidenceSchema.pick({
  sourceAspectRatio: true,
  fullVehicleVisible: true,
  cropped: true,
  paddingPct: true,
}).strict();
export type CurrentFramingFacts = z.infer<typeof CurrentFramingFactsSchema>;

function parseFacts(raw: unknown): CurrentFramingFacts {
  const parsed = CurrentFramingFactsSchema.safeParse(raw);
  if (!parsed.success) {
    throw new CurrentFramingEvidenceSidecarError(
      "current framing facts",
      parsed.error.issues.map(
        (i) => `${i.path.join(".") || "root"}: ${i.message}`,
      ),
    );
  }
  return parsed.data;
}

// --------------------------------------------------------------------------
// 2) Creation seam for the persisted asset id
// --------------------------------------------------------------------------

export function createCurrentFramingEvidenceForAsset(
  assetId: string,
  rawFacts: unknown,
): CurrentFramingEvidence {
  const facts = parseFacts(rawFacts);
  return parseCurrentFramingEvidence({
    schemaVersion: CURRENT_FRAMING_EVIDENCE_SCHEMA_VERSION,
    assetId,
    sourceAspectRatio: facts.sourceAspectRatio,
    fullVehicleVisible: facts.fullVehicleVisible,
    cropped: facts.cropped,
    paddingPct: facts.paddingPct,
  });
}

// --------------------------------------------------------------------------
// 3) Explicit rebase helper
// --------------------------------------------------------------------------

export function rebaseCurrentFramingEvidence(
  rawEvidence: unknown,
  persistedAssetId: string,
): CurrentFramingEvidence {
  const source = parseCurrentFramingEvidence(rawEvidence);
  return parseCurrentFramingEvidence({ ...source, assetId: persistedAssetId });
}

// --------------------------------------------------------------------------
// 4) Sidecar contract
// --------------------------------------------------------------------------

const SidecarShapeSchema = z
  .object({
    byAssetId: z.record(z.string(), z.unknown()),
  })
  .strict();

export const CurrentFramingEvidenceSidecarSchema = SidecarShapeSchema.transform(
  (shape, ctx) => {
    const out: Record<string, CurrentFramingEvidence> = {};
    for (const key of Object.keys(shape.byAssetId)) {
      if (key.length === 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["byAssetId"],
          message: "sidecar keys must be non-empty",
        });
        return z.NEVER;
      }
      const value = parseCurrentFramingEvidence(shape.byAssetId[key]);
      if (value.assetId !== key) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["byAssetId", key, "assetId"],
          message: `sidecar key ${key} must equal value.assetId ${value.assetId}`,
        });
        return z.NEVER;
      }
      out[key] = value;
    }
    return { byAssetId: out };
  },
);

export type CurrentFramingEvidenceSidecar = {
  byAssetId: Record<string, CurrentFramingEvidence>;
};

export function parseCurrentFramingEvidenceSidecar(
  raw: unknown,
): CurrentFramingEvidenceSidecar {
  const parsed = CurrentFramingEvidenceSidecarSchema.safeParse(raw);
  if (!parsed.success) {
    throw new CurrentFramingEvidenceSidecarError(
      "current framing evidence sidecar",
      parsed.error.issues.map(
        (i) => `${i.path.join(".") || "root"}: ${i.message}`,
      ),
    );
  }
  return parsed.data;
}

// --------------------------------------------------------------------------
// 5) Empty / upsert / remove / prune
// --------------------------------------------------------------------------

export function emptyCurrentFramingEvidenceSidecar(): CurrentFramingEvidenceSidecar {
  return { byAssetId: {} };
}

export function upsertCurrentFramingEvidence(
  sidecarRaw: unknown,
  evidenceRaw: unknown,
): CurrentFramingEvidenceSidecar {
  const sidecar = parseCurrentFramingEvidenceSidecar(sidecarRaw);
  const evidence = parseCurrentFramingEvidence(evidenceRaw);
  const next: Record<string, CurrentFramingEvidence> = {};
  for (const key of Object.keys(sidecar.byAssetId)) {
    next[key] =
      key === evidence.assetId ? { ...evidence } : { ...sidecar.byAssetId[key] };
  }
  if (!(evidence.assetId in next)) {
    next[evidence.assetId] = { ...evidence };
  }
  return parseCurrentFramingEvidenceSidecar({ byAssetId: next });
}

export function removeCurrentFramingEvidence(
  sidecarRaw: unknown,
  assetId: string,
): CurrentFramingEvidenceSidecar {
  const sidecar = parseCurrentFramingEvidenceSidecar(sidecarRaw);
  const next: Record<string, CurrentFramingEvidence> = {};
  for (const key of Object.keys(sidecar.byAssetId)) {
    if (key === assetId) continue;
    next[key] = { ...sidecar.byAssetId[key] };
  }
  return parseCurrentFramingEvidenceSidecar({ byAssetId: next });
}

function parseKnownAssetIds(raw: unknown): string[] {
  const parsed = z.array(z.string().min(1)).safeParse(raw);
  if (!parsed.success) {
    throw new CurrentFramingEvidenceSidecarError(
      "known asset ids",
      parsed.error.issues.map(
        (i) => `${i.path.join(".") || "root"}: ${i.message}`,
      ),
    );
  }
  const seen = new Set<string>();
  for (const id of parsed.data) {
    if (seen.has(id)) {
      throw new CurrentFramingEvidenceSidecarError("known asset ids", [
        `duplicate known asset id ${id}`,
      ]);
    }
    seen.add(id);
  }
  return parsed.data;
}

export function pruneCurrentFramingEvidence(
  sidecarRaw: unknown,
  knownAssetIds: unknown,
): CurrentFramingEvidenceSidecar {
  const sidecar = parseCurrentFramingEvidenceSidecar(sidecarRaw);
  const known = new Set(parseKnownAssetIds(knownAssetIds));
  const next: Record<string, CurrentFramingEvidence> = {};
  for (const key of Object.keys(sidecar.byAssetId)) {
    if (!known.has(key)) continue;
    next[key] = { ...sidecar.byAssetId[key] };
  }
  return parseCurrentFramingEvidenceSidecar({ byAssetId: next });
}

// --------------------------------------------------------------------------
// 6) Planner projection — fail-closed on stale evidence
// --------------------------------------------------------------------------

export function currentFramingEvidenceForPlanner(
  sidecarRaw: unknown,
  knownAssetIds: unknown,
): CurrentFramingEvidence[] {
  const sidecar = parseCurrentFramingEvidenceSidecar(sidecarRaw);
  const known = parseKnownAssetIds(knownAssetIds);
  const knownSet = new Set(known);
  const stale = Object.keys(sidecar.byAssetId).filter((k) => !knownSet.has(k));
  if (stale.length > 0) {
    throw new CurrentFramingEvidenceSidecarError(
      "current framing evidence sidecar",
      [`stale evidence for unknown asset ids: ${stale.join(", ")}`],
    );
  }
  const out: CurrentFramingEvidence[] = [];
  for (const id of known) {
    const evidence = sidecar.byAssetId[id];
    if (evidence === undefined) continue;
    out.push({ ...evidence });
  }
  return out;
}
