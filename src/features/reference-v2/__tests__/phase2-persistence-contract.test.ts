import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  REFERENCE_V2_PERSISTENCE_SCHEMA_VERSION,
  REFERENCE_V2_STORAGE_BUCKET,
  ReferenceV2PersistenceError,
  assertPersistableReferenceV2Payload,
  buildReferenceV2OriginalStoragePath,
  parseReferenceV2AssetPersistence,
  parseReferenceV2FramingEvidencePersistence,
  parseReferenceV2WorkspacePersistence,
} from "../phase2/persistence-contract";
import { CURRENT_FRAMING_EVIDENCE_SCHEMA_VERSION } from "../phase2/framing-evidence";
import {
  ASSET_PROTECTION_STATES,
  REFERENCE_ROLES,
} from "../phase1/vehicle-master";

const USER_ID = "11111111-1111-4111-8111-111111111111";
const VEHICLE_ID = "22222222-2222-4222-8222-222222222222";
const WORKSPACE_ID = "33333333-3333-4333-8333-333333333333";
const ROW_ID = "44444444-4444-4444-8444-444444444444";
const NOW_ISO = "2026-09-01T11:00:00.000Z";
const SHA = "a".repeat(64);
const ASSET_KEY = "ref_abc123";
const PERSPECTIVE = "EXT_34_FRONT_LEFT";
const STORAGE_PATH = `${USER_ID}/${VEHICLE_ID}/reference-v2/${WORKSPACE_ID}/${ASSET_KEY}/original.jpg`;

function workspace(overrides: Record<string, unknown> = {}) {
  return {
    schemaVersion: REFERENCE_V2_PERSISTENCE_SCHEMA_VERSION,
    workspaceId: WORKSPACE_ID,
    userId: USER_ID,
    vehicleId: VEHICLE_ID,
    masterKey: "vm_local_1",
    label: "Interner Referenzsatz A",
    vehicleClass: "car",
    colorFamily: "silver",
    identityClusterId: "cluster_a",
    masterVersion: 1,
    masterHistory: [{ version: 1, atIso: NOW_ISO, action: "created" }],
    createdAtIso: NOW_ISO,
    updatedAtIso: NOW_ISO,
    ...overrides,
  };
}

function intake(overrides: Record<string, unknown> = {}) {
  return {
    schemaVersion: 1,
    assetId: "provider_transient_9",
    vehicleDetected: true,
    vehicleClass: "car",
    identityClusterId: "cluster_a",
    sameVehicleConfidence: 0.95,
    pose: { canonicalPerspectiveId: PERSPECTIVE, azimuthDeg: 45 },
    visibility: { front: 0.9, rear: 0.1, leftSide: 0.8, rightSide: 0.1, roof: 0.3 },
    framing: {
      fullVehicleVisible: true,
      cropped: false,
      visibleWheelPositions: ["front_left", "front_right"],
    },
    quality: {
      sharpness: 0.9,
      occlusion: 0.05,
      glare: 0.05,
      resolutionAdequacy: 0.9,
      usableScore: 0.9,
    },
    classificationConfidence: 0.95,
    issues: [],
    ...overrides,
  };
}

function asset(overrides: Record<string, unknown> = {}) {
  return {
    schemaVersion: REFERENCE_V2_PERSISTENCE_SCHEMA_VERSION,
    rowId: ROW_ID,
    workspaceId: WORKSPACE_ID,
    userId: USER_ID,
    assetKey: ASSET_KEY,
    requestedPerspectiveId: PERSPECTIVE,
    canonicalPerspectiveId: PERSPECTIVE,
    fileName: "IMG_0001.jpg",
    storageBucket: REFERENCE_V2_STORAGE_BUCKET,
    storagePath: STORAGE_PATH,
    mimeType: "image/jpeg",
    sizeBytes: 2_400_000,
    sha256: SHA,
    createdAtIso: NOW_ISO,
    updatedAtIso: NOW_ISO,
    intake: intake(),
    scores: {
      cameraAngle: 95,
      sideAndSurfaceCorrectness: 92,
      requiredSurfaceCoverage: 90,
      quality: 90,
      framing: 88,
    },
    weightedScore: 92,
    hardFailures: [],
    blockers: [],
    warnings: [],
    role: "primary",
    protection: "protected",
    assetVersion: 1,
    history: [{ version: 1, atIso: NOW_ISO, action: "created" }],
    ...overrides,
  };
}

