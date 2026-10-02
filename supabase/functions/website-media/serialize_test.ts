import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { parseBatchBody, serializePublication, urlOk } from "./serialize.ts";

const P = "https://x.supabase.co/storage/v1/object/public/vehicle-images/u/auto3-jobs/v/j/";

Deno.test("urlOk rejects private/signed/non-image/banner", () => {
  assertEquals(urlOk(P + "master.png"), true);
  assertEquals(urlOk("http://a/b.png"), false);
  assertEquals(urlOk("https://x/storage/v1/object/sign/vehicle-images/a.png?token=1"), false);
  assertEquals(urlOk("https://x/a.png?token=abc"), false);
  assertEquals(urlOk("https://x/storage/v1/object/public/banners/a.png"), false);
  assertEquals(urlOk(P + "clip.mp4"), false);
});

Deno.test("serialize: dedupe, stable sort, version/updatedAt", () => {
  const r = serializePublication({
    external_vehicle_id: "37767", published_at: "p", live_updated_at: "l", version: 3,
    live_snapshot: { coverMode: "ai", galleryMode: "replace", coverImageUrl: P + "a.png",
      images: [{ url: P + "b.png", sortOrder: 1 }, { url: P + "a.png", sortOrder: 0 }, { url: P + "a.png", sortOrder: 2 }, { url: P + "v.mp4", sortOrder: 3 }] },
  });
  assertEquals(r.images, [{ url: P + "a.png", sortOrder: 0 }, { url: P + "b.png", sortOrder: 1 }]);
  assertEquals(r.version, 3);
  assertEquals(r.updatedAt, "l");
});

Deno.test("serialize: missing cover falls back to first image, then to auto3", () => {
  const snap = { coverMode: "ai", galleryMode: "replace", coverImageUrl: P + "a.png", images: [{ url: P + "a.png", sortOrder: 0 }, { url: P + "b.png", sortOrder: 1 }] };
  const r1 = serializePublication({ external_vehicle_id: "1", published_at: null, live_snapshot: snap }, new Set([P + "a.png"]));
  assertEquals(r1.coverImageUrl, P + "b.png");
  const r2 = serializePublication({ external_vehicle_id: "1", published_at: null, live_snapshot: snap }, new Set([P + "a.png", P + "b.png"]));
  assertEquals([r2.coverMode, r2.coverImageUrl, r2.galleryMode, r2.images.length], ["auto3", null, "auto3", 0]);
});

Deno.test("serialize: legacy GET shape keys preserved", () => {
  const r = serializePublication({ external_vehicle_id: "37767", published_at: "p", live_snapshot: { coverMode: "auto3", galleryMode: "auto3", coverImageUrl: null, images: [] } });
  assertEquals(Object.keys(r).sort(), ["coverImageUrl", "coverMode", "externalVehicleId", "galleryMode", "images", "updatedAt", "version"]);
  assertEquals(r.updatedAt, "p");
});

Deno.test("parseBatchBody: 0/1/many/dupes/>100/invalid", () => {
  const ok = (b: unknown) => parseBatchBody(JSON.stringify(b));
  assertEquals(ok({ target: "autoschmitt", source: "auto3", externalVehicleIds: [] }), { ok: true, target: "autoschmitt", source: "auto3", ids: [] });
  assertEquals((ok({ target: "autoschmitt", externalVehicleIds: ["37767", 37767, " 37767 ", "1"] }) as any).ids, ["37767", "1"]);
  const many = Array.from({ length: 101 }, (_, i) => String(i));
  assertEquals((ok({ target: "autoschmitt", externalVehicleIds: many }) as any).error, "too_many_ids");
  assertEquals((ok({ target: "autoschmitt", externalVehicleIds: [...many.slice(0, 100), "0"] }) as any).ids.length, 100);
  assertEquals((ok({ target: "A B", externalVehicleIds: [] }) as any).status, 400);
  assertEquals((ok({ target: "autoschmitt", source: "x y", externalVehicleIds: [] }) as any).status, 400);
  assertEquals((ok({ target: "autoschmitt", externalVehicleIds: "37767" }) as any).status, 400);
  assertEquals((ok({ target: "autoschmitt", externalVehicleIds: [{}] }) as any).status, 400);
  assertEquals((parseBatchBody("{") as any).error, "invalid_json");
  assertEquals((parseBatchBody("x".repeat(20000)) as any).status, 413);
});
