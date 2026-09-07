import { describe, expect, it } from "vitest";
import {
  normalizeReferenceFile,
  ReferenceFileNormalizationError,
} from "../phase1-5/normalize-reference-file";

describe("normalizeReferenceFile", () => {
  it.each(["image/jpeg", "image/png", "image/webp"])(
    "gibt direkt zulaessige Formate unveraendert zurueck (%s)",
    async (type) => {
      const file = new File([new Uint8Array([1, 2, 3])], "a.bin", { type });
      const out = await normalizeReferenceFile(file);
      expect(out).toBe(file);
    },
  );

  it("lehnt Nicht-Bilder fail-closed ab", async () => {
    const file = new File([new Uint8Array([1])], "doc.pdf", {
      type: "application/pdf",
    });
    await expect(normalizeReferenceFile(file)).rejects.toBeInstanceOf(
      ReferenceFileNormalizationError,
    );
  });

  it("lehnt leeren MIME-Type fail-closed ab", async () => {
    const file = new File([new Uint8Array([1])], "x", { type: "" });
    await expect(normalizeReferenceFile(file)).rejects.toBeInstanceOf(
      ReferenceFileNormalizationError,
    );
  });
});
