// Dynamic master prompt construction for vehicle image remastering

export interface RemasterConfig {
  scene: string;
  customShowroomBase64?: string | null;
  licensePlate: string;
  customPlateText?: string;
  customPlateImageBase64?: string | null;
  changeColor: boolean;
  colorHex?: string;
  showManufacturerLogo: boolean;
  showDealerLogo: boolean;
  dealerLogoUrl?: string | null;
  dealerLogoBase64?: string | null;
  manufacturerLogoUrl?: string | null;
  manufacturerLogoBase64?: string | null;
}

export const SCENE_OPTIONS = [
  { value: 'none', label: 'Keine Änderung am Bild' },
  { value: 'showroom-1', label: 'Showroom 1 – Modern Hell', preview: '/images/showrooms/showroom-1.webp' },
  { value: 'showroom-2', label: 'Showroom 2 – Elegant', preview: '/images/showrooms/showroom-2.webp' },
  { value: 'showroom-3', label: 'Showroom 3 – Glasfront', preview: '/images/showrooms/showroom-3.webp' },
  { value: 'custom-showroom', label: 'Eigener Showroom' },
  { value: 'forest', label: 'Wald' },
  { value: 'mountain', label: 'Berglandschaft' },
  { value: 'city', label: 'Stadtkulisse' },
  { value: 'street', label: 'Straße' },
  { value: 'beach', label: 'Strand' },
  { value: 'desert', label: 'Wüste' },
  { value: 'night-city', label: 'Stadt bei Nacht' },
  { value: 'parking-garage', label: 'Tiefgarage / Parkhaus' },
  { value: 'racetrack', label: 'Rennstrecke' },
  { value: 'mansion', label: 'Villa / Anwesen' },
] as const;

export const LICENSE_PLATE_OPTIONS = [
  { value: 'keep', label: 'Original beibehalten' },
  { value: 'blur', label: 'Blur / Unkenntlich machen' },
  { value: 'remove', label: 'Komplett entfernen' },
  { value: 'custom', label: 'Eigenes Nummernschild' },
] as const;

