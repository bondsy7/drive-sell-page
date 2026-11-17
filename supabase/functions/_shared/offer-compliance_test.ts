import { assertEquals, assert } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { bankFromLegalText, shortcodeValues, financingStatus, resolveBankPlaceholders, buildEnvkv, buildLegalNotice, buildPrice, withComputedFinance, formatMonthlyRate, CREDIT_WARNING } from "./offer-compliance.ts";

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

Deno.test("leasing total is derived from Sonderzahlung + Laufzeit × Rate", () => {
  const vd = { category: "Leasing", finance: { monthlyRate: "208,00 €", duration: "36 Monate", specialPayment: "6.000,00 €" } };
  assertEquals(shortcodeValues(vd, "").gesamtbetrag, "13.488,00 €");
});

Deno.test("bank name is read from legal text when the bank field is empty", () => {
  assertEquals(bankFromLegalText("Ein Angebot der Volkswagen Leasing GmbH, Gifhorner Straße 57"), "Volkswagen Leasing GmbH");
});

Deno.test("every leasing legal notice carries footnote marker 1", () => {
  const notice = buildLegalNotice({ category: "Leasing", dealer: { leasingBank: "Testbank", leasingLegalText: "Angebot der {bank_name}." } });
  assertEquals(notice?.footnoteMarker, "1");
  assertEquals(notice?.text, "Angebot der Testbank.");
});

Deno.test("default legal notices also carry footnote marker 1", () => {
  const notice = buildLegalNotice({ category: "Kauf", dealer: { defaultLegalText: "Allgemeine Pflichthinweise." } });
  assertEquals(notice?.footnoteMarker, "1");
});

Deno.test("no legal notice is emitted without bank or text", () => {
  assertEquals(buildLegalNotice({ category: "Leasing", dealer: {} }), null);
});

Deno.test("Peaq cash price is numeric and mirrored for legacy WordPress readers", () => {
  const vd = { category: "Leasing", vehicle: { brand: "Skoda", model: "Peaq" }, finance: { totalPrice: "51.500,00 €" } };
  assertEquals(buildPrice(vd).cashPrice, 51500);
  assertEquals(withComputedFinance(vd).vehicle.price, "51.500,00 €");
});

Deno.test("legacy price fallback never overwrites an explicit vehicle price", () => {
  const vd = { vehicle: { price: "49.900,00 €" }, finance: { totalPrice: "51.500,00 €" } };
  assertEquals(withComputedFinance(vd).vehicle.price, "49.900,00 €");
});

Deno.test("monthly API price is numeric and formatted with exactly one €/mtl. suffix", () => {
  const vd = { ...fullFin, finance: { ...fullFin.finance, monthlyRate: "249,00 €/mtl./mtl." } };
  const price = buildPrice(vd);
  assertEquals(price.monthlyRate, 249);
  assertEquals(price.monthlyRateFormatted, "249,00 €/mtl.");
  assertEquals(withComputedFinance(vd).finance.monthlyRate, "249,00 €/mtl.");
});

Deno.test("German thousands and legacy EUR/monthly inputs keep their numeric value", () => {
  const vd = { ...fullFin, finance: { ...fullFin.finance, monthlyRate: "1.249,00 EUR mtl." } };
  assertEquals(buildPrice(vd).monthlyRate, 1249);
  assertEquals(buildPrice(vd).monthlyRateFormatted, "1.249,00 €/mtl.");
  assertEquals(formatMonthlyRate("269,- €"), "269,00 €/mtl.");
  assertEquals(buildPrice({ ...fullFin, finance: { ...fullFin.finance, monthlyRate: "269,- €" } }).monthlyRate, 269);
});

Deno.test("cash offers do not receive a monthly suffix", () => {
  const vd = { category: "Barkauf", finance: { totalPrice: "34.669,20 €", monthlyRate: "249,00 €" } };
  assertEquals(withComputedFinance(vd).finance.monthlyRate, "249,00 €");
  assertEquals(buildPrice(vd).monthlyRate, null);
  assertEquals(buildPrice(vd).cashPrice, 34669.2);
});

// ─── offerCheck: exakte Händler-Fehler statt Preisvermutungen ───────────────
import { buildOfferCheck } from "./offer-compliance.ts";
const envOk = { consumption: { fuelType: "Benzin", consumptionCombined: "5,1", co2Emissions: "116", co2Class: "D" } };

Deno.test("offerCheck: landing page is not an offer and gets no price issues", () => {
  const c = buildOfferCheck({ vehicle: { brand: "Kia" } }, "landing-page");
  assertEquals(c.kind, "landing_page");
  assertEquals(c.status, "not_an_offer");
  assertEquals(c.issues.length, 0);
});

