# Phase 2 — Reference Coverage & Output Planner (architecture plan)

Baseline: `55e503cc0943c61fb7952e6800c7cbf7d3962478`. Phase 0/1/1.5 frozen. No generation, no legacy OneShot/remaster/global files. Planning only — no code in this step.

The planner sits between Phase 1.5 (validated assets) and any future generation. It answers exactly one question per requested output: **can this perspective be produced from validated reference evidence — READY, REVIEW or BLOCKED — and with which references?** It never invents visual evidence and never lets metadata override what the images show.

## 1. Domain entities and file boundaries

New namespace `src/features/reference-v2/phase2/` (pure, no React except the UI file):

```text
phase2/
  planner-contract.ts     PlannerInput/PlannerOutput zod schemas, reason codes
  eligibility.ts          per-asset gate: lifecycle, identity, class, mirror, side, role
  candidate-scoring.ts    per (asset x target perspective) match scoring
  adjacency.ts            registry-derived neighbour derivation (no hand-written table)
  coverage.ts             surface coverage from requiredVisibleSurfaces + intake
  planner.ts              deterministic orchestrator producing the plan
  OutputPlannerPanel.tsx  admin UI: select outputs, see coverage/reasons
  __tests__/              phase2 unit tests
```

Reused unchanged: `domain/perspectives/registry.ts`, `domain/perspectives/types.ts`, `domain/angles.ts` (`circularAzimuthDeltaDeg`), `domain/surfaces.ts`, `domain/readiness.ts` (weights, hard-fail codes, `OutputRequestMatchResultSchema`), `domain/capability-profiles.ts`, `phase1/perspective-master.ts`, `phase1/output-format-policy.ts`, `phase1/vehicle-master.ts`, `phase1/ingestion.ts` roles/thresholds, `phase1-5/analysis-record.ts`.

No new perspective rules, no second threshold table, no duplicated surface lists.

## 2. Planner input / output

Input (`PlannerInputSchema`): the `VehicleMasterRecord` (assets included), a list of requested `PerspectiveId`s, optional requested `OutputFormat`s, and a `plannerPolicy` object holding only the knobs the caller may vary (reference budget, whether adjacency substitution is permitted at all, an ISO "now" for expiry evaluation). Nothing brand/model/VIN-shaped — the planner input schema is `.strict()` like Phase 0.

Output (`PlannerOutputSchema`):
- `plannedAtIso`, `registryVersion`, `perspectiveMasterVersion`, `plannerVersion`, `policyFingerprint`
- `items[]`, one per requested perspective, each a superset of the existing `OutputRequestMatchResult`: `perspectiveSpecId` + `perspectiveSpecVersion`, `state` (READY | REVIEW | BLOCKED), the existing `ReferenceReadinessStatus` as the fine-grained sub-status, `primaryReferenceAssetId?`, `secondaryReferenceAssetIds[]`, `scores`, `weightedScore`, `hardFailures[]`, `reasons[]` (code + severity + message + optional assetId/surface), `coverage` (per required surface: score + met flag), `outputFormatReadiness[]`, `substitution` (null or `{ sourcePerspectiveId, azimuthDeltaDeg, rationale }`)
- `summary`: counts by state, and `generationAllowed` = every requested item READY.

The planner is a pure function. It performs no I/O, no provider calls, no writes.

## 3. Deterministic matching per target perspective

For target `T`:
1. `spec = getPerspectiveSpec(T)`, `master = getPerspectiveMasterEntry(T)`. For `category === "hero"` resolve geometry through `basePerspectiveId` — hero is an output key, not new geometry.
2. Vehicle-class gate: if `master.vehicleClasses` excludes the master record's class, or the capability profile removes `T` for that class → BLOCKED, `VEHICLE_CLASS_NOT_APPLICABLE`.
3. Build the candidate set = all assets of the master. Apply the per-asset eligibility gate (section 11 / 8 / 9). Ineligible assets carry reasons but never enter selection.
4. For every eligible asset compute `MatchComponentScores` **against T** using the existing Phase-0 weights and `computeWeightedMatchScore` — recomputed for T, never reusing the stored ingestion score, which was computed against the asset's own requested perspective.
5. Sort deterministically: weighted score desc, then `azimuthErrorDeg` asc, then asset `createdAtIso` asc, then asset id asc. Ties never resolve randomly.
6. Select primary and secondaries (section 4), compute coverage (section 5), derive state (section 6).

Everything is a pure function of (master record, registry, master YAML, policy, `now`).

## 4. Primary / secondary selection and budget

