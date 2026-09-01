import { z } from "zod";

/**
 * Reference V2 — Visual Surfaces (Phase 0).
 *
 * Alle Seitenangaben sind IMMER fahrzeugrelativ (Fahrtrichtung des Fahrzeugs),
 * niemals betrachterrelativ und niemals von LHD/RHD abhaengig.
 */
export const VISUAL_SURFACES = [
  // Exterior core
  "front",
  "rear",
  "left_side",
  "right_side",
  "roof",
  "underbody",
  // Exterior detail
  "headlight_left",
  "headlight_right",
  "taillight_left",
  "taillight_right",
  "grille",
  "front_badge",
  "rear_badge",
  "wheel_front_left",
  "wheel_front_right",
  "wheel_rear_left",
  "wheel_rear_right",
  "mirror_left",
  "mirror_right",
  "door_left",
  "door_right",
  "charge_port",
  "fuel_flap",
  // Interior
  "dashboard",
  "steering_wheel",
  "instrument_cluster",
  "infotainment",
  "center_console",
  "front_seats",
  "rear_seats",
  "door_panel_left",
  "door_panel_right",
  "headliner",
  "cargo_area",
] as const;

export type VisualSurface = (typeof VISUAL_SURFACES)[number];

export const VisualSurfaceSchema = z.enum(VISUAL_SURFACES);

/** Radpositionen, fahrzeugrelativ. */
export const WHEEL_POSITIONS = [
  "front_left",
  "front_right",
  "rear_left",
  "rear_right",
] as const;

export type WheelPosition = (typeof WHEEL_POSITIONS)[number];

export const WheelPositionSchema = z.enum(WHEEL_POSITIONS);

/** Die fuenf Kern-Aussenflaechen fuer Sichtbarkeits-Scores im Vision Intake. */
export const CORE_EXTERIOR_SURFACES = [
  "front",
  "rear",
  "left_side",
  "right_side",
  "roof",
] as const satisfies readonly VisualSurface[];