function framing(overrides: Record<string, unknown> = {}) {
  return {
    schemaVersion: CURRENT_FRAMING_EVIDENCE_SCHEMA_VERSION,
    workspaceId: WORKSPACE_ID,
    userId: USER_ID,
    assetKey: ASSET_KEY,
    sourceAspectRatio: 1.5,
    fullVehicleVisible: true,
    cropped: false,
    paddingPct: 8,
    updatedAtIso: NOW_ISO,
    ...overrides,
  };
}

// --------------------------------------------------------------------------
// A. Happy paths
// --------------------------------------------------------------------------

describe("A. valid durable records", () => {
  it("parses a workspace", () => {
    const parsed = parseReferenceV2WorkspacePersistence(workspace());
    expect(parsed.vehicleId).toBe(VEHICLE_ID);
    expect(parsed.schemaVersion).toBe(1);
  });

  it("parses an asset", () => {
    const parsed = parseReferenceV2AssetPersistence(asset());
    expect(parsed.storageBucket).toBe("originals");
    expect(parsed.sha256).toBe(SHA);
  });

  it("parses framing evidence", () => {
    const parsed = parseReferenceV2FramingEvidencePersistence(framing());
    expect(parsed.paddingPct).toBe(8);
    expect(parsed.schemaVersion).toBe(CURRENT_FRAMING_EVIDENCE_SCHEMA_VERSION);
  });

  it("accepts a null color family", () => {
    expect(
      parseReferenceV2WorkspacePersistence(workspace({ colorFamily: null }))
        .colorFamily,
    ).toBeNull();
  });
});

// --------------------------------------------------------------------------
// B. Semantic firewall
// --------------------------------------------------------------------------

describe("B. semantic / business metadata firewall", () => {
  it.each(["vin", "brand", "model", "year", "variant", "title"])(
    "rejects workspace with injected %s key",
    (key) => {
      expect(() =>
        parseReferenceV2WorkspacePersistence(workspace({ [key]: "x1" })),
      ).toThrow(ReferenceV2PersistenceError);
    },
  );

  it("rejects nested semantic identity keys", () => {
    expect(() =>
      parseReferenceV2AssetPersistence(
        asset({
          history: [
            { version: 1, atIso: NOW_ISO, action: "created", detail: "ok" },
          ],
          intake: intake({ manualOverride: { reason: "brand mismatch" } }),
        }),
      ),
    ).toThrow(ReferenceV2PersistenceError);
  });

  it("rejects nested semantic identity string content", () => {
    expect(() =>
      parseReferenceV2WorkspacePersistence(
        workspace({
          masterHistory: [
            {
              version: 1,
              atIso: NOW_ISO,
              action: "created",
              detail: "Modell erfasst",
            },
          ],
        }),
      ),
    ).toThrow(ReferenceV2PersistenceError);
  });

  it("keeps neutral vehicle* keys allowed", () => {
    expect(() =>
      assertPersistableReferenceV2Payload({
        vehicleId: VEHICLE_ID,
        vehicleClass: "car",
        vehicleMasterKey: "vm_1",
      }),
    ).not.toThrow();
  });

  it("rejects a VIN-shaped string anywhere", () => {
    expect(() =>
      assertPersistableReferenceV2Payload({ note: "WVWZZZ1KZAW123456" }),
    ).toThrow(ReferenceV2PersistenceError);
  });
});

// --------------------------------------------------------------------------
// C. Inline transport firewall
// --------------------------------------------------------------------------

