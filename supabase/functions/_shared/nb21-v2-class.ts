/** Compact V2-only class invariant, shared by prompt builder and server. */
export interface V2SubjectClass {
  vehicleClass?: string;
  motorhomeBodyType?: string | null;
  truckConfiguration?: string | null;
  truckBodyType?: string | null;
  subjectScope?: string | null;
}
const CLASSES: Record<string, string> = {
  car: 'passenger car', van: 'van/transporter', motorhome: 'motorhome',
  caravan: 'caravan (towable, no powered cab)', motorcycle: 'motorcycle',
  truck: 'truck', machinery: 'machinery', trailer: 'trailer (no powered cab)',
};
export function buildV2SubjectClassLock(context?: V2SubjectClass | null): string {
  const key = context?.vehicleClass ?? 'car';
  if (!CLASSES[key]) throw new Error('NB21 v2: Unbekannte Fahrzeugklasse.');
  const caravan = key === 'motorhome' && context?.motorhomeBodyType === 'caravan';
  const trailer = key === 'truck' && context?.truckConfiguration === 'trailer_only';
  const label = caravan ? CLASSES.caravan : trailer ? CLASSES.trailer : CLASSES[key];
  const construction = [context?.motorhomeBodyType, context?.truckConfiguration, context?.truckBodyType, context?.subjectScope].filter(Boolean).join(', ');
  return `<NB21_V2_SUBJECT_CLASS_LOCK>\nSubject class: ${label}${construction ? `; construction/scope: ${construction}` : ''}. Preserve the exact photographed class, body construction and attached equipment from Tier A original evidence; never substitute another vehicle class or body type. Reference Evidence overrides model/brand knowledge, including when the selected category is broader than the photographed subject. This lock does not restrict the requested camera, environment, lighting, cleanup or explicitly allowed surface changes.\n</NB21_V2_SUBJECT_CLASS_LOCK>`;
}

/** Replace client claims with the server context; older V2 clients also get the lock. */
export function enforceV2SubjectClassLock(prompt: string, context?: V2SubjectClass | null): string {
  const clean = prompt.replace(/<NB21_V2_SUBJECT_CLASS_LOCK>[\s\S]*?<\/NB21_V2_SUBJECT_CLASS_LOCK>\n?/g, '');
  const header = '### SECTION 4/9: VEHICLE IDENTITY LOCK\n';
  if (!clean.includes(header)) throw new Error('NB21 v2: Identitätsabschnitt fehlt.');
  return clean.replace(header, () => `${header}${buildV2SubjectClassLock(context)}\n`);
}