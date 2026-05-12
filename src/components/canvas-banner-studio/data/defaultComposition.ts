import type { BannerComposition, BannerTextFields } from "../state/types";
import { loadTemplateSync } from "./templateRegistry";
import { specToBannerLayers } from "./templateToLayers";

export const DEFAULT_TEXT_FIELDS: BannerTextFields = {
  headline: "DER NEUE VW GOLF",
  subline: "Jetzt sichern mit attraktiver Leasingrate",
  price: "ab 249 € mtl.",
  cta: "Jetzt Angebot anfragen",
  smallInfo: "Nur für kurze Zeit verfügbar",
  legalText:
    "Kraftstoffverbrauch kombiniert: 5,8 l/100 km · CO₂-Emissionen kombiniert: 132 g/km · CO₂-Klasse: D. Ein Angebot der Musterhaus GmbH.",
};

export const buildDefaultComposition = (
  formatId: string,
  templateId = "classic-offer",
  ciLayerOverrides?: Array<{ id: string } & Record<string, unknown>> | null,
): BannerComposition => {
  const { spec } = loadTemplateSync(formatId, templateId);
  return {
    formatId,
    backgroundFit: "cover",
    overlayDirection: "bottom",
    overlayStrength: 50,
    selectedTemplateId: templateId,
    layers: specToBannerLayers(spec, ciLayerOverrides as never),
  };
};