describe("C. inline image transport firewall", () => {
  it.each([
    "data:image/jpeg;base64,AAAA",
    "blob:http://localhost/abc",
    "https://example.com/img.jpg",
    "/absolute/path.jpg",
    "../escape/original.jpg",
  ])("rejects storagePath %s", (p) => {
    expect(() =>
      parseReferenceV2AssetPersistence(asset({ storagePath: p })),
    ).toThrow(ReferenceV2PersistenceError);
  });

  it("rejects base64-like payload in a durable string", () => {
    expect(() =>
      parseReferenceV2AssetPersistence(
        asset({ warnings: [`AAAA${"Qk".repeat(160)}`] }),
      ),
    ).toThrow(ReferenceV2PersistenceError);
  });

  it("rejects previewUrl / outputReadyFormats as unknown keys", () => {
    expect(() =>
      parseReferenceV2AssetPersistence(asset({ previewUrl: "x" })),
    ).toThrow(ReferenceV2PersistenceError);
    expect(() =>
      parseReferenceV2AssetPersistence(asset({ outputReadyFormats: [] })),
    ).toThrow(ReferenceV2PersistenceError);
  });
});

// --------------------------------------------------------------------------
// D. Durable file descriptor
// --------------------------------------------------------------------------

describe("D. durable file descriptor", () => {
  it("requires a lowercase 64-hex sha256", () => {
    expect(() => parseReferenceV2AssetPersistence(asset({ sha256: undefined }))).toThrow();
    expect(() => parseReferenceV2AssetPersistence(asset({ sha256: "A".repeat(64) }))).toThrow();
    expect(() => parseReferenceV2AssetPersistence(asset({ sha256: "abc" }))).toThrow();
  });

  it.each(["image/jpeg", "image/png", "image/webp"])(
    "accepts allowed mime %s",
    (mimeType) => {
      expect(parseReferenceV2AssetPersistence(asset({ mimeType })).mimeType).toBe(
        mimeType,
      );
    },
  );

  it("rejects other mime types and other buckets", () => {
    expect(() =>
      parseReferenceV2AssetPersistence(asset({ mimeType: "image/gif" })),
    ).toThrow();
    expect(() =>
      parseReferenceV2AssetPersistence(asset({ storageBucket: "vehicle-images" })),
    ).toThrow();
  });

  it("rejects non-positive size", () => {
    expect(() => parseReferenceV2AssetPersistence(asset({ sizeBytes: 0 }))).toThrow();
  });
});

// --------------------------------------------------------------------------
// E. Self-validation
// --------------------------------------------------------------------------

describe("E. asset self-validation", () => {
  it("allows a transient provider intake.assetId different from assetKey", () => {
    const parsed = parseReferenceV2AssetPersistence(asset());
    expect(parsed.intake.assetId).not.toBe(parsed.assetKey);
  });

  it("rejects a canonical perspective mismatch vs intake", () => {
    expect(() =>
      parseReferenceV2AssetPersistence(
        asset({ canonicalPerspectiveId: "EXT_SIDE_RIGHT" }),
      ),
    ).toThrow(/canonicalPerspectiveId/);
  });

  it("rejects a missing canonical perspective in intake", () => {
    expect(() =>
      parseReferenceV2AssetPersistence(
        asset({ intake: intake({ pose: { azimuthDeg: 45 } }) }),
      ),
    ).toThrow(ReferenceV2PersistenceError);
  });

  it("allows a differing requestedPerspectiveId (history only)", () => {
    expect(
      parseReferenceV2AssetPersistence(
        asset({ requestedPerspectiveId: "EXT_FRONT" }),
      ).requestedPerspectiveId,
    ).toBe("EXT_FRONT");
  });

  it("rejects blocked assets that are not rejected", () => {
    expect(() =>
      parseReferenceV2AssetPersistence(
        asset({ blockers: ["CROP_VIOLATION"], role: "primary" }),
      ),
    ).toThrow(/rejected/);
    expect(() =>
      parseReferenceV2AssetPersistence(
        asset({ hardFailures: ["MIRRORED_REFERENCE"], role: "secondary_support" }),
      ),
    ).toThrow(/rejected/);
  });

  it("accepts blocked assets with role rejected", () => {
    expect(
      parseReferenceV2AssetPersistence(
        asset({ blockers: ["CROP_VIOLATION"], role: "rejected" }),
      ).role,
    ).toBe("rejected");
  });
});

// --------------------------------------------------------------------------
// F. Framing evidence
// --------------------------------------------------------------------------