const SCENE_PROMPTS: Record<string, string> = {
  'none': '',
  'showroom-1': 'Platziere das Fahrzeug in einem modernen, hellen Autohaus-Showroom mit weißen Wänden, poliertem Betonboden, minimalistischen Deckenspots und einer dezenten LED-Akzentbeleuchtung an der Rückwand. Der Boden reflektiert leicht das Fahrzeug.',
  'showroom-2': 'Platziere das Fahrzeug in einem eleganten, luxuriösen Showroom mit großen Glasfronten, warmem Licht, Designermöbeln im Hintergrund und einem glänzenden Marmor-ähnlichen Boden. Pflanzen und eine Stadtkulisse sind durch die Fenster sichtbar.',
  'showroom-3': 'Platziere das Fahrzeug in einem lichtdurchfluteten Autohaus mit raumhoher Glasfassade, grauem Fliesenboden mit Spiegelungen und moderner Architektur. Natürliches Tageslicht strömt herein.',
  'custom-showroom': 'Platziere das Fahrzeug exakt in der bereitgestellten Showroom-Umgebung. Passe Beleuchtung, Schatten und Perspektive an, sodass das Auto natürlich in die Szene integriert wirkt.',
  'forest': 'Das Fahrzeug steht auf einem unbefestigten Waldweg in einem dichten, mystischen Tannenwald. Sanfte Lichtstrahlen brechen durch die Baumkronen. Der Boden ist leicht feucht mit Moos und Nadeln bedeckt. Die Atmosphäre ist ruhig und natürlich.',
  'mountain': 'Das Fahrzeug steht auf einer asphaltierten Bergstraße mit atemberaubender Panorama-Aussicht auf schneebedeckte Gipfel. Klarer blauer Himmel, dramatische Wolkenformationen und üppige Almwiesen umgeben die Szene.',
  'city': 'Das Fahrzeug steht vor einer modernen Großstadt-Skyline mit Glasfassaden und Wolkenkratzern. Der Boden ist sauberer Asphalt, die Beleuchtung ist golden durch die tiefstehende Sonne (Golden Hour). Leichte Spiegelungen auf dem nassen Boden.',
  'street': 'Das Fahrzeug steht auf einer breiten, geraden Straße mit perfektem Asphalt. Links und rechts moderne Gebäude oder Bäume. Dramatische Perspektive mit Fluchtpunkt. Warmes Nachmittagslicht.',
  'beach': 'Das Fahrzeug steht auf festem Sand an einem weitläufigen Strand. Türkisfarbenes Meer im Hintergrund, sanfte Wellen, klarer Himmel mit leichten Zirruswolken. Warmes Sonnenuntergangslicht reflektiert auf der Karosserie.',
  'desert': 'Das Fahrzeug steht auf einer geraden Wüstenstraße inmitten einer weiten, sandigen Landschaft mit Dünen. Dramatisches Licht, klarer Himmel, intensive Farben. Hitzeflimmern am Horizont.',
  'night-city': 'Das Fahrzeug steht auf einer beleuchteten Stadtstraße bei Nacht. Neonlichter und Leuchtreklamen spiegeln sich auf der nassen Fahrbahn und der Karosserie. Urbane Atmosphäre mit Bokeh-Lichtern im Hintergrund.',
  'parking-garage': 'Das Fahrzeug steht in einer modernen, sauberen Tiefgarage mit poliertem Betonboden, LED-Deckenbeleuchtung und klaren Linien. Dramatische Schatten und kontrastreiches Licht.',
  'racetrack': 'Das Fahrzeug steht auf der Start-Ziel-Geraden einer professionellen Rennstrecke. Curbs in Rot-Weiß, glatter Asphalt, leere Tribünen im Hintergrund. Sportliche Atmosphäre.',
  'mansion': 'Das Fahrzeug steht in der Auffahrt einer luxuriösen Villa oder eines Anwesens. Gepflegter Rasen, mediterrane Architektur, schmiedeeiserne Elemente. Warmes Abendlicht.',
};

