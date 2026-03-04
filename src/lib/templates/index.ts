import { TemplateId } from "@/types/template";
import { VehicleData } from "@/types/vehicle";
import { generateModernHTML } from "./modern";
import { generateSportlichHTML } from "./sportlich";
import { generateKlassischHTML } from "./klassisch";
import { generatePremiumHTML } from "./premium";
import { generateMinimalistHTML } from "./minimalist";
import { generateMagazinHTML } from "./magazin";
import { buildContactFormHTML, ContactFormOptions } from "./shared";

type GeneratorFn = (data: VehicleData, imageBase64: string | null, galleryImages?: string[]) => string;

const generators: Record<TemplateId, GeneratorFn> = {
  modern: generateModernHTML,
  sportlich: generateSportlichHTML,
  klassisch: generateKlassischHTML,
  premium: generatePremiumHTML,
  minimalist: generateMinimalistHTML,
  magazin: generateMagazinHTML,
};

export interface GenerateHTMLOptions {
  contactForm?: ContactFormOptions;
}

export function generateHTML(
  templateId: TemplateId,
  data: VehicleData,
  imageBase64: string | null,
  galleryImages: string[] = [],
  options?: GenerateHTMLOptions
): string {
  const generator = generators[templateId] || generators.modern;
  let html = generator(data, imageBase64, galleryImages);

  // Inject contact form before </body>
  if (options?.contactForm) {
    const formHTML = buildContactFormHTML(options.contactForm);
    html = html.replace('</body>', formHTML + '\n</body>');
  }

  return html;
}

export { downloadHTML } from "./download";
