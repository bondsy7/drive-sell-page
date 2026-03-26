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
  'showroom-1': 'SHOWROOM-KONSISTENZ (PFLICHT): Platziere das Fahrzeug in einem modernen, hellen Autohaus-Showroom. Der Showroom hat IMMER: weiße Wände, polierter hellgrauer Betonboden mit dezenten Reflexionen, minimalistische LED-Deckenspots, dezente LED-Akzentbeleuchtung an der Rückwand. Verwende auf JEDEM Bild EXAKT denselben Showroom – gleiche Wände, gleicher Boden, gleiche Fenster, gleiche Beleuchtung. Es muss aussehen wie derselbe physische Raum.',
  'showroom-2': 'SHOWROOM-KONSISTENZ (PFLICHT): Platziere das Fahrzeug in einem eleganten, luxuriösen Showroom. Der Showroom hat IMMER: große Glasfronten, warmes Licht, Designermöbel im Hintergrund, glänzender Marmor-ähnlicher Boden. Verwende auf JEDEM Bild EXAKT denselben Showroom – gleiche Architektur, gleicher Boden, gleiche Fenster.',
  'showroom-3': 'SHOWROOM-KONSISTENZ (PFLICHT): Platziere das Fahrzeug in einem lichtdurchfluteten Autohaus mit raumhoher Glasfassade. Der Showroom hat IMMER: dunkelgraue matte Rückwand, grauer Fliesenboden mit Spiegelungen, raumhohe Glasfenster links, moderne LED-Deckenbeleuchtung. Verwende auf JEDEM Bild EXAKT denselben Showroom.',
  'custom-showroom': 'Platziere das Fahrzeug exakt in der bereitgestellten Showroom-Umgebung. Passe Beleuchtung, Schatten und Perspektive an, sodass das Auto natürlich in die Szene integriert wirkt. Verwende auf JEDEM Bild EXAKT denselben Showroom-Hintergrund.',
  'forest': 'Das Fahrzeug steht auf einem unbefestigten Waldweg in einem dichten, mystischen Tannenwald. Sanfte Lichtstrahlen brechen durch die Baumkronen. Der Boden ist leicht feucht mit Moos und Nadeln bedeckt.',
  'mountain': 'Das Fahrzeug steht auf einer asphaltierten Bergstraße mit atemberaubender Panorama-Aussicht auf schneebedeckte Gipfel. Klarer blauer Himmel, dramatische Wolkenformationen.',
  'city': 'Das Fahrzeug steht vor einer modernen Großstadt-Skyline mit Glasfassaden und Wolkenkratzern. Sauberer Asphalt, Golden Hour Beleuchtung.',
  'street': 'Das Fahrzeug steht auf einer breiten, geraden Straße mit perfektem Asphalt. Dramatische Perspektive mit Fluchtpunkt. Warmes Nachmittagslicht.',
  'beach': 'Das Fahrzeug steht auf festem Sand an einem weitläufigen Strand. Türkisfarbenes Meer im Hintergrund, sanfte Wellen, warmes Sonnenuntergangslicht.',
  'desert': 'Das Fahrzeug steht auf einer geraden Wüstenstraße inmitten einer weiten, sandigen Landschaft mit Dünen. Dramatisches Licht, klarer Himmel.',
  'night-city': 'Das Fahrzeug steht auf einer beleuchteten Stadtstraße bei Nacht. Neonlichter und Leuchtreklamen spiegeln sich auf der nassen Fahrbahn und der Karosserie.',
  'parking-garage': 'Das Fahrzeug steht in einer modernen, sauberen Tiefgarage mit poliertem Betonboden, LED-Deckenbeleuchtung und klaren Linien.',
  'racetrack': 'Das Fahrzeug steht auf der Start-Ziel-Geraden einer professionellen Rennstrecke. Curbs in Rot-Weiß, glatter Asphalt.',
  'mansion': 'Das Fahrzeug steht in der Auffahrt einer luxuriösen Villa. Gepflegter Rasen, mediterrane Architektur, warmes Abendlicht.',
};

