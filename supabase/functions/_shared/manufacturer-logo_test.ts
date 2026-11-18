import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { selectManufacturerLogo } from "./manufacturer-logo.ts";

Deno.test("Maserati uses the current SVG instead of the legacy PNG", () => {
  assertEquals(
    selectManufacturerLogo(
      [{ name: "maserati.png" }, { name: "maserati.webp" }],
      [{ name: "maserati.svg" }],
      "MASERATI",
    ),
    { name: "maserati.svg", folder: "svg" },
  );
});

Deno.test("a raster logo remains the fallback when no SVG exists", () => {
  assertEquals(
    selectManufacturerLogo([{ name: "maserati.png" }], [], "Maserati"),
    { name: "maserati.png", folder: "" },
  );
});

Deno.test("Volkswagen aliases still resolve to an exact SVG", () => {
  assertEquals(
    selectManufacturerLogo([{ name: "volkswagen.png" }], [{ name: "vw.svg" }], "Volkswagen"),
    { name: "vw.svg", folder: "svg" },
  );
});

Deno.test("DS and DS Automobiles resolve to the same current logo", () => {
  for (const brand of ["DS", "DS Automobiles", "DS AUTOMOBILES"]) {
    assertEquals(
      selectManufacturerLogo([{ name: "ds.png" }], [{ name: "ds.svg" }], brand),
      { name: "ds.svg", folder: "svg" },
    );
  }
});