describe("F. framing evidence persistence", () => {
  it.each([-1, 101])("rejects paddingPct %s", (paddingPct) => {
    expect(() =>
      parseReferenceV2FramingEvidencePersistence(framing({ paddingPct })),
    ).toThrow(ReferenceV2PersistenceError);
  });

  it.each([0, -2, Number.POSITIVE_INFINITY, Number.NaN])(
    "rejects sourceAspectRatio %s",
    (sourceAspectRatio) => {
      expect(() =>
        parseReferenceV2FramingEvidencePersistence(framing({ sourceAspectRatio })),
      ).toThrow(ReferenceV2PersistenceError);
    },
  );

  it("rejects legacy outputReadyFormats", () => {
    expect(() =>
      parseReferenceV2FramingEvidencePersistence(framing({ outputReadyFormats: [] })),
    ).toThrow(ReferenceV2PersistenceError);
  });

  it("rejects invalid ISO timestamps", () => {
    expect(() =>
      parseReferenceV2FramingEvidencePersistence(framing({ updatedAtIso: "gestern" })),
    ).toThrow(ReferenceV2PersistenceError);
  });
});

// --------------------------------------------------------------------------
// G. Storage path helper
// --------------------------------------------------------------------------

describe("G. buildReferenceV2OriginalStoragePath", () => {
  const base = {
    userId: USER_ID,
    vehicleId: VEHICLE_ID,
    workspaceId: WORKSPACE_ID,
    assetKey: ASSET_KEY,
    extension: "jpg",
  };

  it("returns the exact deterministic path", () => {
    expect(buildReferenceV2OriginalStoragePath(base)).toBe(STORAGE_PATH);
  });

  it("is stable across calls (no timestamps / randomness)", () => {
    const a = buildReferenceV2OriginalStoragePath(base);
    const b = buildReferenceV2OriginalStoragePath(base);
    expect(a).toBe(b);
    expect(a).not.toMatch(/\d{13}/);
  });

  it("starts with the owner folder (matches originals RLS)", () => {
    expect(buildReferenceV2OriginalStoragePath(base).startsWith(`${USER_ID}/`)).toBe(
      true,
    );
  });

  it("lower-cases the extension", () => {
    expect(
      buildReferenceV2OriginalStoragePath({ ...base, extension: "PNG" }),
    ).toMatch(/original\.png$/);
  });

  it.each(["jpeg", "gif", "svg", "", "jpg.exe"])(
    "rejects extension %s",
    (extension) => {
      expect(() =>
        buildReferenceV2OriginalStoragePath({ ...base, extension }),
      ).toThrow(ReferenceV2PersistenceError);
    },
  );

  it.each(["a/b", "a\\b", "..", "ref_..x", "ref_\u0000x", " ref_x"])(
    "rejects unsafe assetKey %s",
    (assetKey) => {
      expect(() =>
        buildReferenceV2OriginalStoragePath({ ...base, assetKey }),
      ).toThrow(ReferenceV2PersistenceError);
    },
  );

  it.each(["userId", "vehicleId", "workspaceId"] as const)(
    "rejects non-UUID %s",
    (field) => {
      expect(() =>
        buildReferenceV2OriginalStoragePath({ ...base, [field]: "not-a-uuid" }),
      ).toThrow(ReferenceV2PersistenceError);
    },
  );
});

// --------------------------------------------------------------------------
// H. Source guard
// --------------------------------------------------------------------------

const CONTRACT_SRC = readFileSync(
  path.join(__dirname, "../phase2/persistence-contract.ts"),
  "utf8",
);

