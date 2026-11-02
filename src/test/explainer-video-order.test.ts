import { describe, it, expect } from "vitest";
import { pickExplainerOrder } from "@/components/ExplainerVideoPlayer";
const s = { webm: "a.webm", mp4: "a.mp4" };
describe("explainer video format", () => {
  it("prefers MP4 where H.264 plays (Safari, iOS, Chrome, Firefox)", () => {
    expect(pickExplainerOrder(s, () => "probably")).toEqual(["a.mp4", "a.webm"]);
  });
  it("falls back to WebM where MP4 is unsupported", () => {
    expect(pickExplainerOrder(s, () => "")).toEqual(["a.webm", "a.mp4"]);
  });
});
