import { assertEquals, assert } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { financingStatus, resolveBankPlaceholders, buildEnvkv, CREDIT_WARNING } from "./offer-compliance.ts";

const fullFin = { category: "Finanzierung", customerType: "private",
  finance: { totalPrice: "30000", downPayment: "3000", netLoanAmount: "27000", duration: "48", monthlyRate: "299", nominalInterestRate: "4,99", interestRate: "5,11", totalAmount: "31000" },
  dealer: { financingBank: "Testbank", financingLegalText: "Beispiel der {bank_name}, Laufzeit: {laufzeit}, Schlussrate: {schlussrate}, Rate: {monatsrate}." } };

Deno.test("complete B2C financing shows rate and credit warning", () => {
  const s = financingStatus(fullFin);
  assertEquals(s.showRate, true);
  assertEquals(s.creditWarning, CREDIT_WARNING);
});

Deno.test("missing effective rate hides only the rate; cash stays publishable", () => {
  const vd = { ...fullFin, finance: { ...fullFin.finance, interestRate: "" } };
  const s = financingStatus(vd);
  assertEquals(s.showRate, false);
  assertEquals(s.canPublishCash, true);
  assertEquals(s.missingFields, ["effektiver_zins"]);
});

Deno.test("business financing gets no credit warning", () => {
  assertEquals(financingStatus({ ...fullFin, customerType: "business" }).creditWarning, null);
});

Deno.test("placeholders resolved, empty clause removed, no braces left", () => {
  const t = resolveBankPlaceholders(fullFin.dealer.financingLegalText, fullFin, "Testbank");
  assert(!t.includes("{"));
  assert(!t.includes("Schlussrate"));
  assert(t.includes("48 Monate"));
});

Deno.test("PHEV without discharged values is incomplete", () => {
  const e = buildEnvkv({ consumption: { isPluginHybrid: true, consumptionCombined: "1,2", consumptionElectric: "17", co2Emissions: "28", co2Class: "B" } });
  assertEquals(e.isComplete, false);
  assert(e.missingFields.includes("consumptionCombinedDischarged"));
});