- Primary must be an exact-perspective asset for `T` (`requestedPerspectiveId === T` **and**, when the analyzer produced a canonical perspective, `analysis`-derived perspective === T), must satisfy `canBecomePrimary` (no blockers, no hard failures, role `primary`/`primary_candidate`, analysis present), and must reach `master.minimumPerspectiveScore` and `spec.referenceRequirements.minPrimaryQualityScore`.
- Secondaries are scoped: each secondary must contribute at least one required surface that the primary does not cover, or (for side-sensitive targets) confirm the same vehicle side. A secondary that adds nothing is dropped — extra references dilute identity.
- Budget: **1 primary + max 2 secondaries**. Note the conflict flagged in section 16 with the existing `MAX_SECONDARY_REFERENCES = 3`.
- If `spec.referenceRequirements.allowedMultiReference === false`, secondaries are forbidden entirely and only the exact primary counts.

## 5. Coverage calculation

Per required surface in `spec.requiredVisibleSurfaces`, take the maximum visibility across the selected reference set, using the same fail-closed lookup Phase 1 uses (`surfaceVisibility`: the five core surfaces from the global fields, everything else from `visibility.surfaces` with a missing entry meaning 0). A non-core surface counts as met at `MIN_REQUIRED_SURFACE_VISIBILITY` (0.5), reusing the Phase-1 constant rather than a new one. `requiredCoverageSurfaces` from `referenceRequirements` is treated as the mandatory subset that must be met for READY. Wheel requirements come from `spec.framing.requiredVisibleWheels`. Output-format readiness reuses `evaluateOutputFormatReadiness` for the selected primary.

## 6. States and reason codes

- **READY** — exact primary, all mandatory surfaces met, `weightedScore >= master.minimumPerspectiveScore`, no hard failures, all requested output formats ready. Maps to `READY_EXACT` / `READY_MULTI_REFERENCE`.
- **REVIEW** — a usable set exists but something needs a human decision: only `primary_candidate` never promoted, a non-mandatory surface short, an output format not croppable, a permitted adjacency substitution, or `sameVehicleConfidence` below `MIN_SAME_VEHICLE_CONFIDENCE` without a hard identity conflict. Maps to `NEEDS_CONFIRMATION`.
- **BLOCKED** — no eligible primary, a hard failure, class not applicable, mandatory surface unproven, or an unavailable/expired file. Maps to `INSUFFICIENT_REFERENCE` / `BLOCKED_IDENTITY_CONFLICT` / `BLOCKED_FILE_UNAVAILABLE`.

Reason codes (new Phase-2 enum, additive; Phase-0 hard-fail codes are reused verbatim, not renamed): `NO_ELIGIBLE_PRIMARY`, `PRIMARY_NOT_PROMOTED`, `EXACT_PERSPECTIVE_MISSING`, `ADJACENT_SUBSTITUTION_APPLIED`, `ADJACENT_SUBSTITUTION_REFUSED`, `REQUIRED_SURFACE_UNPROVEN`, `SCORE_BELOW_MINIMUM`, `OUTPUT_FORMAT_NOT_READY`, `VEHICLE_CLASS_NOT_APPLICABLE`, `IDENTITY_CLUSTER_MIXED`, `IDENTITY_CONFIDENCE_LOW`, `MIRROR_RISK`, `SIDE_EVIDENCE_MISSING`, `FILE_NOT_ANALYZED`, `FILE_PROVIDER_INVALID`, `FILE_MIME_INVALID`, `FILE_EXPIRED`, `SECONDARY_BUDGET_TRUNCATED`, `NO_ANALYSIS_RECORD`.

Every non-READY item carries at least one reason; a READY item carries no blocking reason. That invariant is schema-enforced.

## 7. Adjacent references: fail closed by default

Default: **absent exact perspective = BLOCKED**, reason `EXACT_PERSPECTIVE_MISSING`. No model knowledge, no "the AI can interpolate".

The only permitted relaxation is registry-derived and never upgrades to READY:
- Adjacency is computed, not authored: for two specs with a defined `pose.azimuthDeg`, same `elevationProfile` and same `sideMustMatch` outcome, the delta comes from `circularAzimuthDeltaDeg`. A candidate qualifies as adjacent only within `master.maxAzimuthErrorDeg` (falling back to `azimuthToleranceDeg`), i.e. the same tolerance Phase 1 already uses — no new angle table.
- Interior and detail perspectives have no azimuth and therefore have **no adjacency**: a missing `DET_HEADLIGHT_LEFT` can never be served by `DET_HEADLIGHT_RIGHT` or by a 3/4 shot. Structurally impossible, not a policy toggle.
- Even when adjacency qualifies, every mandatory surface must still be positively proven by the selected set. Otherwise BLOCKED.
- A qualifying substitution yields **REVIEW** with `ADJACENT_SUBSTITUTION_APPLIED` plus the delta, so a human approves it explicitly. Substitution is off unless `plannerPolicy.allowAdjacentSubstitution === true`.

