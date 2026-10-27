import { describe, it, expect } from "vitest";
import { isSwRefusedHost } from "@/lib/pwa-register";
describe("offline worker host guard", () => {
  it("refuses Lovable preview", () => expect(isSwRefusedHost("id-preview--d0378f26-19eb-41aa-bdb2-71a61d174614.lovable.app")).toBe(true));
  it("refuses ?sw=off", () => expect(isSwRefusedHost("app.autohaus.ai", "?sw=off")).toBe(true));
  it("allows published domain", () => expect(isSwRefusedHost("app.autohaus.ai")).toBe(false));
});
