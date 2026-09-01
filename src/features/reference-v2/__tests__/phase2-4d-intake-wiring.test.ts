import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Phase 2.4D — Source-Guards fuer die Verdrahtung des automatischen Intakes.
 * Kommentare werden robust entfernt, damit nur ausfuehrbarer Code geprueft wird.
 */

function loadCode(relativePath: string): string {
  return readFileSync(path.join(process.cwd(), relativePath), "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:])\/\/.*$/gm, "$1");
}

const INTAKE_PATH =
  "src/features/reference-v2/phase1-5/AutomaticReferenceIntake.tsx";
const code = loadCode(INTAKE_PATH);

describe("Phase 2.4D — AutomaticReferenceIntake wiring", () => {
  it("imports and uses the runtime hook", () => {
    expect(code).toContain("../phase2/framing-evidence-runtime");
    expect(code).toContain("useCurrentFramingEvidenceRuntime()");
    expect(code).toContain("recordCurrentFramingEvidence");
  });

  it("ingests before recording current evidence", () => {
    const ingestIndex = code.indexOf("const asset = ingestAsset(");
    const recordIndex = code.indexOf("recordCurrentFramingEvidence(master.id");
    expect(ingestIndex).toBeGreaterThan(-1);
    expect(recordIndex).toBeGreaterThan(ingestIndex);
  });

  it("keys the sidecar with the persisted asset id only", () => {
    expect(code).toContain("recordCurrentFramingEvidence(master.id, asset.id,");
    expect(code).not.toContain("outcome.intake.assetId");
    expect(code).not.toContain(".fileId");
    expect(code).not.toContain("outcome.file.fileId");
  });

  it("passes exactly the four current framing facts", () => {
    expect(code).toContain("sourceAspectRatio: strictAspectRatio");
    expect(code).toContain(
      "fullVehicleVisible: outcome.intake.framing.fullVehicleVisible",
    );
    expect(code).toContain("cropped: outcome.intake.framing.cropped");
    expect(code).toContain("paddingPct: outcome.framing.paddingPct");
  });

  it("measures aspect ratio strictly without a 1.5 fallback", () => {
    expect(code).not.toContain("|| 1.5");
    expect(code).not.toContain("?? 1.5");
    expect(code).not.toContain("resolve(1.5)");
    expect(code).not.toContain("= 1.5");
    expect(code).toContain("reject(new Error(");
  });

  it("still hands measureAspectRatio to the frozen coordinator", () => {
    expect(code).toContain("measureAspectRatio,");
    expect(code).toContain("analyzeFileBatch(");
  });

  it("pairs outcomes to original files by index, not by filename", () => {
    expect(code).toContain("const originalFile = list[index]");
    expect(code).toContain("previewByIndex[index]");
    expect(code).not.toContain("previews.get(");
  });

  it("does not release preview or fail the asset when evidence fails", () => {
    const recordIndex = code.indexOf("recordCurrentFramingEvidence(master.id");
    const evidenceBlock = code.slice(recordIndex, recordIndex + 500);
    expect(evidenceBlock).not.toContain("releaseUrl");
    expect(evidenceBlock).not.toContain('stage: "failed"');
  });

  it("keeps the frozen coordinator unmodified", () => {
    const coordinator = loadCode(
      "src/features/reference-v2/phase1-5/analysis-coordinator.ts",
    );
    expect(coordinator).toContain("aspectRatio = 1.5");
    expect(coordinator).not.toContain("recordCurrentFramingEvidence");
  });
});
