import { z } from "zod";

/**
 * Reference V2 — Vehicle Class Model (Phase 0).
 *
 * DOMAIN-GRUNDSATZ:
 * Die Fahrzeugklasse ist eine rein VISUELLE Kategorie (Karosserie-Typologie),
 * KEIN Business-Kontext. Marke, Modell, Variante, Baujahr und VIN existieren
 * ausschliesslich ausserhalb des Bildgenerierungs-Kontexts und werden hier
 * niemals modelliert.
 */
export const VEHICLE_CLASSES_V2 = [
  "car",
  "van",
  "motorhome",
  "truck",
  "motorcycle",
  "trailer",
] as const;

export type VehicleClassV2 = (typeof VEHICLE_CLASSES_V2)[number];

export const VehicleClassV2Schema = z.enum(VEHICLE_CLASSES_V2);