## 8. Identity cluster enforcement

All selected references must share the master record's `identityClusterId`. Any asset whose intake reports a different cluster is ineligible (Phase-1 already hard-fails it). If eligible assets for one target resolve to more than one cluster, the item is BLOCKED with `IDENTITY_CLUSTER_MIXED` — mixing two physical cars into one output is never a warning. `sameVehicleConfidence` below `MIN_SAME_VEHICLE_CONFIDENCE` demotes to REVIEW when no hard conflict exists.

## 9. Left/right and mirror safety

- Side is vehicle-relative, from `orientationRules.sideConvention`; the required side is derived from `spec.requiredVisibleSurfaces` exactly as Phase 1's `requiredSide` does — no second derivation.
- For side-sensitive targets, a candidate must show the required side more strongly than the opposite side; equal or inverted visibility is a hard fail (`WRONG_VEHICLE_SIDE`), never score-compensated. If neither side is observed at all, `SIDE_EVIDENCE_MISSING` → BLOCKED, not "assume correct".
- Mirrored candidates (`MIRRORED_REFERENCE` / `mirroredSuspected`) are never selected, for any role. `mirrorForbidden` is `true` for every spec; the planner never mirrors an asset to fill the opposite side.
- Non-side-sensitive targets (front, rear, most interior/detail) must not be side-failed — the Phase-1 asymmetry is preserved.

## 10. Vehicle-class applicability

Class comes from the `VehicleMasterRecord` plus the visual class the analyzer detected — where they disagree, Phase 1 has already hard-failed the asset (`VEHICLE_CLASS_MISMATCH`), and the planner does not re-litigate it. Target applicability is checked against `master.vehicleClasses` from the PerspectiveMaster YAML, intersected with the class `CapabilityProfile` (`addedPerspectiveIds` / `removedPerspectiveIds`). The planner also exposes the applicable perspective list so the UI cannot offer an inapplicable output at all.

## 11. File-reference lifecycle

An asset is only selectable when its `analysis` record exists and satisfies all of: `status === "analyzed"`, `providerId === REFERENCE_V2_PROVIDER_ID`, `mimeType` in the allowed jpeg/png/webp set, and — when `fileExpiresAtIso` is known — `fileExpiresAtIso > now`. Unknown expiry is treated as unknown, not as valid-forever: it produces a REVIEW-level reason, never a silent READY. A missing analysis record is `NO_ANALYSIS_RECORD` → not selectable (this is precisely what keeps manual diagnostic assets out of generation). `now` is injected, so tests are deterministic.

## 12. UX flow in MarketingHub

Inside the existing admin Reference V2 view, after intake, a new "Ausgaben planen" step:
1. Perspective picker grouped by the registry categories, showing only class-applicable perspectives, with a coverage badge per perspective (green READY / amber REVIEW / red BLOCKED) computed live from the store.
2. Selecting outputs shows a coverage panel per selected perspective: chosen primary thumbnail, scoped secondaries, per-surface coverage bars, output-format readiness for 4:5 and 1.91:1, and the plain-German reason list.
3. REVIEW items require an explicit per-item acknowledgement (checkbox) before the plan is considered acted upon; BLOCKED items offer "Referenz nachliefern" and deep-link to the capture workflow with the missing perspective preselected.
4. A summary bar states how many outputs are ready. Any future generation entry point stays disabled while a selected item is BLOCKED — Phase 2 only computes and displays this flag; it wires no generation.

## 13. Persistence

- Pure/derived, never stored: eligibility, scores, coverage, adjacency, state. They must always be recomputable from assets + registry version, otherwise a registry change would silently keep a stale verdict alive.
- Worth persisting later: a **planner snapshot** written at the moment a human acts on a plan — planner/registry/master versions, policy fingerprint, and per item the state, chosen asset ids, scores and reason codes. That is the audit trail for "why was this output allowed".
- Recommendation for Phase 2: keep it in the existing local `reference-store` as an in-memory snapshot list with the same versioned history pattern the store already uses. Introduce a backend table only together with real generation, so schema shape follows a proven planner rather than a guess.
- A snapshot is invalid as soon as `registryVersion`, `perspectiveMasterVersion` or `plannerVersion` differ from runtime — display it read-only and force a replan.

## 14. Tests and acceptance criteria

