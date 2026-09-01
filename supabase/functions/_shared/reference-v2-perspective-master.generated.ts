// GENERATED FILE — DO NOT EDIT BY HAND.
// Source: src/features/reference-v2/domain/perspectives/registry.ts (via scripts/generate-perspective-master.ts)
// Reference V2 ONLY. Consumed exclusively by the reference-v2-* edge functions
// so the server never trusts perspective definitions sent by the browser.

export const REFERENCE_V2_MASTER_VERSION = 1;
export const REFERENCE_V2_REGISTRY_VERSION = 1;
export const REFERENCE_V2_SIDE_CONVENTION = "vehicle_relative" as const;

export const REFERENCE_V2_VEHICLE_CLASSES = ["car","van","motorhome","truck","motorcycle","trailer"] as const;
export const REFERENCE_V2_ELEVATION_PROFILES = ["low","standard","elevated","interior","close_detail"] as const;
export const REFERENCE_V2_WHEEL_POSITIONS = ["front_left","front_right","rear_left","rear_right"] as const;
export const REFERENCE_V2_VISUAL_SURFACES = ["front","rear","left_side","right_side","roof","underbody","headlight_left","headlight_right","taillight_left","taillight_right","grille","front_badge","rear_badge","wheel_front_left","wheel_front_right","wheel_rear_left","wheel_rear_right","mirror_left","mirror_right","door_left","door_right","charge_port","fuel_flap","dashboard","steering_wheel","instrument_cluster","infotainment","center_console","front_seats","rear_seats","door_panel_left","door_panel_right","headliner","cargo_area"] as const;
export const REFERENCE_V2_ISSUE_SEVERITIES = ["critical","major","minor"] as const;

export interface ReferenceV2MasterEntry {
  readonly id: string;
  readonly category: string;
  readonly vehicleClasses: readonly string[];
  readonly azimuthDeg: number | null;
  readonly azimuthToleranceDeg: number | null;
  readonly maxAzimuthErrorDeg: number | null;
  readonly elevationProfile: string;
  readonly sideMustMatch: boolean;
  readonly requiredVisibleSurfaces: readonly string[];
  readonly fullVehicle: boolean;
  readonly paddingMinPct: number;
  readonly paddingMaxPct: number;
  readonly vehicleFrontImageDirection: string | null;
}