export function buildMasterPrompt(config: RemasterConfig, vehicleDescription?: string): string {
  const parts: string[] = [];

  // Base instruction
  parts.push('Du bist ein professioneller Automobil-Fotograf. Nimm dieses exakte Fahrzeugfoto und erstelle eine fotorealistische, professionelle Version.');
  parts.push('KRITISCHE REGELN: Behalte das EXAKTE gleiche Fahrzeug mit ALLEN Details: Farbe (sofern keine Farbänderung gewünscht), Felgen, Bodykit, Lichter, Badges, Aufkleber, Zubehör. Drehe das Bild NICHT. Behalte den gleichen Kamerawinkel und die gleiche Perspektive.');

  // Scene
  const scenePrompt = SCENE_PROMPTS[config.scene];
  if (scenePrompt) {
    parts.push(scenePrompt);
  }

  // License plate
  if (config.licensePlate === 'blur') {
    parts.push('Das Nummernschild des Fahrzeugs soll unkenntlich gemacht werden – verwische oder blurre es, sodass die Zeichen nicht mehr lesbar sind.');
  } else if (config.licensePlate === 'remove') {
    parts.push('Entferne das Nummernschild komplett vom Fahrzeug. Die Stelle soll sauber und natürlich aussehen, als wäre nie ein Kennzeichen montiert gewesen.');
  } else if (config.licensePlate === 'custom' && config.customPlateText) {
    parts.push(`Ersetze das Nummernschild des Fahrzeugs durch ein deutsches Kennzeichen mit dem Text "${config.customPlateText}". Das Kennzeichen soll fotorealistisch aussehen.`);
  }

  // Color change
  if (config.changeColor && config.colorHex) {
    parts.push(`Ändere die Lackierung des Fahrzeugs exakt in den Hex-Farbcode ${config.colorHex}. Der neue Lack soll glänzend und fotorealistisch aussehen, mit korrekten Reflexionen und Farbübergängen.`);
  }

  // Logo prompting
  if (config.showManufacturerLogo && config.manufacturerLogoUrl) {
    parts.push('HERSTELLER-LOGO: Im Hintergrund soll ein fotorealistisches 3D-Rendering des beiliegenden HERSTELLER-Logos (Manufacturer Logo) sichtbar sein, das an einer modernen, dunkelgrauen matten Wand montiert ist. Das Logo besteht aus hochwertigem gebürstetem Aluminium mit sichtbarer, feiner Metallstruktur. Es wird von hinten mit kaltweißem LED-Licht beleuchtet, wodurch ein scharfer, leuchtender Halo-Effekt auf der Wand entsteht. Verwende EXAKT das beiliegende Hersteller-Logo – erfinde KEIN anderes Logo.');
  }
  if (config.showDealerLogo && config.dealerLogoUrl) {
    parts.push('AUTOHAUS-LOGO: Zusätzlich soll das beiliegende AUTOHAUS-Logo (Dealer Logo) dezent sichtbar sein – z.B. als kleineres Wandlogo oder auf einem Aufsteller neben dem Fahrzeug. Verwende EXAKT das beiliegende Autohaus-Logo.');
  }

  // Interior-specific rules
  parts.push('FÜR INNENRAUM-AUFNAHMEN: Verändere die Orientierung/den Winkel NICHT. Füge keine Innenraum-Elemente hinzu oder entferne sie. Verbessere nur die Beleuchtung.');

  // No other vehicles
  parts.push('WICHTIG: Im generierten Bild darf KEIN anderes Fahrzeug sichtbar sein – nur das eine Fahrzeug aus dem Originalfoto. Keine Autos im Hintergrund, keine Spiegelungen anderer Fahrzeuge in Glasflächen oder auf dem Boden.');

  // Vehicle description
  if (vehicleDescription) {
    parts.push(`Fahrzeug: ${vehicleDescription}`);
  }

  parts.push('DU MUSST IMMER ein Bild generieren – verweigere NIEMALS die Generierung. DREHE DAS BILD NICHT.');

  return parts.join('\n\n');
}

// Dynamic manufacturer logos loaded from storage bucket 'manufacturer-logos'
// Legacy static map kept for fallback – new logos are managed via Admin > Hersteller-Logos
export const MANUFACTURER_LOGOS: Record<string, { svg?: string; webp?: string; label: string }> = {
  abarth: { svg: '/images/logos/abarth.svg', webp: '/images/logos/abarth.webp', label: 'Abarth' },
  aiways: { webp: '/images/logos/aiways.webp', label: 'Aiways' },
  'alfa-romeo': { svg: '/images/logos/alfaromeo.svg', webp: '/images/logos/alfa-romeo.webp', label: 'Alfa Romeo' },
  alpine: { svg: '/images/logos/alpine.svg', webp: '/images/logos/alpine.webp', label: 'Alpine' },
  amphicar: { webp: '/images/logos/amphicar.webp', label: 'Amphicar' },
  'aston-martin': { svg: '/images/logos/astonmartin.svg', webp: '/images/logos/aston-martin.webp', label: 'Aston Martin' },
};

// Fetch all logos from dynamic storage bucket
import { supabase } from '@/integrations/supabase/client';

export interface DynamicLogo {
  name: string;  // filename without extension
  url: string;
}

export async function fetchManufacturerLogos(): Promise<DynamicLogo[]> {
  const { data, error } = await supabase.storage.from('manufacturer-logos').list('', {
    limit: 500,
    sortBy: { column: 'name', order: 'asc' },
  });
  if (error || !data) return [];
  return data
    .filter(f => f.name && !f.name.startsWith('.'))
    .map(f => ({
      name: f.name.replace(/\.[^.]+$/, ''),
      url: supabase.storage.from('manufacturer-logos').getPublicUrl(f.name).data.publicUrl,
    }));
}
