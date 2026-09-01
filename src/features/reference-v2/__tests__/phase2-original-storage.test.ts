import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  REFERENCE_V2_MIME_EXTENSION,
  ReferenceV2OriginalStorageAuthError,
  ReferenceV2OriginalStorageConflictError,
  ReferenceV2OriginalStorageError,
  computeReferenceV2Sha256,
  createReferenceV2OriginalStorageService,
  type ReferenceV2OriginalStoragePort,
  type ReferenceV2UploadOptions,
} from "../phase2/original-storage";
import { ReferenceV2PersistenceError } from "../phase2/persistence-contract";

const USER_ID = "11111111-1111-4111-8111-111111111111";
const VEHICLE_ID = "22222222-2222-4222-8222-222222222222";
const WORKSPACE_ID = "33333333-3333-4333-8333-333333333333";
const ASSET_KEY = "ref_abc123";

const SHA_ABC =
  "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad";

interface UploadCall {
  path: string;
  file: Blob;
  options: ReferenceV2UploadOptions;
}

function makeFile(
  bytes: string | Uint8Array,
  type: string,
  name = "photo.bin",
): File {
  const data = typeof bytes === "string" ? [bytes] : [bytes];
  return new File(data as BlobPart[], name, { type });
}

function makePort(overrides: {
  authUserId?: string | null;
  authThrows?: unknown;
  uploadError?: unknown;
} = {}) {
  const calls: UploadCall[] = [];
  const port: ReferenceV2OriginalStoragePort = {
    async getAuthenticatedUserId() {
      if (overrides.authThrows) throw overrides.authThrows;
      return overrides.authUserId === undefined
        ? USER_ID
        : overrides.authUserId;
    },
    async uploadOriginal(p, file, options) {
      calls.push({ path: p, file, options });
      return { error: overrides.uploadError ?? null };
    },
  };
  return { port, calls };
}

function baseInput(file: File) {
  return {
    file,
    userId: USER_ID,
    vehicleId: VEHICLE_ID,
    workspaceId: WORKSPACE_ID,
    assetKey: ASSET_KEY,
  };
}

