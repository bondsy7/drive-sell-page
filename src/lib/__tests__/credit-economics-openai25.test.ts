import { describe, it, expect } from "vitest";
import {
  calcOpenAi25Cost,
  breakEvenCredits,
  recommendedCredits,
  OVERHEAD_USD,
  INFRA_PER_IMAGE_USD,
} from "@/lib/credit-economics";

const REFS = 4;

describe("calcOpenAi25Cost – Overhead skaliert je Generierung", () => {
  it("rechnet Overhead 10× bei y=10", () => {
    const r = calcOpenAi25Cost({ model: "sunburst", referenceCount: REFS, outputCount: 10 });
    expect(r.overheadUsd).toBeCloseTo(OVERHEAD_USD * 10, 10);
  });

  it("rechnet Overhead 1× bei y=1", () => {
    const r = calcOpenAi25Cost({ model: "flare", referenceCount: REFS, outputCount: 1 });
    expect(r.overheadUsd).toBeCloseTo(OVERHEAD_USD, 10);
  });
});

describe("Referenz-Transfer ist modellabhängig", () => {
  it("Sunburst: einmaliger Upload, unabhängig von y", () => {
    const one = calcOpenAi25Cost({ model: "sunburst", referenceCount: REFS, outputCount: 1 });
    const ten = calcOpenAi25Cost({ model: "sunburst", referenceCount: REFS, outputCount: 10 });
    expect(one.referenceUploadUsd).toBeCloseTo(REFS * INFRA_PER_IMAGE_USD, 10);
    expect(ten.referenceUploadUsd).toBeCloseTo(REFS * INFRA_PER_IMAGE_USD, 10);
  });

  it("Flare: file_id-Upload bleibt unabhängig von y einmalig", () => {
    const ten = calcOpenAi25Cost({ model: "flare", referenceCount: REFS, outputCount: 10 });
    expect(ten.referenceUploadUsd).toBeCloseTo(REFS * INFRA_PER_IMAGE_USD, 10);
  });

  it("Image-Input-Tokenkosten skalieren bei beiden Modellen mit refs × outs", () => {
    const f = calcOpenAi25Cost({ model: "flare", referenceCount: REFS, outputCount: 10 });
    const s = calcOpenAi25Cost({ model: "sunburst", referenceCount: REFS, outputCount: 10 });
    expect(f.referenceImageInputUsd).toBeCloseTo(s.referenceImageInputUsd, 10);
  });

  it("liefert eine modellabhängige Transfer-Erklärung", () => {
    expect(calcOpenAi25Cost({ model: "sunburst", referenceCount: 1, outputCount: 1 }).transferNote)
      .toMatch(/file_id/);
    expect(calcOpenAi25Cost({ model: "flare", referenceCount: 1, outputCount: 1 }).transferNote)
      .toMatch(/file_id/);
  });
});

describe("Credit-Empfehlungen runden auf", () => {
  it("break-even und Zielmarge sind ganzzahlig und aufgerundet", () => {
    const ek = 0.5001;
    expect(breakEvenCredits(ek, "basis")).toBe(Math.ceil(ek / 0.49));
    const rec = recommendedCredits(ek, 0.8, "basis");
    expect(Number.isInteger(rec)).toBe(true);
    expect(rec).toBe(Math.ceil(ek / 0.2 / 0.49));
  });
});
