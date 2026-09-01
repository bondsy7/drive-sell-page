/**
 * Reference V2 — Azimuth Conventions (Phase 0).
 *
 * Exterieur-Winkelkonvention (Draufsicht, fahrzeugrelativ):
 *   0°    Front
 *   +45°  Front-Right 3/4
 *   +90°  Right Side (rechte Fahrzeugseite)
 *   +135° Rear-Right 3/4
 *   180°  Rear
 *   -135° Rear-Left 3/4
 *   -90°  Left Side (linke Fahrzeugseite)
 *   -45°  Front-Left 3/4
 *
 * Positive Winkel liegen auf der RECHTEN Fahrzeugseite, negative auf der
 * LINKEN. Der normalisierte Wertebereich ist (-180, 180].
 * Links/Rechts sind IMMER fahrzeugrelativ, niemals Betrachterseite.
 */
export const AZIMUTH_CONVENTION = {
  frontDeg: 0,
  frontRightDeg: 45,
  rightSideDeg: 90,
  rearRightDeg: 135,
  rearDeg: 180,
  rearLeftDeg: -135,
  leftSideDeg: -90,
  frontLeftDeg: -45,
} as const;

/** Normalisiert einen Winkel in den Bereich (-180, 180]. */
export function normalizeAzimuthDeg(deg: number): number {
  if (!Number.isFinite(deg)) {
    throw new Error(`normalizeAzimuthDeg: non-finite azimuth ${deg}`);
  }
  let a = deg % 360;
  if (a > 180) a -= 360;
  if (a <= -180) a += 360;
  return Object.is(a, -0) ? 0 : a;
}

/** Kleinste Kreisdistanz zwischen zwei Azimuten in Grad (0..180). */
export function circularAzimuthDeltaDeg(aDeg: number, bDeg: number): number {
  const a = normalizeAzimuthDeg(aDeg);
  const b = normalizeAzimuthDeg(bDeg);
  const d = Math.abs(a - b) % 360;
  return d > 180 ? 360 - d : d;
}

/** True, wenn der Azimut auf der rechten Fahrzeugseite liegt (0 und 180 ausgenommen). */
export function isRightHemisphere(azimuthDeg: number): boolean {
  const a = normalizeAzimuthDeg(azimuthDeg);
  return a > 0 && a < 180;
}

/** True, wenn der Azimut auf der linken Fahrzeugseite liegt (0 und 180 ausgenommen). */
export function isLeftHemisphere(azimuthDeg: number): boolean {
  const a = normalizeAzimuthDeg(azimuthDeg);
  return a < 0 && a > -180;
}
