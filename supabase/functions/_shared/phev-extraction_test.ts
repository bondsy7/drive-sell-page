import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { mergeMissingPhevValues, missingPhevDischargedFields } from "./phev-extraction.ts";

Deno.test("PHEV retry is required only when discharged consumption or CO2 is missing", () => {
  assertEquals(missingPhevDischargedFields({ isPluginHybrid: true }), [
    "consumptionCombinedDischarged",
    "co2EmissionsDischarged",
  ]);
  assertEquals(missingPhevDischargedFields({
    isPluginHybrid: true,
    consumptionCombinedDischarged: "8,4 l/100km",
    co2EmissionsDischarged: "171 g/km",
  }), []);
  assertEquals(missingPhevDischargedFields({ isPluginHybrid: false }), []);
});

Deno.test("document retry fills missing values without overwriting existing data", () => {
  const consumption = {
    isPluginHybrid: true,
    consumptionCombinedDischarged: "8,4 l/100km",
    co2EmissionsDischarged: "",
    co2ClassDischarged: "",
  };
  const merged = mergeMissingPhevValues(consumption, {
    consumptionCombinedDischarged: "99,9 l/100km",
    co2EmissionsDischarged: "171 g/km",
    co2ClassDischarged: "F",
  });
  assertEquals(merged, ["co2EmissionsDischarged", "co2ClassDischarged"]);
  assertEquals(consumption, {
    isPluginHybrid: true,
    consumptionCombinedDischarged: "8,4 l/100km",
    co2EmissionsDischarged: "171 g/km",
    co2ClassDischarged: "F",
  });
});

Deno.test("document retry ignores blank or non-string values", () => {
  const consumption = { isPluginHybrid: true };
  assertEquals(mergeMissingPhevValues(consumption, {
    consumptionCombinedDischarged: " ",
    co2EmissionsDischarged: 171,
    co2ClassDischarged: null,
  }), []);
  assertEquals(consumption, { isPluginHybrid: true });
});
