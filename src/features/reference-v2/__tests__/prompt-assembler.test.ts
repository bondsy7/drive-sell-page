import { describe, it, expect } from "vitest";
import {
  PROMPT_SECTION_KEYS,
  assembleStrictReferencePrompt,
  type PromptAssemblyInput,
} from "@/features/reference-v2/domain/prompt-assembler";
import { FORBIDDEN_VEHICLE_METADATA_FIELDS } from "@/features/reference-v2/domain/generation-request";

const baseInput: PromptAssemblyInput = {
  perspectiveSpecId: "EXT_SIDE_RIGHT",
  perspectiveSpecVersion: 1,
  enabledModuleIds: ["whiteBalance", "dirtRemoval"],
  references: [
    { assetId: "ref-c", role: "secondary" },
    {
      assetId: "ref-a",
      role: "primary",
      coverageSurfaces: ["right_side"],
      isExactPerspectiveMatch: true,
    },
    { assetId: "ref-b", role: "secondary", coverageSurfaces: ["rear"] },
  ],
};

describe("prompt assembler structure", () => {
  it("produces exactly the four sections in fixed order", () => {
    const { text, sections } = assembleStrictReferencePrompt(baseInput);
    expect(Object.keys(sections)).toEqual([...PROMPT_SECTION_KEYS]);
    const positions = PROMPT_SECTION_KEYS.map((key) =>
      text.indexOf(`[${key}]`),
    );
    for (const pos of positions) expect(pos).toBeGreaterThanOrEqual(0);
    for (let i = 1; i < positions.length; i++) {
      expect(positions[i]).toBeGreaterThan(positions[i - 1]);
    }
  });

  it("contains exactly one priority hierarchy", () => {
    const { text } = assembleStrictReferencePrompt(baseInput);
    const matches = text.match(/PRIORITY HIERARCHY/g) ?? [];
    expect(matches).toHaveLength(1);
    expect(text).toContain(
      "1. Visual vehicle identity from the assigned reference images.",
    );
    expect(text).toContain("2. The target perspective specification.");
    expect(text).toContain(
      "3. Explicitly enabled non-transformative editing modules.",
    );
    expect(text).toContain(
      "4. Photographic enhancement (lighting, clarity, color balance).",
    );
    expect(text).toContain("must never alter a higher priority");
  });

  it("contains no forbidden vehicle metadata terms", () => {
    const { text } = assembleStrictReferencePrompt(baseInput);
    for (const term of FORBIDDEN_VEHICLE_METADATA_FIELDS) {
      const pattern = new RegExp(`\\b${term}\\b`, "i");
      expect(pattern.test(text), `term '${term}' leaked into prompt`).toBe(
        false,
      );
    }
  });

  it("renders side convention and orientation for EXT_SIDE_RIGHT", () => {
    const { sections } = assembleStrictReferencePrompt(baseInput);
    expect(sections.PERSPECTIVE).toContain("+90\u00B0");
    expect(sections.PERSPECTIVE).toContain(
      "The vehicle front points to the image left.",
    );
    expect(sections.PERSPECTIVE).toContain(
      "Left/right always refer to the vehicle itself, never to the viewer.",
    );
    expect(sections.PERSPECTIVE).toContain("Mirroring or flipping is strictly forbidden.");
  });

  it("lists references with the primary first and vehicle-only manifest", () => {
    const { sections } = assembleStrictReferencePrompt(baseInput);
    const manifest = sections.REFERENCE_MANIFEST;
    expect(manifest.indexOf("ref-a")).toBeLessThan(manifest.indexOf("ref-b"));
    expect(manifest).toContain("R1 (primary, exact perspective match): asset ref-a");
    expect(manifest).toContain("authoritative for: right_side");
    expect(manifest).toContain(
      "Vehicle emblems, badges and lettering come exclusively from the reference images",
    );
  });
});

describe("prompt assembler determinism", () => {
  it("is deterministic for identical input", () => {
    const a = assembleStrictReferencePrompt(baseInput);
    const b = assembleStrictReferencePrompt(baseInput);
    expect(a.text).toBe(b.text);
  });

  it("is order-independent for secondaries and modules", () => {
    const shuffled: PromptAssemblyInput = {
      ...baseInput,
      enabledModuleIds: ["dirtRemoval", "whiteBalance"],
      references: [
        { assetId: "ref-b", role: "secondary", coverageSurfaces: ["rear"] },
        { assetId: "ref-c", role: "secondary" },
        {
          assetId: "ref-a",
          role: "primary",
          coverageSurfaces: ["right_side"],
          isExactPerspectiveMatch: true,
        },
      ],
    };
    expect(assembleStrictReferencePrompt(shuffled).text).toBe(
      assembleStrictReferencePrompt(baseInput).text,
    );
  });
});