describe("H. contract source guard", () => {
  it("does not import legacy generation / remaster / job modules", () => {
    expect(CONTRACT_SRC).not.toMatch(/from\s+["'][^"']*remaster/i);
    expect(CONTRACT_SRC).not.toMatch(/from\s+["'][^"']*one-?shot/i);
    expect(CONTRACT_SRC).not.toMatch(/image_generation_jobs/);
    expect(CONTRACT_SRC).not.toMatch(/from\s+["'][^"']*spin360/i);
  });

  it("contains no prompt logic", () => {
    expect(CONTRACT_SRC).not.toMatch(/PromptAssembler|buildPrompt|promptText/);
  });

  it("does not persist previewUrl or outputReadyFormats", () => {
    expect(CONTRACT_SRC).not.toMatch(/previewUrl:/);
    expect(CONTRACT_SRC).not.toMatch(/outputReadyFormats:/);
  });
});

// --------------------------------------------------------------------------
// I. Migration guard
// --------------------------------------------------------------------------

const MIGRATIONS_DIR = path.join(__dirname, "../../../../supabase/migrations");
const MIGRATION_SQL = readdirSync(MIGRATIONS_DIR)
  .filter((f) => f.endsWith(".sql"))
  .map((f) => readFileSync(path.join(MIGRATIONS_DIR, f), "utf8"))
  .filter((sql) => /reference_v2_workspaces/i.test(sql))
  .join("\n");

describe("I. reference_v2 migration", () => {
  it("creates exactly the three isolated tables", () => {
    const creates =
      MIGRATION_SQL.match(/create\s+table\s+public\.reference_v2_\w+/gi) ?? [];
    expect(creates).toHaveLength(3);
    expect(MIGRATION_SQL).toMatch(/create table public\.reference_v2_workspaces/i);
    expect(MIGRATION_SQL).toMatch(/create table public\.reference_v2_assets/i);
    expect(MIGRATION_SQL).toMatch(
      /create table public\.reference_v2_framing_evidence/i,
    );
  });

  it("anchors workspaces to public.vehicles with one workspace per vehicle", () => {
    expect(MIGRATION_SQL).toMatch(
      /references\s+public\.vehicles\s*\(\s*id\s*\)\s+on delete cascade/i,
    );
    expect(MIGRATION_SQL).toMatch(/unique\s*\(\s*vehicle_id\s*\)/i);
  });

  it("enables RLS on all three tables", () => {
    for (const t of [
      "reference_v2_workspaces",
      "reference_v2_assets",
      "reference_v2_framing_evidence",
    ]) {
      expect(MIGRATION_SQL).toMatch(
        new RegExp(`alter table public\\.${t} enable row level security`, "i"),
      );
    }
  });

  it("defines owner and admin policies only", () => {
    expect(MIGRATION_SQL).toMatch(/auth\.uid\(\)\s*=\s*user_id/i);
    expect(MIGRATION_SQL).toMatch(/has_role\(auth\.uid\(\),\s*'admin'::app_role\)/i);
    expect(MIGRATION_SQL).not.toMatch(/to\s+anon/i);
    expect(MIGRATION_SQL).not.toMatch(/grant[^;]*to\s+(anon|public)\b/i);
  });

  it("derives user_id via triggers and freezes anchors", () => {
    expect(MIGRATION_SQL).toMatch(/security definer/i);
    expect(MIGRATION_SQL).toMatch(/set search_path = public/i);
    expect(MIGRATION_SQL).toMatch(/NEW\.user_id\s*:=\s*_owner/);
    expect(MIGRATION_SQL).toMatch(/vehicle_id is immutable/i);
    expect(MIGRATION_SQL).toMatch(/workspace_id is immutable/i);
    expect(MIGRATION_SQL).toMatch(/asset_key is immutable/i);
    expect(MIGRATION_SQL).toMatch(/storage_path is immutable/i);
  });

  it("does not alter existing tables or create storage buckets/policies", () => {
    const alters = MIGRATION_SQL.match(/alter table\s+(?:public\.)?(\w+)/gi) ?? [];
    for (const a of alters) {
      expect(a.toLowerCase()).toMatch(/reference_v2_/);
    }
    expect(MIGRATION_SQL).not.toMatch(/storage\.buckets/i);
    expect(MIGRATION_SQL).not.toMatch(/storage\.objects/i);
  });

  it("has no business metadata columns", () => {
    expect(MIGRATION_SQL).not.toMatch(/^\s*(vin|brand|make|model|year|variant|trim)\s/im);
  });
});

// --------------------------------------------------------------------------
// J. Protection integrity hardening migration guard
// --------------------------------------------------------------------------

const HARDENING_SQL = readdirSync(MIGRATIONS_DIR)
  .filter((f) => f.endsWith(".sql"))
  .map((f) => readFileSync(path.join(MIGRATIONS_DIR, f), "utf8"))
  .filter((sql) => /reference_v2_protection_integrity_hardening/i.test(sql))
  .join("\n");

function sqlLiteralList(values: readonly string[]): string[] {
  return values.map((v) => `'${v}'`);
}

describe("J. protection integrity hardening", () => {
  it("ships exactly one labelled hardening migration", () => {
    expect(HARDENING_SQL).not.toBe("");
    expect(
      HARDENING_SQL.match(/reference_v2_protection_integrity_hardening/gi) ?? [],
    ).toHaveLength(1);
  });

  it("blocks DELETE of protected assets via a BEFORE DELETE trigger", () => {
    expect(HARDENING_SQL).toMatch(
      /OLD\.protection\s*=\s*'protected'/i,
    );
    expect(HARDENING_SQL).toMatch(/RAISE EXCEPTION/i);
    expect(HARDENING_SQL).toMatch(
      /BEFORE DELETE ON public\.reference_v2_assets/i,
    );
    expect(HARDENING_SQL).toMatch(
      /EXECUTE FUNCTION public\.reference_v2_assets_block_protected_delete\(\)/i,
    );
    expect(HARDENING_SQL).toMatch(/RETURN OLD;/i);
  });

  it("keeps the guard function SECURITY DEFINER with locked search_path and no direct EXECUTE", () => {
    expect(HARDENING_SQL).toMatch(/SECURITY DEFINER/i);
    expect(HARDENING_SQL).toMatch(/SET search_path = public/i);
    for (const grantee of ["PUBLIC", "anon", "authenticated"]) {
      expect(HARDENING_SQL).toMatch(
        new RegExp(
          `REVOKE ALL ON FUNCTION public\\.reference_v2_assets_block_protected_delete\\(\\) FROM ${grantee}`,
          "i",
        ),
      );
    }
    expect(HARDENING_SQL).not.toMatch(/GRANT[^;]*block_protected_delete/i);
  });

  it("constrains role / protection to the frozen vocabularies", () => {
    for (const literal of sqlLiteralList(REFERENCE_ROLES)) {
      expect(HARDENING_SQL).toContain(literal);
    }
    for (const literal of sqlLiteralList(ASSET_PROTECTION_STATES)) {
      expect(HARDENING_SQL).toContain(literal);
    }
    const roleCheck = HARDENING_SQL.match(
      /reference_v2_assets_role_allowed\s+CHECK\s*\(role IN \(([^)]*)\)\)/i,
    );
    expect(roleCheck).not.toBeNull();
    expect(
      (roleCheck?.[1] ?? "").split(",").map((s) => s.trim()),
    ).toEqual(sqlLiteralList(REFERENCE_ROLES));
    const protectionCheck = HARDENING_SQL.match(
      /reference_v2_assets_protection_allowed\s+CHECK\s*\(protection IN \(([^)]*)\)\)/i,
    );
    expect(protectionCheck).not.toBeNull();
    expect(
      (protectionCheck?.[1] ?? "").split(",").map((s) => s.trim()),
    ).toEqual(sqlLiteralList(ASSET_PROTECTION_STATES));
  });

  it("forces blocked / hard-failed assets into role rejected", () => {
    expect(HARDENING_SQL).toMatch(
      /reference_v2_assets_blocked_must_be_rejected/i,
    );
    expect(HARDENING_SQL).toMatch(/COALESCE\(cardinality\(blockers\), 0\) = 0/i);
    expect(HARDENING_SQL).toMatch(
      /COALESCE\(cardinality\(hard_failures\), 0\) = 0/i,
    );
    expect(HARDENING_SQL).toMatch(/role = 'rejected'/i);
  });

  it("touches only reference_v2 tables, no storage, no data mutation", () => {
    const alters = HARDENING_SQL.match(/ALTER TABLE\s+(?:public\.)?(\w+)/gi) ?? [];
    expect(alters.length).toBeGreaterThan(0);
    for (const a of alters) {
      expect(a.toLowerCase()).toMatch(/reference_v2_(assets|workspaces)/);
    }
    expect(HARDENING_SQL).not.toMatch(/storage\.(buckets|objects)/i);
    expect(HARDENING_SQL).not.toMatch(/\b(INSERT INTO|UPDATE\s+public\.|DELETE FROM)\b/i);
    expect(HARDENING_SQL).not.toMatch(/ADD COLUMN|DROP COLUMN/i);
    expect(HARDENING_SQL).not.toMatch(/\b(vin|brand|model)\b/i);
  });
});
