import { TemplateId } from "@/types/template";
import { VehicleData } from "@/types/vehicle";
import { generateModernHTML } from "./modern";
import { generateSportlichHTML } from "./sportlich";
import { generateKlassischHTML } from "./klassisch";
import { generatePremiumHTML } from "./premium";
import { generateMinimalistHTML } from "./minimalist";
import { generateMagazinHTML } from "./magazin";

type GeneratorFn = (data: VehicleData, imageBase64: string | null, galleryImages?: string[]) => string;

const generators: Record<TemplateId, GeneratorFn> = {
  modern: generateModernHTML,
  sportlich: generateSportlichHTML,
  klassisch: generateKlassischHTML,
  premium: generatePremiumHTML,
  minimalist: generateMinimalistHTML,
  magazin: generateMagazinHTML,
};

export function generateHTML(templateId: TemplateId, data: VehicleData, imageBase64: string | null, galleryImages: string[] = []): string {
  const generator = generators[templateId] || generators.modern;
  return generator(data, imageBase64, galleryImages);
}

export { downloadHTML } from "./download";
