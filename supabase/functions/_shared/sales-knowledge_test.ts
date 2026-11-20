import { assert, assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  chunkSalesKnowledge,
  buildSalesKnowledgeContext,
  formatKnowledgeSourcesForChat,
  isDemoKnowledgeSource,
  type SalesKnowledgeSource,
} from "./sales-knowledge.ts";

Deno.test("knowledge chunks stay bounded and preserve all DEMO sections", () => {
  const text = Array.from({ length: 12 }, (_, index) =>
    `[DEMO] Abschnitt ${index + 1}\n\nFinanzierung, Probefahrt und Beratung. `.repeat(18)
  ).join("\n\n");
  const chunks = chunkSalesKnowledge(text, 700, 100);
  assert(chunks.length > 5);
  assert(chunks.every((chunk) => chunk.length <= 700));
  assert(chunks.every((chunk) => chunk.trim().length > 0));
  for (let section = 1; section <= 12; section++) {
    assert(chunks.some((chunk) => chunk.includes(`[DEMO] Abschnitt ${section}`)), `Abschnitt ${section} fehlt`);
  }
});

Deno.test("empty knowledge creates no chunks", () => {
  assertEquals(chunkSalesKnowledge(" \n\r\n "), []);
});

Deno.test("source context and chat citations use the actual retrieved chunk", () => {
  const source: SalesKnowledgeSource = {
    chunkId: "chunk-1",
    documentId: "doc-1",
    title: "[DEMO] Finanzierung",
    documentType: "financing_rules",
    sourceType: "demo_seed",
    text: "Die DEMO-Anzahlung beträgt 20 Prozent.",
    snippet: "Die DEMO-Anzahlung beträgt 20 Prozent.",
    similarity: 0.91,
    isDemo: true,
  };
  assert(buildSalesKnowledgeContext([source]).includes("[Q1] [DEMO] Finanzierung"));
  assert(buildSalesKnowledgeContext([source]).includes("20 Prozent"));
  assert(formatKnowledgeSourcesForChat([source]).includes("**Q1: [DEMO] Finanzierung**"));
});

Deno.test("only explicit DEMO markers classify demo knowledge", () => {
  assertEquals(isDemoKnowledgeSource("demo_seed", " beliebig "), true);
  assertEquals(isDemoKnowledgeSource("upload", "[DEMO] Leitfaden"), true);
  assertEquals(isDemoKnowledgeSource("upload", "Demokratie der Kundenwünsche"), false);
});