describe("prompt assembler guards", () => {
  it("rejects TRANSFORMATION modules", () => {
    expect(() =>
      assembleStrictReferencePrompt({
        ...baseInput,
        enabledModuleIds: ["paintColorChange"],
      }),
    ).toThrow(/TRANSFORMATION/);
  });

  it("requires exactly one primary reference", () => {
    expect(() =>
      assembleStrictReferencePrompt({
        ...baseInput,
        references: [{ assetId: "ref-a", role: "secondary" }],
      }),
    ).toThrow(/exactly one primary/);
    expect(() =>
      assembleStrictReferencePrompt({
        ...baseInput,
        references: [
          { assetId: "ref-a", role: "primary" },
          { assetId: "ref-b", role: "primary" },
        ],
      }),
    ).toThrow(/exactly one primary/);
  });

  it("rejects duplicate reference asset ids", () => {
    expect(() =>
      assembleStrictReferencePrompt({
        ...baseInput,
        references: [
          { assetId: "ref-a", role: "primary" },
          { assetId: "ref-a", role: "secondary" },
        ],
      }),
    ).toThrow(/duplicate/);
  });

  it("rejects vehicle metadata fields at the input boundary (.strict())", () => {
    const polluted = {
      ...baseInput,
      vehicleDescription: "2026 SUV facelift",
    } as unknown as PromptAssemblyInput;
    expect(() => assembleStrictReferencePrompt(polluted)).toThrow();
  });

  it("renders empty module section correctly", () => {
    const { sections } = assembleStrictReferencePrompt({
      ...baseInput,
      enabledModuleIds: [],
    });
    expect(sections.ACTIVE_MODULES).toContain("No editing modules enabled.");
  });
});

describe("hero output keys in prompts", () => {
  it("references the base perspective for HERO outputs", () => {
    const { sections } = assembleStrictReferencePrompt({
      perspectiveSpecId: "HERO_FRONT_LEFT",
      perspectiveSpecVersion: 1,
      enabledModuleIds: [],
      references: [{ assetId: "ref-a", role: "primary" }],
    });
    expect(sections.PERSPECTIVE).toContain(
      "Presentation output for base perspective EXT_34_FRONT_LEFT",
    );
    expect(sections.PERSPECTIVE).toContain("identical geometry");
  });
});

describe("prompt assembler: no scene, logo or branding assets", () => {
  it("never mentions scene, plate, showroom, logo or branding assets", () => {
    const { text } = assembleStrictReferencePrompt(baseInput);
    for (const term of ["scene", "plate", "showroom", "logo", "brand", "wall branding"]) {
      expect(
        new RegExp(term, "i").test(text),
        `term '${term}' leaked into prompt`,
      ).toBe(false);
    }
  });

  it("rejects scene/logo ids structurally at the input boundary", () => {
    for (const extra of [
      { scene: { scenePackId: "p", scenePlateId: "pl" } },
      { logo: { logoAssetId: "logo-1" } },
      { scenePackId: "p" },
      { logoAssetId: "l" },
    ]) {
      expect(() =>
        assembleStrictReferencePrompt({
          ...baseInput,
          ...extra,
        } as unknown as PromptAssemblyInput),
      ).toThrow();
    }
  });

  it("states that only vehicle reference images are provided", () => {
    const { sections } = assembleStrictReferencePrompt(baseInput);
    expect(sections.REFERENCE_MANIFEST).toContain(
      "These vehicle reference images are the only images provided",
    );
  });
});

describe("prompt assembler: perspective spec version is reproducible", () => {
  it("fails closed on a version mismatch", () => {
    expect(() =>
      assembleStrictReferencePrompt({ ...baseInput, perspectiveSpecVersion: 2 }),
    ).toThrow(/version mismatch/);
  });

  it("requires an explicit version", () => {
    const { perspectiveSpecVersion: _v, ...withoutVersion } = baseInput;
    expect(() =>
      assembleStrictReferencePrompt(withoutVersion as PromptAssemblyInput),
    ).toThrow();
  });
});

describe("prompt assembler: reference budget", () => {
  it("accepts primary + 3 secondaries and rejects more", () => {
    const refs = (count: number) => [
      { assetId: "p", role: "primary" as const },
      ...Array.from({ length: count }, (_, i) => ({
        assetId: `s${i}`,
        role: "secondary" as const,
      })),
    ];
    expect(() =>
      assembleStrictReferencePrompt({ ...baseInput, references: refs(3) }),
    ).not.toThrow();
    expect(() =>
      assembleStrictReferencePrompt({ ...baseInput, references: refs(4) }),
    ).toThrow();
  });
});

describe("prompt assembler: reproducible camera spec", () => {
  it("renders a target focal length and a narrow permitted range", () => {
    const { sections } = assembleStrictReferencePrompt(baseInput);
    expect(sections.PERSPECTIVE).toContain("target focal length 70mm");
    expect(sections.PERSPECTIVE).toContain("permitted 55-85mm");
    expect(sections.PERSPECTIVE).toContain("+90\u00B0 (\u00B17\u00B0)");
  });
});