export const REFERENCE_V2_PERSPECTIVE_MASTER: readonly ReferenceV2MasterEntry[] =
[
  {
    "id": "EXT_FRONT",
    "category": "standard_exterior",
    "vehicleClasses": [
      "car",
      "van",
      "motorhome",
      "truck",
      "motorcycle",
      "trailer"
    ],
    "azimuthDeg": 0,
    "azimuthToleranceDeg": 7,
    "maxAzimuthErrorDeg": 9,
    "elevationProfile": "standard",
    "sideMustMatch": false,
    "requiredVisibleSurfaces": [
      "front"
    ],
    "fullVehicle": true,
    "paddingMinPct": 4,
    "paddingMaxPct": 12,
    "vehicleFrontImageDirection": "toward_camera"
  },
  {
    "id": "EXT_34_FRONT_RIGHT",
    "category": "standard_exterior",
    "vehicleClasses": [
      "car",
      "van",
      "motorhome",
      "truck",
      "motorcycle",
      "trailer"
    ],
    "azimuthDeg": 45,
    "azimuthToleranceDeg": 9,
    "maxAzimuthErrorDeg": 11,
    "elevationProfile": "standard",
    "sideMustMatch": true,
    "requiredVisibleSurfaces": [
      "front",
      "right_side"
    ],
    "fullVehicle": true,
    "paddingMinPct": 4,
    "paddingMaxPct": 12,
    "vehicleFrontImageDirection": "toward_camera"
  },
  {
    "id": "EXT_SIDE_RIGHT",
    "category": "standard_exterior",
    "vehicleClasses": [
      "car",
      "van",
      "motorhome",
      "truck",
      "motorcycle",
      "trailer"
    ],
    "azimuthDeg": 90,
    "azimuthToleranceDeg": 7,
    "maxAzimuthErrorDeg": 9,
    "elevationProfile": "standard",
    "sideMustMatch": true,
    "requiredVisibleSurfaces": [
      "right_side"
    ],
    "fullVehicle": true,
    "paddingMinPct": 4,
    "paddingMaxPct": 12,
    "vehicleFrontImageDirection": "left"
  },
  {
    "id": "EXT_34_REAR_RIGHT",
    "category": "standard_exterior",
    "vehicleClasses": [
      "car",
      "van",
      "motorhome",
      "truck",
      "motorcycle",
      "trailer"
    ],
    "azimuthDeg": 135,
    "azimuthToleranceDeg": 9,
    "maxAzimuthErrorDeg": 11,
    "elevationProfile": "standard",
    "sideMustMatch": true,
    "requiredVisibleSurfaces": [
      "rear",
      "right_side"
    ],
    "fullVehicle": true,
    "paddingMinPct": 4,
    "paddingMaxPct": 12,
    "vehicleFrontImageDirection": "away_from_camera"
  },
  {
    "id": "EXT_REAR",
    "category": "standard_exterior",
    "vehicleClasses": [
      "car",
      "van",
      "motorhome",
      "truck",
      "motorcycle",
      "trailer"
    ],
    "azimuthDeg": 180,
    "azimuthToleranceDeg": 7,
    "maxAzimuthErrorDeg": 9,
    "elevationProfile": "standard",
    "sideMustMatch": false,
    "requiredVisibleSurfaces": [
      "rear"
    ],
    "fullVehicle": true,
    "paddingMinPct": 4,
    "paddingMaxPct": 12,
    "vehicleFrontImageDirection": "away_from_camera"
  },
  {
    "id": "EXT_34_REAR_LEFT",
    "category": "standard_exterior",
    "vehicleClasses": [
      "car",
      "van",
      "motorhome",
      "truck",
      "motorcycle",
      "trailer"
    ],
    "azimuthDeg": -135,
    "azimuthToleranceDeg": 9,
    "maxAzimuthErrorDeg": 11,
    "elevationProfile": "standard",
    "sideMustMatch": true,
    "requiredVisibleSurfaces": [
      "rear",
      "left_side"
    ],
    "fullVehicle": true,
    "paddingMinPct": 4,
    "paddingMaxPct": 12,
    "vehicleFrontImageDirection": "away_from_camera"
  },
  {
    "id": "EXT_SIDE_LEFT",
    "category": "standard_exterior",
    "vehicleClasses": [
      "car",
      "van",
      "motorhome",
      "truck",
      "motorcycle",
      "trailer"
    ],
    "azimuthDeg": -90,
    "azimuthToleranceDeg": 7,
    "maxAzimuthErrorDeg": 9,
    "elevationProfile": "standard",
    "sideMustMatch": true,
    "requiredVisibleSurfaces": [
      "left_side"
    ],
    "fullVehicle": true,
    "paddingMinPct": 4,
    "paddingMaxPct": 12,
    "vehicleFrontImageDirection": "right"
  },
  {
    "id": "EXT_34_FRONT_LEFT",
    "category": "standard_exterior",
    "vehicleClasses": [
      "car",
      "van",
      "motorhome",
      "truck",
      "motorcycle",
      "trailer"
    ],
    "azimuthDeg": -45,
    "azimuthToleranceDeg": 9,
    "maxAzimuthErrorDeg": 11,
    "elevationProfile": "standard",
    "sideMustMatch": true,
    "requiredVisibleSurfaces": [
      "front",
      "left_side"
    ],
    "fullVehicle": true,
    "paddingMinPct": 4,
    "paddingMaxPct": 12,
    "vehicleFrontImageDirection": "toward_camera"
  },
  {
    "id": "HERO_FRONT_LEFT",
    "category": "hero",
    "vehicleClasses": [
      "car",
      "van",
      "motorhome",
      "truck",
      "motorcycle",
      "trailer"
    ],
    "azimuthDeg": -45,
    "azimuthToleranceDeg": 9,
    "maxAzimuthErrorDeg": 11,
    "elevationProfile": "standard",
    "sideMustMatch": true,
    "requiredVisibleSurfaces": [
      "front",
      "left_side"
    ],
    "fullVehicle": true,
    "paddingMinPct": 6,
    "paddingMaxPct": 18,
    "vehicleFrontImageDirection": "toward_camera"
  },
  {
    "id": "HERO_FRONT_RIGHT",
    "category": "hero",
    "vehicleClasses": [
      "car",
      "van",
      "motorhome",
      "truck",
      "motorcycle",
      "trailer"
    ],
    "azimuthDeg": 45,
    "azimuthToleranceDeg": 9,
    "maxAzimuthErrorDeg": 11,
    "elevationProfile": "standard",
    "sideMustMatch": true,
    "requiredVisibleSurfaces": [
      "front",
      "right_side"
    ],
    "fullVehicle": true,
    "paddingMinPct": 6,
    "paddingMaxPct": 18,
    "vehicleFrontImageDirection": "toward_camera"
  },
  {
    "id": "HERO_FRONT_CENTER",
    "category": "hero",
    "vehicleClasses": [
      "car",
      "van",
      "motorhome",
      "truck",
      "motorcycle",
      "trailer"
    ],
    "azimuthDeg": 0,
    "azimuthToleranceDeg": 7,
    "maxAzimuthErrorDeg": 9,
    "elevationProfile": "standard",
    "sideMustMatch": false,
    "requiredVisibleSurfaces": [
      "front"
    ],
    "fullVehicle": true,
    "paddingMinPct": 6,
    "paddingMaxPct": 18,
    "vehicleFrontImageDirection": "toward_camera"
  },
  {
    "id": "HERO_REAR_LEFT",
    "category": "hero",
    "vehicleClasses": [
      "car",
      "van",
      "motorhome",
      "truck",
      "motorcycle",
      "trailer"
    ],
    "azimuthDeg": -135,
    "azimuthToleranceDeg": 9,
    "maxAzimuthErrorDeg": 11,
    "elevationProfile": "standard",
    "sideMustMatch": true,
    "requiredVisibleSurfaces": [
      "rear",
      "left_side"
    ],
    "fullVehicle": true,
    "paddingMinPct": 6,
    "paddingMaxPct": 18,
    "vehicleFrontImageDirection": "away_from_camera"
  },
  {
    "id": "HERO_REAR_RIGHT",
    "category": "hero",
    "vehicleClasses": [
      "car",
      "van",
      "motorhome",
      "truck",
      "motorcycle",
      "trailer"
    ],
    "azimuthDeg": 135,
    "azimuthToleranceDeg": 9,
    "maxAzimuthErrorDeg": 11,
    "elevationProfile": "standard",
    "sideMustMatch": true,
    "requiredVisibleSurfaces": [
      "rear",
      "right_side"
    ],
    "fullVehicle": true,
    "paddingMinPct": 6,
    "paddingMaxPct": 18,
    "vehicleFrontImageDirection": "away_from_camera"
  },
  {
    "id": "LOW_FRONT",
    "category": "low_angle",
    "vehicleClasses": [
      "car",
      "van",
      "motorhome",
      "truck",
      "motorcycle",
      "trailer"
    ],
    "azimuthDeg": 0,
    "azimuthToleranceDeg": 10,
    "maxAzimuthErrorDeg": 13,
    "elevationProfile": "low",
    "sideMustMatch": false,
    "requiredVisibleSurfaces": [
      "front"
    ],
    "fullVehicle": true,
    "paddingMinPct": 4,
    "paddingMaxPct": 14,
    "vehicleFrontImageDirection": "toward_camera"
  },
  {
    "id": "LOW_FRONT_LEFT",
    "category": "low_angle",
    "vehicleClasses": [
      "car",
      "van",
      "motorhome",
      "truck",
      "motorcycle",
      "trailer"
    ],
    "azimuthDeg": -45,
    "azimuthToleranceDeg": 12,
    "maxAzimuthErrorDeg": 15,
    "elevationProfile": "low",
    "sideMustMatch": true,
    "requiredVisibleSurfaces": [
      "front",
      "left_side"
    ],
    "fullVehicle": true,
    "paddingMinPct": 4,
    "paddingMaxPct": 14,
    "vehicleFrontImageDirection": "toward_camera"
  },
  {
    "id": "LOW_FRONT_RIGHT",
    "category": "low_angle",
    "vehicleClasses": [
      "car",
      "van",
      "motorhome",
      "truck",
      "motorcycle",
      "trailer"
    ],
    "azimuthDeg": 45,
    "azimuthToleranceDeg": 12,
    "maxAzimuthErrorDeg": 15,
    "elevationProfile": "low",
    "sideMustMatch": true,
    "requiredVisibleSurfaces": [
      "front",
      "right_side"
    ],
    "fullVehicle": true,
    "paddingMinPct": 4,
    "paddingMaxPct": 14,
    "vehicleFrontImageDirection": "toward_camera"
  },
  {
    "id": "LOW_REAR",
    "category": "low_angle",
    "vehicleClasses": [
      "car",
      "van",
      "motorhome",
      "truck",
      "motorcycle",
      "trailer"
    ],
    "azimuthDeg": 180,
    "azimuthToleranceDeg": 10,
    "maxAzimuthErrorDeg": 13,
    "elevationProfile": "low",
    "sideMustMatch": false,
    "requiredVisibleSurfaces": [
      "rear"
    ],
    "fullVehicle": true,
    "paddingMinPct": 4,
    "paddingMaxPct": 14,
    "vehicleFrontImageDirection": "away_from_camera"
  },
  {
    "id": "LOW_REAR_LEFT",
    "category": "low_angle",
    "vehicleClasses": [
      "car",
      "van",
      "motorhome",
      "truck",
      "motorcycle",
      "trailer"
    ],
    "azimuthDeg": -135,
    "azimuthToleranceDeg": 12,
    "maxAzimuthErrorDeg": 15,
    "elevationProfile": "low",
    "sideMustMatch": true,
    "requiredVisibleSurfaces": [
      "rear",
      "left_side"
    ],
    "fullVehicle": true,
    "paddingMinPct": 4,
    "paddingMaxPct": 14,
    "vehicleFrontImageDirection": "away_from_camera"
  },
  {
    "id": "LOW_REAR_RIGHT",
    "category": "low_angle",
    "vehicleClasses": [
      "car",
      "van",
      "motorhome",
      "truck",
      "motorcycle",
      "trailer"
    ],
    "azimuthDeg": 135,
    "azimuthToleranceDeg": 12,
    "maxAzimuthErrorDeg": 15,
    "elevationProfile": "low",
    "sideMustMatch": true,
    "requiredVisibleSurfaces": [
      "rear",
      "right_side"
    ],
    "fullVehicle": true,
    "paddingMinPct": 4,
    "paddingMaxPct": 14,
    "vehicleFrontImageDirection": "away_from_camera"
  },
  {
    "id": "HIGH_FRONT",
    "category": "elevated",
    "vehicleClasses": [
      "car",
      "van",
      "motorhome",
      "truck",
      "motorcycle",
      "trailer"
    ],
    "azimuthDeg": 0,
    "azimuthToleranceDeg": 10,
    "maxAzimuthErrorDeg": 13,
    "elevationProfile": "elevated",
    "sideMustMatch": false,
    "requiredVisibleSurfaces": [
      "front",
      "roof"
    ],
    "fullVehicle": true,
    "paddingMinPct": 4,
    "paddingMaxPct": 14,
    "vehicleFrontImageDirection": "toward_camera"
  },
  {
    "id": "HIGH_FRONT_LEFT",
    "category": "elevated",
    "vehicleClasses": [
      "car",
      "van",
      "motorhome",
      "truck",
      "motorcycle",
      "trailer"
    ],
    "azimuthDeg": -45,
    "azimuthToleranceDeg": 12,
    "maxAzimuthErrorDeg": 15,
    "elevationProfile": "elevated",
    "sideMustMatch": true,
    "requiredVisibleSurfaces": [
      "front",
      "left_side",
      "roof"
    ],
    "fullVehicle": true,
    "paddingMinPct": 4,
    "paddingMaxPct": 14,
    "vehicleFrontImageDirection": "toward_camera"
  },
  {
    "id": "HIGH_FRONT_RIGHT",
    "category": "elevated",
    "vehicleClasses": [
      "car",
      "van",
      "motorhome",
      "truck",
      "motorcycle",
      "trailer"
    ],
    "azimuthDeg": 45,
    "azimuthToleranceDeg": 12,
    "maxAzimuthErrorDeg": 15,
    "elevationProfile": "elevated",
    "sideMustMatch": true,
    "requiredVisibleSurfaces": [
      "front",
      "right_side",
      "roof"
    ],
    "fullVehicle": true,
    "paddingMinPct": 4,
    "paddingMaxPct": 14,
    "vehicleFrontImageDirection": "toward_camera"
  },
  {
    "id": "HIGH_REAR",
    "category": "elevated",
    "vehicleClasses": [
      "car",
      "van",
      "motorhome",
      "truck",
      "motorcycle",
      "trailer"
    ],
    "azimuthDeg": 180,
    "azimuthToleranceDeg": 10,
    "maxAzimuthErrorDeg": 13,
    "elevationProfile": "elevated",
    "sideMustMatch": false,
    "requiredVisibleSurfaces": [
      "rear",
      "roof"
    ],
    "fullVehicle": true,
    "paddingMinPct": 4,
    "paddingMaxPct": 14,
    "vehicleFrontImageDirection": "away_from_camera"
  },
  {
    "id": "HIGH_REAR_LEFT",
    "category": "elevated",
    "vehicleClasses": [
      "car",
      "van",
      "motorhome",
      "truck",
      "motorcycle",
      "trailer"
    ],
    "azimuthDeg": -135,
    "azimuthToleranceDeg": 12,
    "maxAzimuthErrorDeg": 15,
    "elevationProfile": "elevated",
    "sideMustMatch": true,
    "requiredVisibleSurfaces": [
      "rear",
      "left_side",
      "roof"
    ],
    "fullVehicle": true,
    "paddingMinPct": 4,
    "paddingMaxPct": 14,
    "vehicleFrontImageDirection": "away_from_camera"
  },
  {
    "id": "HIGH_REAR_RIGHT",
    "category": "elevated",
    "vehicleClasses": [
      "car",
      "van",
      "motorhome",
      "truck",
      "motorcycle",
      "trailer"
    ],
    "azimuthDeg": 135,
    "azimuthToleranceDeg": 12,
    "maxAzimuthErrorDeg": 15,
    "elevationProfile": "elevated",
    "sideMustMatch": true,
    "requiredVisibleSurfaces": [
      "rear",
      "right_side",
      "roof"
    ],
    "fullVehicle": true,
    "paddingMinPct": 4,
    "paddingMaxPct": 14,
    "vehicleFrontImageDirection": "away_from_camera"
  },
  {
    "id": "INT_DRIVER_POV",
    "category": "interior",
    "vehicleClasses": [
      "car",
      "van",
      "motorhome",
      "truck"
    ],
    "azimuthDeg": null,
    "azimuthToleranceDeg": null,
    "maxAzimuthErrorDeg": null,
    "elevationProfile": "interior",
    "sideMustMatch": true,
    "requiredVisibleSurfaces": [
      "steering_wheel",
      "dashboard",
      "instrument_cluster"
    ],
    "fullVehicle": false,
    "paddingMinPct": 0,
    "paddingMaxPct": 10,
    "vehicleFrontImageDirection": "not_applicable"
  },
  {
    "id": "INT_DASH_CENTER",
    "category": "interior",
    "vehicleClasses": [
      "car",
      "van",
      "motorhome",
      "truck"
    ],
    "azimuthDeg": null,
    "azimuthToleranceDeg": null,
    "maxAzimuthErrorDeg": null,
    "elevationProfile": "interior",
    "sideMustMatch": false,
    "requiredVisibleSurfaces": [
      "dashboard",
      "infotainment",
      "center_console"
    ],
    "fullVehicle": false,
    "paddingMinPct": 0,
    "paddingMaxPct": 10,
    "vehicleFrontImageDirection": "not_applicable"
  },
  {
    "id": "INT_WIDE_CABIN",
    "category": "interior",
    "vehicleClasses": [
      "car",
      "van",
      "motorhome",
      "truck"
    ],
    "azimuthDeg": null,
    "azimuthToleranceDeg": null,
    "maxAzimuthErrorDeg": null,
    "elevationProfile": "interior",
    "sideMustMatch": false,
    "requiredVisibleSurfaces": [
      "dashboard",
      "front_seats",
      "center_console"
    ],
    "fullVehicle": false,
    "paddingMinPct": 0,
    "paddingMaxPct": 10,
    "vehicleFrontImageDirection": "not_applicable"
  },
  {
    "id": "INT_PASSENGER_DASH",
    "category": "interior",
    "vehicleClasses": [
      "car",
      "van",
      "motorhome",
      "truck"
    ],
    "azimuthDeg": null,
    "azimuthToleranceDeg": null,
    "maxAzimuthErrorDeg": null,
    "elevationProfile": "interior",
    "sideMustMatch": true,
    "requiredVisibleSurfaces": [
      "dashboard"
    ],
    "fullVehicle": false,
    "paddingMinPct": 0,
    "paddingMaxPct": 10,
    "vehicleFrontImageDirection": "not_applicable"
  },
  {
    "id": "INT_FRONT_SEATS",
    "category": "interior",
    "vehicleClasses": [
      "car",
      "van",
      "motorhome",
      "truck"
    ],
    "azimuthDeg": null,
    "azimuthToleranceDeg": null,
    "maxAzimuthErrorDeg": null,
    "elevationProfile": "interior",
    "sideMustMatch": false,
    "requiredVisibleSurfaces": [
      "front_seats"
    ],
    "fullVehicle": false,
    "paddingMinPct": 0,
    "paddingMaxPct": 10,
    "vehicleFrontImageDirection": "not_applicable"
  },
  {
    "id": "INT_REAR_FROM_FRONT",
    "category": "interior",
    "vehicleClasses": [
      "car",
      "van",
      "motorhome",
      "truck"
    ],
    "azimuthDeg": null,
    "azimuthToleranceDeg": null,
    "maxAzimuthErrorDeg": null,
    "elevationProfile": "interior",
    "sideMustMatch": false,
    "requiredVisibleSurfaces": [
      "rear_seats"
    ],
    "fullVehicle": false,
    "paddingMinPct": 0,
    "paddingMaxPct": 10,
    "vehicleFrontImageDirection": "not_applicable"
  },
  {
    "id": "INT_REAR_LEFT_DOOR",
    "category": "interior",
    "vehicleClasses": [
      "car",
      "van",
      "motorhome"
    ],
    "azimuthDeg": null,
    "azimuthToleranceDeg": null,
    "maxAzimuthErrorDeg": null,
    "elevationProfile": "interior",
    "sideMustMatch": true,
    "requiredVisibleSurfaces": [
      "rear_seats",
      "door_panel_left"
    ],
    "fullVehicle": false,
    "paddingMinPct": 0,
    "paddingMaxPct": 10,
    "vehicleFrontImageDirection": "not_applicable"
  },
  {
    "id": "INT_REAR_RIGHT_DOOR",
    "category": "interior",
    "vehicleClasses": [
      "car",
      "van",
      "motorhome"
    ],
    "azimuthDeg": null,
    "azimuthToleranceDeg": null,
    "maxAzimuthErrorDeg": null,
    "elevationProfile": "interior",
    "sideMustMatch": true,
    "requiredVisibleSurfaces": [
      "rear_seats",
      "door_panel_right"
    ],
    "fullVehicle": false,
    "paddingMinPct": 0,
    "paddingMaxPct": 10,
    "vehicleFrontImageDirection": "not_applicable"
  },
  {
    "id": "INT_CARGO",
    "category": "interior",
    "vehicleClasses": [
      "car",
      "van",
      "motorhome",
      "truck",
      "trailer"
    ],
    "azimuthDeg": null,
    "azimuthToleranceDeg": null,
    "maxAzimuthErrorDeg": null,
    "elevationProfile": "interior",
    "sideMustMatch": false,
    "requiredVisibleSurfaces": [
      "cargo_area"
    ],
    "fullVehicle": false,
    "paddingMinPct": 0,
    "paddingMaxPct": 10,
    "vehicleFrontImageDirection": "not_applicable"
  },
  {
    "id": "INT_CARGO_34",
    "category": "interior",
    "vehicleClasses": [
      "car",
      "van",
      "motorhome",
      "truck",
      "trailer"
    ],
    "azimuthDeg": null,
    "azimuthToleranceDeg": null,
    "maxAzimuthErrorDeg": null,
    "elevationProfile": "interior",
    "sideMustMatch": false,
    "requiredVisibleSurfaces": [
      "cargo_area"
    ],
    "fullVehicle": false,
    "paddingMinPct": 0,
    "paddingMaxPct": 10,
    "vehicleFrontImageDirection": "not_applicable"
  },
  {
    "id": "INT_CENTER_CONSOLE",
    "category": "interior",
    "vehicleClasses": [
      "car",
      "van",
      "motorhome",
      "truck"
    ],
    "azimuthDeg": null,
    "azimuthToleranceDeg": null,
    "maxAzimuthErrorDeg": null,
    "elevationProfile": "interior",
    "sideMustMatch": false,
    "requiredVisibleSurfaces": [
      "center_console"
    ],
    "fullVehicle": false,
    "paddingMinPct": 0,
    "paddingMaxPct": 10,
    "vehicleFrontImageDirection": "not_applicable"
  },
  {
    "id": "INT_ROOF",
    "category": "interior",
    "vehicleClasses": [
      "car",
      "van",
      "motorhome",
      "truck"
    ],
    "azimuthDeg": null,
    "azimuthToleranceDeg": null,
    "maxAzimuthErrorDeg": null,
    "elevationProfile": "interior",
    "sideMustMatch": false,
    "requiredVisibleSurfaces": [
      "headliner"
    ],
    "fullVehicle": false,
    "paddingMinPct": 0,
    "paddingMaxPct": 10,
    "vehicleFrontImageDirection": "not_applicable"
  },
  {
    "id": "DET_HEADLIGHT_LEFT",
    "category": "detail",
    "vehicleClasses": [
      "car",
      "van",
      "motorhome",
      "truck"
    ],
    "azimuthDeg": null,
    "azimuthToleranceDeg": null,
    "maxAzimuthErrorDeg": null,
    "elevationProfile": "close_detail",
    "sideMustMatch": true,
    "requiredVisibleSurfaces": [
      "headlight_left"
    ],
    "fullVehicle": false,
    "paddingMinPct": 2,
    "paddingMaxPct": 15,
    "vehicleFrontImageDirection": "not_applicable"
  },
  {
    "id": "DET_HEADLIGHT_RIGHT",
    "category": "detail",
    "vehicleClasses": [
      "car",
      "van",
      "motorhome",
      "truck"
    ],
    "azimuthDeg": null,
    "azimuthToleranceDeg": null,
    "maxAzimuthErrorDeg": null,
    "elevationProfile": "close_detail",
    "sideMustMatch": true,
    "requiredVisibleSurfaces": [
      "headlight_right"
    ],
    "fullVehicle": false,
    "paddingMinPct": 2,
    "paddingMaxPct": 15,
    "vehicleFrontImageDirection": "not_applicable"
  },
  {
    "id": "DET_TAILLIGHT_LEFT",
    "category": "detail",
    "vehicleClasses": [
      "car",
      "van",
      "motorhome",
      "truck",
      "trailer"
    ],
    "azimuthDeg": null,
    "azimuthToleranceDeg": null,
    "maxAzimuthErrorDeg": null,
    "elevationProfile": "close_detail",
    "sideMustMatch": true,
    "requiredVisibleSurfaces": [
      "taillight_left"
    ],
    "fullVehicle": false,
    "paddingMinPct": 2,
    "paddingMaxPct": 15,
    "vehicleFrontImageDirection": "not_applicable"
  },
  {
    "id": "DET_TAILLIGHT_RIGHT",
    "category": "detail",
    "vehicleClasses": [
      "car",
      "van",
      "motorhome",
      "truck",
      "trailer"
    ],
    "azimuthDeg": null,
    "azimuthToleranceDeg": null,
    "maxAzimuthErrorDeg": null,
    "elevationProfile": "close_detail",
    "sideMustMatch": true,
    "requiredVisibleSurfaces": [
      "taillight_right"
    ],
    "fullVehicle": false,
    "paddingMinPct": 2,
    "paddingMaxPct": 15,
    "vehicleFrontImageDirection": "not_applicable"
  },
  {
    "id": "DET_GRILLE",
    "category": "detail",
    "vehicleClasses": [
      "car",
      "van",
      "motorhome",
      "truck"
    ],
    "azimuthDeg": null,
    "azimuthToleranceDeg": null,
    "maxAzimuthErrorDeg": null,
    "elevationProfile": "close_detail",
    "sideMustMatch": false,
    "requiredVisibleSurfaces": [
      "grille"
    ],
    "fullVehicle": false,
    "paddingMinPct": 2,
    "paddingMaxPct": 15,
    "vehicleFrontImageDirection": "not_applicable"
  },
  {
    "id": "DET_FRONT_BADGE",
    "category": "detail",
    "vehicleClasses": [
      "car",
      "van",
      "motorhome",
      "truck",
      "motorcycle"
    ],
    "azimuthDeg": null,
    "azimuthToleranceDeg": null,
    "maxAzimuthErrorDeg": null,
    "elevationProfile": "close_detail",
    "sideMustMatch": false,
    "requiredVisibleSurfaces": [
      "front_badge"
    ],
    "fullVehicle": false,
    "paddingMinPct": 2,
    "paddingMaxPct": 15,
    "vehicleFrontImageDirection": "not_applicable"
  },
  {
    "id": "DET_REAR_BADGE",
    "category": "detail",
    "vehicleClasses": [
      "car",
      "van",
      "motorhome",
      "truck",
      "motorcycle"
    ],
    "azimuthDeg": null,
    "azimuthToleranceDeg": null,
    "maxAzimuthErrorDeg": null,
    "elevationProfile": "close_detail",
    "sideMustMatch": false,
    "requiredVisibleSurfaces": [
      "rear_badge"
    ],
    "fullVehicle": false,
    "paddingMinPct": 2,
    "paddingMaxPct": 15,
    "vehicleFrontImageDirection": "not_applicable"
  },
  {
    "id": "DET_WHEEL_FRONT_LEFT",
    "category": "detail",
    "vehicleClasses": [
      "car",
      "van",
      "motorhome",
      "truck"
    ],
    "azimuthDeg": null,
    "azimuthToleranceDeg": null,
    "maxAzimuthErrorDeg": null,
    "elevationProfile": "close_detail",
    "sideMustMatch": true,
    "requiredVisibleSurfaces": [
      "wheel_front_left"
    ],
    "fullVehicle": false,
    "paddingMinPct": 2,
    "paddingMaxPct": 15,
    "vehicleFrontImageDirection": "not_applicable"
  },
  {
    "id": "DET_WHEEL_FRONT_RIGHT",
    "category": "detail",
    "vehicleClasses": [
      "car",
      "van",
      "motorhome",
      "truck"
    ],
    "azimuthDeg": null,
    "azimuthToleranceDeg": null,
    "maxAzimuthErrorDeg": null,
    "elevationProfile": "close_detail",
    "sideMustMatch": true,
    "requiredVisibleSurfaces": [
      "wheel_front_right"
    ],
    "fullVehicle": false,
    "paddingMinPct": 2,
    "paddingMaxPct": 15,
    "vehicleFrontImageDirection": "not_applicable"
  },
  {
    "id": "DET_WHEEL_REAR_LEFT",
    "category": "detail",
    "vehicleClasses": [
      "car",
      "van",
      "motorhome",
      "truck",
      "trailer"
    ],
    "azimuthDeg": null,
    "azimuthToleranceDeg": null,
    "maxAzimuthErrorDeg": null,
    "elevationProfile": "close_detail",
    "sideMustMatch": true,
    "requiredVisibleSurfaces": [
      "wheel_rear_left"
    ],
    "fullVehicle": false,
    "paddingMinPct": 2,
    "paddingMaxPct": 15,
    "vehicleFrontImageDirection": "not_applicable"
  },
  {
    "id": "DET_WHEEL_REAR_RIGHT",
    "category": "detail",
    "vehicleClasses": [
      "car",
      "van",
      "motorhome",
      "truck",
      "trailer"
    ],
    "azimuthDeg": null,
    "azimuthToleranceDeg": null,
    "maxAzimuthErrorDeg": null,
    "elevationProfile": "close_detail",
    "sideMustMatch": true,
    "requiredVisibleSurfaces": [
      "wheel_rear_right"
    ],
    "fullVehicle": false,
    "paddingMinPct": 2,
    "paddingMaxPct": 15,
    "vehicleFrontImageDirection": "not_applicable"
  },
  {
    "id": "DET_STEERING_WHEEL",
    "category": "detail",
    "vehicleClasses": [
      "car",
      "van",
      "motorhome",
      "truck"
    ],
    "azimuthDeg": null,
    "azimuthToleranceDeg": null,
    "maxAzimuthErrorDeg": null,
    "elevationProfile": "close_detail",
    "sideMustMatch": true,
    "requiredVisibleSurfaces": [
      "steering_wheel"
    ],
    "fullVehicle": false,
    "paddingMinPct": 2,
    "paddingMaxPct": 15,
    "vehicleFrontImageDirection": "not_applicable"
  },
  {
    "id": "DET_CLUSTER",
    "category": "detail",
    "vehicleClasses": [
      "car",
      "van",
      "motorhome",
      "truck"
    ],
    "azimuthDeg": null,
    "azimuthToleranceDeg": null,
    "maxAzimuthErrorDeg": null,
    "elevationProfile": "close_detail",
    "sideMustMatch": false,
    "requiredVisibleSurfaces": [
      "instrument_cluster"
    ],
    "fullVehicle": false,
    "paddingMinPct": 2,
    "paddingMaxPct": 15,
    "vehicleFrontImageDirection": "not_applicable"
  },
  {
    "id": "DET_INFOTAINMENT",
    "category": "detail",
    "vehicleClasses": [
      "car",
      "van",
      "motorhome",
      "truck"
    ],
    "azimuthDeg": null,
    "azimuthToleranceDeg": null,
    "maxAzimuthErrorDeg": null,
    "elevationProfile": "close_detail",
    "sideMustMatch": false,
    "requiredVisibleSurfaces": [
      "infotainment"
    ],
    "fullVehicle": false,
    "paddingMinPct": 2,
    "paddingMaxPct": 15,
    "vehicleFrontImageDirection": "not_applicable"
  },
  {
    "id": "DET_CENTER_CONSOLE",
    "category": "detail",
    "vehicleClasses": [
      "car",
      "van",
      "motorhome",
      "truck"
    ],
    "azimuthDeg": null,
    "azimuthToleranceDeg": null,
    "maxAzimuthErrorDeg": null,
    "elevationProfile": "close_detail",
    "sideMustMatch": false,
    "requiredVisibleSurfaces": [
      "center_console"
    ],
    "fullVehicle": false,
    "paddingMinPct": 2,
    "paddingMaxPct": 15,
    "vehicleFrontImageDirection": "not_applicable"
  },
  {
    "id": "DET_DOOR_LEFT",
    "category": "detail",
    "vehicleClasses": [
      "car",
      "van",
      "motorhome",
      "truck"
    ],
    "azimuthDeg": null,
    "azimuthToleranceDeg": null,
    "maxAzimuthErrorDeg": null,
    "elevationProfile": "close_detail",
    "sideMustMatch": true,
    "requiredVisibleSurfaces": [
      "door_left"
    ],
    "fullVehicle": false,
    "paddingMinPct": 2,
    "paddingMaxPct": 15,
    "vehicleFrontImageDirection": "not_applicable"
  },
  {
    "id": "DET_DOOR_RIGHT",
    "category": "detail",
    "vehicleClasses": [
      "car",
      "van",
      "motorhome",
      "truck"
    ],
    "azimuthDeg": null,
    "azimuthToleranceDeg": null,
    "maxAzimuthErrorDeg": null,
    "elevationProfile": "close_detail",
    "sideMustMatch": true,
    "requiredVisibleSurfaces": [
      "door_right"
    ],
    "fullVehicle": false,
    "paddingMinPct": 2,
    "paddingMaxPct": 15,
    "vehicleFrontImageDirection": "not_applicable"
  },
  {
    "id": "DET_CHARGE_PORT",
    "category": "detail",
    "vehicleClasses": [
      "car",
      "van",
      "motorhome",
      "truck"
    ],
    "azimuthDeg": null,
    "azimuthToleranceDeg": null,
    "maxAzimuthErrorDeg": null,
    "elevationProfile": "close_detail",
    "sideMustMatch": true,
    "requiredVisibleSurfaces": [
      "charge_port"
    ],
    "fullVehicle": false,
    "paddingMinPct": 2,
    "paddingMaxPct": 15,
    "vehicleFrontImageDirection": "not_applicable"
  },
  {
    "id": "DET_FUEL_FLAP",
    "category": "detail",
    "vehicleClasses": [
      "car",
      "van",
      "motorhome",
      "truck"
    ],
    "azimuthDeg": null,
    "azimuthToleranceDeg": null,
    "maxAzimuthErrorDeg": null,
    "elevationProfile": "close_detail",
    "sideMustMatch": true,
    "requiredVisibleSurfaces": [
      "fuel_flap"
    ],
    "fullVehicle": false,
    "paddingMinPct": 2,
    "paddingMaxPct": 15,
    "vehicleFrontImageDirection": "not_applicable"
  },
  {
    "id": "DET_ROOF",
    "category": "detail",
    "vehicleClasses": [
      "car",
      "van",
      "motorhome",
      "truck"
    ],
    "azimuthDeg": null,
    "azimuthToleranceDeg": null,
    "maxAzimuthErrorDeg": null,
    "elevationProfile": "close_detail",
    "sideMustMatch": false,
    "requiredVisibleSurfaces": [
      "roof"
    ],
    "fullVehicle": false,
    "paddingMinPct": 2,
    "paddingMaxPct": 15,
    "vehicleFrontImageDirection": "not_applicable"
  }
] as const;