New `phase2` test suite, pure and network-free:
- exact primary + full coverage → READY; identical input twice → byte-identical output (determinism)
- only `primary_candidate`, never promoted → REVIEW with `PRIMARY_NOT_PROMOTED`
- missing exact perspective, adjacency disabled → BLOCKED `EXACT_PERSPECTIVE_MISSING`
- adjacency enabled and within `maxAzimuthErrorDeg` → REVIEW with delta; beyond tolerance → BLOCKED
- detail/interior target never accepts any substitute
- wrong-side candidate with a very high score → still BLOCKED (no score compensation)
- mirrored candidate never selected in any role
- mixed identity clusters → BLOCKED `IDENTITY_CLUSTER_MIXED`
- lifecycle matrix: pending/failed status, wrong provider, disallowed MIME, expired file, missing analysis → each not selectable, with the matching reason
- budget: four useful candidates → 1 primary + exactly 2 secondaries, `SECONDARY_BUDGET_TRUNCATED` reported
- secondary that adds no uncovered surface is dropped
- class-inapplicable target → BLOCKED, and not offered by the applicable-perspective helper
- non-core required surface at 0 → BLOCKED `REQUIRED_SURFACE_UNPROVEN`
- planner output parses against its own strict schema; no forbidden metadata key can survive it

Acceptance: 100% of the above green; `bun run test`, `tsgo --noEmit`, `tsc --noEmit`, `bun run build` clean; targeted lint clean; `git diff` shows only `src/features/reference-v2/phase2/**` plus the one admin-view mount point.

## 15. Phase 2 implementation sequence

1. **2.0 Contracts** — `planner-contract.ts`: input/output schemas, reason-code enum, state mapping to the Phase-0 readiness statuses. Tests on the schemas only.
2. **2.1 Eligibility** — per-asset gate (lifecycle, identity, class, mirror, side, role) + tests.
3. **2.2 Scoring & coverage** — target-relative `MatchComponentScores` via existing weights, `adjacency.ts`, `coverage.ts` + tests.
4. **2.3 Planner orchestration** — selection, budget, state/reason derivation, deterministic ordering + full matrix tests.
5. **2.4 UI** — `OutputPlannerPanel.tsx`, mounted as a new step inside the existing admin Reference V2 view. Read-only against the store.
6. **2.5 Snapshots** — in-memory snapshot + version invalidation in the existing store.
7. **2.6 Verification** — full test/typecheck/build/lint run and a scope diff.

Generation stays out of Phase 2 entirely.

## 16. Ambiguities and design traps found in the current code

1. **Reference budget conflict.** `domain/generation-request.ts` sets `MAX_SECONDARY_REFERENCES = 3`; this brief requires max 2. Proposal: the planner enforces 2 as its own policy constant and stays inside the Phase-0 schema limit; Phase 0 is not modified. Confirm this is the intent rather than lowering the Phase-0 constant.
2. **Coverage is keyed by the admin's requested perspective, not the detected one.** `computeCoverage` groups assets by `requestedPerspectiveId`. If the analyzer detected a different canonical perspective, Phase-1 ingestion flags a mismatch, but coverage still files the asset under the human's label. That contradicts "the image is the truth". The Phase-2 planner must key on the analyzer's canonical perspective and treat `requestedPerspectiveId` as a hint only.
3. **`primary_candidate` is counted as a secondary in Phase-1 coverage**, and `role: "primary"` only ever arrives through manual promotion. So a perfect, fully validated asset reads as "no primary" until a human clicks. Phase 2 must express this as REVIEW/`PRIMARY_NOT_PROMOTED`, not as BLOCKED, or the planner will look broken on healthy data.
4. **Stored `weightedScore` is target-specific.** It was computed against the asset's own requested perspective. Reusing it for a different target would silently mis-rank. The planner must recompute per target.
5. **`fileExpiresAtIso` is optional and nothing currently sets it.** Provider files do expire. Absent expiry must be handled as unknown (REVIEW), and the intake should be extended later to persist the provider's expiry — worth a small follow-up outside Phase 2.
6. **Phase 1 state is local only.** No persistence exists for masters or assets, so a planner snapshot is only as durable as the browser session. That is acceptable for Phase 2 but must not be sold as an audit trail yet.
7. **Hero perspectives carry their own `pose`** while also referencing `basePerspectiveId`. The planner must fix one resolution order (base geometry wins for matching, hero id wins for the output key) or two hero outputs can disagree about the same reference.
8. **`MIRRORED_SUSPECTED` is a suspicion, treated as a hard fail.** That is the safe direction, but it means one shaky analyzer signal can block a whole perspective with no override path. The UI should surface it explicitly as "gespiegelt vermutet" so an admin can re-shoot rather than be stuck.
9. **Output-format readiness depends on `paddingPct`, an analyzer estimate.** Treating an estimate as a gate will produce false BLOCKEDs; Phase 2 should keep format readiness at REVIEW severity, never as a hard block.

## Note on process

Plan mode requires the plan to be surfaced through this file, so it was written here rather than only in chat, as the request asked. No source file was touched.
