import { assertEquals, assert } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { buildCanonicalUrl, buildStructuredData, clampMetaDescription, landingSlugify, stripPlaceholders } from "./landing-seo.ts";

Deno.test("canonical points to the page, not the homepage", () => {
  assertEquals(buildCanonicalUrl("https://www.wir-sind-jacobs.de/", landingSlugify("MASERATI Grecale")), "https://www.wir-sind-jacobs.de/maserati-grecale/");
  assertEquals(buildCanonicalUrl("", "x"), null);
});

Deno.test("meta description max 152 chars", () => {
  const d = clampMetaDescription("Wort ".repeat(60));
  assert(d.length <= 152);
});

Deno.test("no placeholder address in schema", () => {
  const sd = JSON.stringify(buildStructuredData({ dealer: { name: "Jacobs", address: "Musterstraße 123", postalCode: "12345", city: "Musterstadt" }, brand: "Kia", model: "Picanto", canonicalUrl: null }));
  assert(!/Muster|12345|PostalAddress/.test(sd));
});

Deno.test("FAQ becomes FAQPage", () => {
  const sd = JSON.stringify(buildStructuredData({ brand: "Kia", model: "Picanto", canonicalUrl: null, faqHtml: ["<h3>Wie lange?</h3><p>Zwei Wochen.</p>"] }));
  assert(sd.includes('"FAQPage"') && sd.includes("Zwei Wochen."));
});

Deno.test("placeholder city removed from title", () => {
  assertEquals(stripPlaceholders("Kia Picanto kaufen in Musterstadt"), "Kia Picanto kaufen");
});
