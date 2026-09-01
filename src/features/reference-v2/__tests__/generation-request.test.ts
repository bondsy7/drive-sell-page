import { describe, it, expect } from "vitest";
import {
  FORBIDDEN_VEHICLE_METADATA_FIELDS,
  StrictReferenceGenerationRequestBaseSchema,
  StrictReferenceGenerationRequestSchema,
  parseStrictReferenceGenerationRequest,
} from "@/features/reference-v2/domain/generation-request";
import { StrictReferenceJobSchema } from "@/features/reference-v2/domain/job-context";

const validRequest = {
  jobId: "job-1",
  outputRequestId: "out-1",
  perspectiveSpecId: "EXT_FRONT",
  perspectiveSpecVersion: 1,
  primaryReferenceAssetId: "asset-1",
} as const;

describe("StrictReferenceGenerationRequest", () => {
  it("parses a valid minimal request with defaults", () => {
    const parsed = parseStrictReferenceGenerationRequest(validRequest);
    expect(parsed.secondaryReferenceAssetIds).toEqual([]);
    expect(parsed.enabledModules).toEqual([]);
    expect(parsed.perspectiveSpecId).toBe("EXT_FRONT");
  });

  it("parses a full request", () => {
    const parsed = parseStrictReferenceGenerationRequest({
      ...validRequest,
      secondaryReferenceAssetIds: ["asset-2", "asset-3"],
      scenePackId: "pack-1",
      scenePlateId: "plate-1",
      logoAssetId: "logo-1",
      enabledModules: ["dirtRemoval", "minorDentRepair"],
      providerTier: "premium",
    });
    expect(parsed.enabledModules).toContain("minorDentRepair");
  });

  it.each(FORBIDDEN_VEHICLE_METADATA_FIELDS)(
    "rejects forbidden vehicle metadata field '%s'",
    (field) => {
      const result = StrictReferenceGenerationRequestSchema.safeParse({
        ...validRequest,
        [field]: "leak",
      });
      expect(result.success).toBe(false);
    },
  );

  it("rejects vehicleId (business context never enters generation requests)", () => {
    const result = StrictReferenceGenerationRequestSchema.safeParse({
      ...validRequest,
      vehicleId: "veh-1",
    });
    expect(result.success).toBe(false);
  });

  it("rejects arbitrary unknown fields (strict schema)", () => {
    const result = StrictReferenceGenerationRequestSchema.safeParse({
      ...validRequest,
      anythingElse: true,
    });
    expect(result.success).toBe(false);
  });

  it("schema shape structurally lacks all forbidden fields", () => {
    const shapeKeys = Object.keys(
      StrictReferenceGenerationRequestBaseSchema.shape,
    );
    for (const field of FORBIDDEN_VEHICLE_METADATA_FIELDS) {
      expect(shapeKeys).not.toContain(field);
    }
  });

  it("rejects TRANSFORMATION modules", () => {
    for (const moduleId of [
      "paintColorChange",
      "wheelReplacement",
      "wrapChange",
      "addPart",
      "removePart",
    ]) {
      const result = StrictReferenceGenerationRequestSchema.safeParse({
        ...validRequest,
        enabledModules: [moduleId],
      });
      expect(result.success, `module ${moduleId} must be rejected`).toBe(false);
    }
  });

  it("allows SAFE_CLEANUP and COSMETIC_REPAIR modules", () => {
    const result = StrictReferenceGenerationRequestSchema.safeParse({
      ...validRequest,
      enabledModules: ["dirtRemoval", "lightScratchRemoval"],
    });
    expect(result.success).toBe(true);
  });

  it("rejects primary reference duplicated in secondaries", () => {
    const result = StrictReferenceGenerationRequestSchema.safeParse({
      ...validRequest,
      secondaryReferenceAssetIds: ["asset-1"],
    });
    expect(result.success).toBe(false);
  });
});

describe("StrictReferenceJob context separation", () => {
  it("allows vehicleId ONLY inside the business ref of the internal job", () => {
    const result = StrictReferenceJobSchema.safeParse({
      jobId: "job-1",
      mode: "strict_reference",
      business: { vehicleId: "veh-1" },
      visual: {
        referenceAssetIds: ["asset-1"],
        enabledModules: [],
      },
      outputRequests: [
        {
          outputRequestId: "out-1",
          perspectiveSpecId: "EXT_FRONT",
          perspectiveSpecVersion: 1,
        },
      ],
    });
    expect(result.success).toBe(true);
  });

  it("rejects vehicle metadata inside the business ref", () => {
    const result = StrictReferenceJobSchema.safeParse({
      jobId: "job-1",
      mode: "strict_reference",
      business: { vehicleId: "veh-1", brand: "leak" },
      visual: { referenceAssetIds: ["asset-1"], enabledModules: [] },
      outputRequests: [
        {
          outputRequestId: "out-1",
          perspectiveSpecId: "EXT_FRONT",
          perspectiveSpecVersion: 1,
        },
      ],
    });
    expect(result.success).toBe(false);
  });
});