Deno.test("offerCheck: photo-only project is media_only", () => {
  assertEquals(buildOfferCheck({ vehicle: {} }, "modern").kind, "media_only");
});

Deno.test("offerCheck: legacy price '41.436,97 € (netto)' is read as 41436.97 without price issue", () => {
  const c = buildOfferCheck({ category: "Barkauf", finance: { totalPrice: "41.436,97 € (netto)" }, ...envOk }, "modern");
  assertEquals(c.values.cashPrice, 41436.97);
  assertEquals(c.issues.filter((i) => i.area === "price").length, 0);
  assertEquals(c.status, "ok");
});

Deno.test("offerCheck: old offer without category but with rate reports missing offer type, not price", () => {
  const c = buildOfferCheck({ finance: { totalPrice: "23.990,00 €", monthlyRate: "199" }, ...envOk }, "modern");
  assertEquals(c.issues.map((i) => i.code), ["offer_type_missing"]);
  assertEquals(c.values.cashPrice, 23990);
});

Deno.test("offerCheck: legacy 'Kauf' category is a cash offer", () => {
  const c = buildOfferCheck({ category: "Kauf", finance: { totalPrice: "10000" }, ...envOk }, "autohaus");
  assertEquals(c.values.offerType, "cash");
  assertEquals(c.issues.length, 0);
});

Deno.test("offerCheck: cash offer without price is an error", () => {
  const c = buildOfferCheck({ category: "Barkauf", finance: { totalPrice: "" }, ...envOk }, "modern");
  assertEquals(c.issues[0].code, "cash_price_missing");
  assertEquals(c.issues[0].severity, "error");
  assertEquals(c.publishable, false);
});

Deno.test("offerCheck: unreadable price is reported with the raw value", () => {
  const c = buildOfferCheck({ category: "Barkauf", finance: { totalPrice: "auf Anfrage" }, ...envOk }, "modern");
  assertEquals(c.issues[0].code, "cash_price_unreadable");
  assertEquals(c.issues[0].value, "auf Anfrage");
});

Deno.test("offerCheck: Kia-like leasing with bank text lacking total reports only that", () => {
  const vd = { category: "Leasing", ...envOk,
    finance: { totalPrice: "34.669,20 €", monthlyRate: "249", duration: "36", annualMileage: "10000", specialPayment: "8.625,56 €" },
    dealer: { leasingBank: "Kia Finance", leasingLegalText: "Ein Angebot der Kia Finance, Rate {monatsrate}, Laufzeit {laufzeit}." } };
  const c = buildOfferCheck(vd, "modern");
  assertEquals(c.values.cashPrice, 34669.2);
  assertEquals(c.values.monthlyRate, 249);
  assertEquals(c.values.offerType, "leasing");
  assertEquals(c.issues.map((i) => i.code), ["bank_text_gesamtbetrag_not_mentioned"]);
  assertEquals(c.issues[0].value, "17.589,56 €");
});

Deno.test("offerCheck: bank text with {gesamtbetrag} passes", () => {
  const vd = { category: "Leasing", ...envOk,
    finance: { totalPrice: "34.669,20 €", monthlyRate: "249", duration: "36", annualMileage: "10000", specialPayment: "8.625,56 €" },
    dealer: { leasingBank: "Kia Finance", leasingLegalText: "Ein Angebot der Kia Finance, Rate {monatsrate}, Gesamtbetrag {gesamtbetrag}." } };
  assertEquals(buildOfferCheck(vd, "modern").status, "ok");
});

Deno.test("offerCheck: missing effective rate names exactly that field", () => {
  const c = buildOfferCheck({ ...fullFin, ...envOk, finance: { ...fullFin.finance, interestRate: "" },
    dealer: { ...fullFin.dealer, financingLegalText: "Der Testbank: {monatsrate}, {gesamtbetrag}." } }, "modern");
  assertEquals(c.issues.map((i) => i.code), ["finance_effektiver_zins_missing"]);
  assertEquals(c.values.cashPrice, 30000);
  assertEquals(c.rateVisible, false);
});

Deno.test("offerCheck: missing CO2 class on new car is an envkv error", () => {
  const c = buildOfferCheck({ category: "Barkauf", finance: { totalPrice: "10000" }, consumption: { fuelType: "Benzin", consumptionCombined: "5", co2Emissions: "110" } }, "modern");
  assertEquals(c.issues.map((i) => i.code), ["envkv_co2Class_missing"]);
  assertEquals(c.issues[0].severity, "error");
  assertEquals(c.publishable, true);
});