const BY_ID = new Map<string, ReferenceV2MasterEntry>(
  REFERENCE_V2_PERSPECTIVE_MASTER.map((e) => [e.id, e]),
);

export function getReferenceV2MasterEntry(
  id: string,
): ReferenceV2MasterEntry | undefined {
  return BY_ID.get(id);
}

/** Compact, purely visual definition list handed to the vision model. */
export function referenceV2PerspectiveDefinitionLines(): string {
  return REFERENCE_V2_PERSPECTIVE_MASTER.map((e) => {
    const az =
      e.azimuthDeg === null
        ? "azimuth: n/a"
        : `azimuth ${e.azimuthDeg}° ±${e.azimuthToleranceDeg ?? 0}° (max err ${e.maxAzimuthErrorDeg ?? 0}°)`;
    return [
      e.id,
      `category ${e.category}`,
      az,
      `elevation ${e.elevationProfile}`,
      `sideMustMatch ${e.sideMustMatch}`,
      `framing ${e.fullVehicle ? "full vehicle" : "partial/detail"} padding ${e.paddingMinPct}-${e.paddingMaxPct}%`,
      `required surfaces: ${e.requiredVisibleSurfaces.join("/")}`,
      `classes: ${e.vehicleClasses.join("/")}`,
      e.vehicleFrontImageDirection
        ? `front points ${e.vehicleFrontImageDirection} in image`
        : null,
    ]
      .filter(Boolean)
      .join(" | ");
  }).join("\n");
}