describe("Phase 2.6C — SHA-256", () => {
  it("1. computes the known lowercase 64-hex digest deterministically", async () => {
    const file = makeFile("abc", "image/jpeg");
    const a = await computeReferenceV2Sha256(file);
    const b = await computeReferenceV2Sha256(makeFile("abc", "image/jpeg"));
    expect(a).toBe(SHA_ABC);
    expect(b).toBe(a);
    expect(a).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe("Phase 2.6C — happy path", () => {
  it("2. valid JPEG returns exact descriptor and frozen path", async () => {
    const { port, calls } = makePort();
    const svc = createReferenceV2OriginalStorageService(port);
    const file = makeFile("abc", "image/jpeg", "front.jpg");

    const descriptor = await svc.store(baseInput(file));

    expect(descriptor).toEqual({
      storageBucket: "originals",
      storagePath: `${USER_ID}/${VEHICLE_ID}/reference-v2/${WORKSPACE_ID}/${ASSET_KEY}/original.jpg`,
      mimeType: "image/jpeg",
      sizeBytes: 3,
      sha256: SHA_ABC,
    });
    expect(calls).toHaveLength(1);
  });

  it("3. maps png/webp/jpeg to the exact extensions", async () => {
    expect(REFERENCE_V2_MIME_EXTENSION).toEqual({
      "image/jpeg": "jpg",
      "image/png": "png",
      "image/webp": "webp",
    });

    for (const [mime, ext] of [
      ["image/png", "png"],
      ["image/webp", "webp"],
      ["image/jpeg", "jpg"],
    ] as const) {
      const { port } = makePort();
      const svc = createReferenceV2OriginalStorageService(port);
      const d = await svc.store(baseInput(makeFile("abc", mime)));
      expect(d.storagePath.endsWith(`/original.${ext}`)).toBe(true);
      expect(d.mimeType).toBe(mime);
    }
  });

  it("4. identical inputs always produce the identical path and hash", async () => {
    const { port } = makePort();
    const svc = createReferenceV2OriginalStorageService(port);
    const a = await svc.store(baseInput(makeFile("abc", "image/jpeg")));
    const b = await svc.store(baseInput(makeFile("abc", "image/jpeg")));
    expect(a).toEqual(b);
  });

  it("5. passes the same raw File object and exactly contentType + upsert:false", async () => {
    const { port, calls } = makePort();
    const svc = createReferenceV2OriginalStorageService(port);
    const file = makeFile("abc", "image/webp");

    await svc.store(baseInput(file));

    expect(calls[0].file).toBe(file);
    expect(calls[0].options).toEqual({ contentType: "image/webp", upsert: false });
    expect(Object.keys(calls[0].options).sort()).toEqual([
      "contentType",
      "upsert",
    ]);
  });
});

describe("Phase 2.6C — validation fails closed before upload", () => {
  it("6. rejects unsupported and blank MIME", async () => {
    for (const mime of ["image/gif", "application/pdf", ""]) {
      const { port, calls } = makePort();
      const svc = createReferenceV2OriginalStorageService(port);
      await expect(
        svc.store(baseInput(makeFile("abc", mime))),
      ).rejects.toBeInstanceOf(ReferenceV2OriginalStorageError);
      expect(calls).toHaveLength(0);
    }
  });

  it("7. rejects zero-byte files", async () => {
    const { port, calls } = makePort();
    const svc = createReferenceV2OriginalStorageService(port);
    await expect(
      svc.store(baseInput(makeFile("", "image/jpeg"))),
    ).rejects.toBeInstanceOf(ReferenceV2OriginalStorageError);
    expect(calls).toHaveLength(0);
  });

  it("8. rejects invalid UUIDs and path-unsafe assetKeys via the frozen helper", async () => {
    const cases = [
      { userId: "not-a-uuid" },
      { vehicleId: "1234" },
      { workspaceId: "" },
      { assetKey: "../escape" },
      { assetKey: "nested/key" },
      { assetKey: " ref_pad " },
    ];
    for (const patch of cases) {
      const { port, calls } = makePort();
      const svc = createReferenceV2OriginalStorageService(port);
      await expect(
        svc.store({ ...baseInput(makeFile("abc", "image/jpeg")), ...patch }),
      ).rejects.toBeInstanceOf(ReferenceV2PersistenceError);
      expect(calls).toHaveLength(0);
    }
  });

  it("9. rejects unauthenticated callers before upload", async () => {
    const { port, calls } = makePort({ authUserId: null });
    const svc = createReferenceV2OriginalStorageService(port);
    await expect(
      svc.store(baseInput(makeFile("abc", "image/jpeg"))),
    ).rejects.toBeInstanceOf(ReferenceV2OriginalStorageAuthError);
    expect(calls).toHaveLength(0);
  });

  it("10. rejects auth-user mismatch before upload", async () => {
    const { port, calls } = makePort({
      authUserId: "99999999-9999-4999-8999-999999999999",
    });
    const svc = createReferenceV2OriginalStorageService(port);
    await expect(
      svc.store(baseInput(makeFile("abc", "image/jpeg"))),
    ).rejects.toBeInstanceOf(ReferenceV2OriginalStorageAuthError);
    expect(calls).toHaveLength(0);
  });

  it("11. fails closed when Web Crypto digest is unavailable/failing and does not upload", async () => {
    const original = globalThis.crypto.subtle;
    const { port, calls } = makePort();
    const svc = createReferenceV2OriginalStorageService(port);

    Object.defineProperty(globalThis.crypto, "subtle", {
      configurable: true,
      value: undefined,
    });
    await expect(
      svc.store(baseInput(makeFile("abc", "image/jpeg"))),
    ).rejects.toBeInstanceOf(ReferenceV2OriginalStorageError);
    expect(calls).toHaveLength(0);

    Object.defineProperty(globalThis.crypto, "subtle", {
      configurable: true,
      value: {
        digest: () => Promise.reject(new Error("boom")),
      },
    });
    await expect(
      svc.store(baseInput(makeFile("abc", "image/jpeg"))),
    ).rejects.toBeInstanceOf(ReferenceV2OriginalStorageError);
    expect(calls).toHaveLength(0);

    Object.defineProperty(globalThis.crypto, "subtle", {
      configurable: true,
      value: original,
    });
  });
});

describe("Phase 2.6C — storage error translation", () => {
  it("12. duplicate/409 becomes a conflict error, single upload attempt", async () => {
    for (const err of [
      { status: 409, message: "Duplicate", error: "Duplicate" },
      { statusCode: "409", message: "The resource already exists" },
    ]) {
      const { port, calls } = makePort({ uploadError: err });
      const svc = createReferenceV2OriginalStorageService(port);
      await expect(
        svc.store(baseInput(makeFile("abc", "image/jpeg"))),
      ).rejects.toBeInstanceOf(ReferenceV2OriginalStorageConflictError);
      expect(calls).toHaveLength(1);
    }
  });

  it("13. ordinary storage failure becomes a generic service error", async () => {
    const { port, calls } = makePort({
      uploadError: { status: 500, message: "Internal error" },
    });
    const svc = createReferenceV2OriginalStorageService(port);
    const err = await svc
      .store(baseInput(makeFile("abc", "image/jpeg")))
      .catch((e) => e);
    expect(err).toBeInstanceOf(ReferenceV2OriginalStorageError);
    expect(err).not.toBeInstanceOf(ReferenceV2OriginalStorageConflictError);
    expect(err.status).toBe(500);
    expect(calls).toHaveLength(1);
  });

  it("14. descriptor carries no URL/content/transient fields", async () => {
    const { port } = makePort();
    const svc = createReferenceV2OriginalStorageService(port);
    const d = await svc.store(baseInput(makeFile("abc", "image/png")));
    expect(Object.keys(d).sort()).toEqual([
      "mimeType",
      "sha256",
      "sizeBytes",
      "storageBucket",
      "storagePath",
    ]);
  });
});

describe("Phase 2.6C — source guards", () => {
  const SRC = path.resolve(
    __dirname,
    "../phase2/original-storage.ts",
  );
  const raw = readFileSync(SRC, "utf8");
  const src = raw
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:])\/\/.*$/gm, "$1");

  it("15. imports frozen dependencies and only uses raw storage upload", () => {
    expect(src).toContain('from "@/integrations/supabase/client"');
    expect(src).toContain("REFERENCE_V2_STORAGE_BUCKET");
    expect(src).toContain("buildReferenceV2OriginalStoragePath");
    expect(src).toContain("REFERENCE_V2_ALLOWED_IMAGE_MIME");
    expect(src).toContain(".storage.from(");
    expect(src).toContain(".upload(");

    const forbidden = [
      "FileReader",
      "readAsDataURL",
      "btoa(",
      "atob(",
      "base64",
      "getPublicUrl",
      "createSignedUrl",
      ".download(",
      ".remove(",
      ".move(",
      ".copy(",
      "upsert: true",
      "Math.random",
      "Date.now",
      "fetch(",
      "from('vehicles')",
      'from("vehicles")',
      "persistence-repository",
      "OneShot",
      "Spin360",
      "remaster",
      "generate-",
      "reference-v2-analyze-image",
    ];
    for (const token of forbidden) {
      expect(src.includes(token), `must not contain ${token}`).toBe(false);
    }
    expect(/\bdata:/i.test(src)).toBe(false);
    expect(/\bblob:/i.test(src)).toBe(false);
  });

  it("16. accepts no business metadata keys", () => {
    for (const token of [
      "vin",
      "brand",
      "model",
      "trim",
      "variant",
      "year",
      "title",
    ]) {
      expect(
        new RegExp(`\\b${token}\\b`, "i").test(src),
        `must not reference ${token}`,
      ).toBe(false);
    }
  });
});