export function buildMasterPrompt(config: RemasterConfig, vehicleDescription?: string): string {
  const parts: string[] = [];

  // Base instruction & Identity Lock
  parts.push('Du bist ein professioneller Automobil-Fotograf. Nimm dieses exakte Fahrzeugfoto und erstelle eine fotorealistische, professionelle Version.');

  parts.push(`IDENTITY LOCK (PFLICHT – studiere ALLE Referenzbilder und Detailaufnahmen genau):
- LACKFARBE: Reproduziere die EXAKTE Lackfarbe, den Farbton und die Oberflächenbeschaffenheit (Metallic/Matt/Perleffekt) aus dem Original. ${config.changeColor && config.colorHex ? '' : 'Verändere die Farbe NICHT – kein Verschieben, Sättigen, Entsättigen, Aufhellen oder Abdunkeln. Dies gilt für ALLE Karosserieteile, Stoßstangen, Spiegel und lackierten Oberflächen.'}
- FELGEN: Reproduziere das EXAKTE Felgendesign – Speichenanzahl, Speichenform, Tiefe, Oberfläche (poliert, matt, bi-color, diamantgeschliffen), Nabenkappe mit Markenlogo. Zeige das exakte Reifenprofil und sichtbare Bremssättel (Farbe, Form). Schneide NIEMALS Räder am Bildrand ab.
- SCHEINWERFER & RÜCKLICHTER: Reproduziere die EXAKTE interne LED-Struktur, DRL-Signaturen, Linsenform und Gehäusedesign. Schneide NIEMALS Lichter ab oder verändere sie.
- KÜHLERGRILL & EMBLEME: Reproduziere das EXAKTE Grill-Muster, Badge-Form, Material und jede Modellbezeichnung in exakter Position, Größe und Schriftart.
- KAROSSERIE-DETAILS: Reproduziere EXAKTE Linienführung, Falze, Kotflügelverbreiterungen, Lufteinlässe, Dachreling, Spoiler, Auspuffblenden, Spiegelform, Türgriffe.
- MATERIALIEN: Reproduziere exakte Oberflächenbeschaffenheiten – Chrom vs. Hochglanz-Schwarz vs. Matt vs. Satin.`);

  parts.push(`ANTI-CROPPING (ABSOLUT VERBOTEN):
- Das Fahrzeug muss VOLLSTÄNDIG im Bild sichtbar sein – KEIN Teil darf am Bildrand abgeschnitten werden
- ALLE Scheinwerfer müssen KOMPLETT sichtbar sein – schneide NIEMALS einen Scheinwerfer ab oder verdecke ihn
- ALLE Rücklichter müssen KOMPLETT sichtbar sein – schneide NIEMALS ein Rücklicht ab
- ALLE Räder müssen KOMPLETT sichtbar sein – schneide NIEMALS ein Rad am Bildrand ab
- Halte mindestens 5% Freiraum zwischen Fahrzeugkante und Bildrand auf allen Seiten
- Dies gilt für JEDE Perspektive: Front, Heck, Seite, 3/4-Ansichten`);

  parts.push(`NEGATIVE CONSTRAINTS (NIEMALS):
- Erfinde, ergänze oder halluziniere KEINE Details die nicht in den Referenzfotos sichtbar sind
- Vereinfache KEINE komplexen Details (Mehrspeichen-Felgen behalten alle Speichen, LED-Arrays alle Elemente)
- Verändere NICHT die Proportionen, Bodenfreiheit oder Stance des Fahrzeugs
- Füge KEINE Anbauteile oder Modifikationen hinzu die nicht im Original vorhanden sind
- Zeige KEINE anderen Fahrzeuge – nicht im Hintergrund, nicht in Reflexionen
- Füge KEINE Menschen, Tiere oder bewegte Objekte hinzu
- Übernimm KEINE Reflexionen aus der Original-Umgebung – rendere ALLE Reflexionen NEU für die Zielszene
- Drehe, spiegele oder flippe das Bild NICHT`);

  // Reflection & lighting re-render
  parts.push('REFLEXIONEN & BELEUCHTUNG: ALLE Reflexionen auf Lack, Glas, Chrom und Fenstern müssen KOMPLETT NEU gerendert werden für die NEUE Szene. Original-Hintergrund-Reflexionen (Bäume, Gebäude, Personen, andere Autos) müssen vollständig ersetzt werden. Lichtquellen, Schatten und Umgebungslicht müssen für die neue Umgebung neu berechnet werden.');

  // Scene
  const scenePrompt = SCENE_PROMPTS[config.scene];
  if (scenePrompt) {
    parts.push(scenePrompt);
  }

  // License plate – default is ALWAYS remove
  if (config.licensePlate === 'blur') {
    parts.push('Das Nummernschild des Fahrzeugs soll unkenntlich gemacht werden – verwische oder blurre es, sodass die Zeichen nicht mehr lesbar sind.');
  } else if (config.licensePlate === 'custom' && config.customPlateText) {
    parts.push(`Ersetze das Nummernschild des Fahrzeugs durch ein deutsches Kennzeichen mit dem Text "${config.customPlateText}". Das Kennzeichen soll fotorealistisch aussehen.`);
  }

  // Color change
  if (config.changeColor && config.colorHex) {
    parts.push(`Ändere die Lackierung des Fahrzeugs exakt in den Hex-Farbcode ${config.colorHex}. Der neue Lack soll glänzend und fotorealistisch aussehen, mit korrekten Reflexionen und Farbübergängen.`);
  }

  // Logo prompting – enforce EXACT same rendering on EVERY image
  if (config.showManufacturerLogo && config.manufacturerLogoUrl) {
    parts.push(`HERSTELLER-LOGO (PFLICHT – IDENTISCH AUF JEDEM BILD):
- Verwende AUSSCHLIESSLICH das beiliegende Hersteller-Logo-Bild als Vorlage
- Rendere das Logo als fotorealistisches 3D-Objekt aus gebürstetem Aluminium mit feiner sichtbarer Metallstruktur
- Montiere es IMMER an derselben Position: mittig an der Rückwand des Showrooms, auf Augenhöhe, leicht oberhalb des Fahrzeugdachs
- Beleuchte es IMMER identisch: kaltweißes LED-Licht von hinten mit scharfem, leuchtenden Halo-Effekt auf der dunkelgrauen matten Wand
- Das Logo muss auf JEDEM Bild EXAKT gleich aussehen: gleiche Größe (ca. 60-80cm Durchmesser), gleiche Position, gleiche Beleuchtung, gleiches Material
- VERBOTEN: Erfinde KEIN alternatives Logo, ändere NICHT die Form, Farbe oder Proportionen des Logos, zeige NICHT nur Teile des Logos
- VERBOTEN: Zeige das Logo NICHT als flaches Bild/Poster/Aufkleber – es muss IMMER ein 3D-Objekt aus Metall sein
- VERBOTEN: Füge KEINEN Text hinzu der nicht im Original-Logo enthalten ist`);
  }
  if (config.showDealerLogo && config.dealerLogoUrl) {
    parts.push(`AUTOHAUS-LOGO (PFLICHT – IDENTISCH AUF JEDEM BILD):
- Verwende AUSSCHLIESSLICH das beiliegende Autohaus-Logo-Bild als Vorlage
- Rendere es als beleuchtetes Wandlogo aus gebürstetem Aluminium, kleiner als das Hersteller-Logo
- Montiere es IMMER an derselben Position: rechts neben dem Hersteller-Logo oder an einer Seitenwand
- VERBOTEN: Erfinde KEIN alternatives Logo, ändere NICHT die Form, Farbe oder Proportionen`);
  }

  // Interior-specific rules – must override scene prompts
  parts.push(`FÜR INNENRAUM-AUFNAHMEN (Sitze, Lenkrad, Armaturenbrett, Mittelkonsole, Kofferraum, Rücksitze):
- IGNORIERE alle Showroom- und Hintergrund-Anweisungen komplett
- Verändere die Orientierung/den Winkel NICHT – drehe, spiegele oder flippe NICHT
- Ändere den Hintergrund/die Umgebung NICHT
- Füge keine Innenraum-Elemente hinzu oder entferne sie
- Reproduziere EXAKTE Materialien: Ledernarbung, Nähte, Zierleisten, Tastenlayouts, Bildschirm-UI aus den Referenzfotos
- Verbessere NUR die Beleuchtung – hell, gleichmäßig und professionell`);

  // Interior cleanup (MANDATORY)
  parts.push(`INTERIEUR-AUFRÄUMUNG (PFLICHT):
- Entferne ALLE Gegenstände die NICHT zum Fahrzeug gehören: Müll, Tüten, Papiere, Plastikfolien, Transportverpackungen, persönliche Gegenstände, lose Gegenstände auf Sitzen oder Fußmatten, Anhänger, Aufkleber, Warnetiketten (außer fest montierte Fahrzeug-Labels)
- Räume SOWOHL Vordersitze ALS AUCH Rücksitze gleichermaßen auf
- Die gesamte Kabine muss showroom-fertig und professionell aufbereitet aussehen
- Sitze, Fußmatten und Oberflächen sollen sauber, makellos und detailreich wirken`);

  // No other vehicles
  parts.push('WICHTIG: Im generierten Bild darf KEIN anderes Fahrzeug sichtbar sein – nur das eine Fahrzeug aus dem Originalfoto. Keine Autos im Hintergrund, keine Spiegelungen anderer Fahrzeuge.');

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

  // Group files by base name, prefer PNG > WebP > JPG (never SVG for AI generation)
  const RASTER_EXTS = ['.png', '.webp', '.jpg', '.jpeg'];
  const byName = new Map<string, { name: string; ext: string; fullName: string }>();

  for (const f of data) {
    if (!f.name || f.name.startsWith('.')) continue;
    const ext = f.name.substring(f.name.lastIndexOf('.')).toLowerCase();
    // Skip SVG – Gemini cannot process vector graphics
    if (ext === '.svg') continue;
    if (!RASTER_EXTS.includes(ext)) continue;
    const baseName = f.name.replace(/\.[^.]+$/, '').toLowerCase();
    const existing = byName.get(baseName);
    // Priority: png > webp > jpg/jpeg
    const priority = (e: string) => e === '.png' ? 0 : e === '.webp' ? 1 : 2;
    if (!existing || priority(ext) < priority(existing.ext)) {
      byName.set(baseName, { name: baseName, ext, fullName: f.name });
    }
  }

  return Array.from(byName.values()).map(entry => ({
    name: entry.name,
    url: supabase.storage.from('manufacturer-logos').getPublicUrl(entry.fullName).data.publicUrl,
  }));
}
