/**
 * Reference V2 — Strict-Reference Vehicle Image Pipeline (Phase 0).
 * Isolierter, provider-unabhaengiger Domain-Kern.
 * KEINE Imports aus Legacy-Code (pipeline-jobs.ts, remaster-prompt.ts etc.).
 */
export * from "./domain/vehicle-classes";
export * from "./domain/surfaces";
export * from "./domain/angles";
export * from "./domain/perspectives/types";
export * from "./domain/perspectives/standard-exterior";
export * from "./domain/perspectives/hero";
export * from "./domain/perspectives/low-angle";
export * from "./domain/perspectives/elevated";
export * from "./domain/perspectives/interior";
export * from "./domain/perspectives/detail";
export * from "./domain/perspectives/registry";
export * from "./domain/capability-profiles";
export * from "./domain/vision-intake";
export * from "./domain/readiness";
export * from "./domain/editing-modules";
export * from "./domain/generation-request";
export * from "./domain/job-context";
export * from "./domain/qa";
export * from "./domain/scene-logo";
export * from "./domain/prompt-assembler";
