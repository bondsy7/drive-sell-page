/** Shared V2 wire contract. No image bytes or signed URLs in the manifest. */
export type V2Target = 'exterior' | 'exterior_detail' | 'interior_cabin' | 'interior_detail' | 'cargo_area' | 'wheel_detail' | 'composite';
export type V2SourceType = 'original' | 'immutable asset' | 'generated context';
export interface V2Reference {
  sourceId: string;
  sourceRole: string;
  sourceType: V2SourceType;
  /** Ephemeral bytes/URL. Never copied into telemetry. */
  image: string;
  assetId?: string;
  fileUri?: { uri: string; mimeType: string } | null;
  openAIFile?: { fileId: string; purpose?: string; mimeType?: string } | null;
}
export interface V2ManifestEntry {
  sourceId: string;
  sourceRole: string;
  sourceType: V2SourceType;
  role: string;
  authorityTier: 'A' | 'B' | 'C';
  authority: string;
  assetId?: string;
}
export interface V2Manifest {
  version: 'nb21-v2';
  jobKey: string;
  mode: 'edit' | 'view_synthesis';
  target: V2Target;
  budget: number;
  entries: V2ManifestEntry[];
}
export interface V2WireReference extends V2ManifestEntry {
  transport: 'file_uri' | 'openai_file' | 'inline';
  fileUri?: { uri: string; mimeType: string };
  openAIFile?: { fileId: string; purpose?: string; mimeType?: string };
  imageBase64?: string;
}
export interface V2EvidencePlan { manifest: V2Manifest; references: V2Reference[] }

/** Source roles are explicit slot/analysis assignments, NEVER image indices. */
export function normalizeV2Role(role: string): string {
  return role.toLowerCase().replace(/_/g, '-').trim();
}
export function originalSlotFromFilename(name: string): string | null {
  return name.match(/^\d+-\d+-([a-z0-9-]+)-original\./)?.[1] ?? null;
}
/** Closed target classification, including all existing CI interior suffixes. */
export function classifyV2Target(key: string, category?: string): V2Target {
  const k = key.toUpperCase();
  if (/GRID|COMPOSITE|COLLAGE/.test(k) || category === 'composite') return 'composite';
  if (/BOOT|CARGO|GARAGE/.test(k)) return 'cargo_area';
  if (/WHEEL/.test(k)) return 'wheel_detail';
  if (/STEERING|CLUSTER|SCREEN|MBUX|CONTROLS/.test(k)) return 'interior_detail';
  if (/INT_|INTERIOR|COCKPIT|CABIN/.test(k) || category === 'interior') return 'interior_cabin';
  if (/HEADLIGHT|TAILLIGHT|GRILLE|PANEL|DET_/.test(k) || category === 'detail') return 'exterior_detail';
  return 'exterior';
}

export interface V2Requirement { role: string; slots: string[]; authority: string; required?: boolean }
export interface V2Policy { target: V2Target; budget: number; requirements: V2Requirement[]; wheel: boolean }
const req = (role: string, slots: string[], authority: string, required = true): V2Requirement => ({ role, slots, authority, required });
const FRONT = ['front', '34front', '34front-right', 'front-left', 'front-right'];
const REAR = ['rear', '34rear', '34rear-right', 'rear-left', 'rear-right'];
const COCKPIT = ['cockpit', 'interior-front', 'cabin', 'truck-cab-interior', 'controls'];
export function v2Policy(key: string, category?: string, editSlot?: string): V2Policy {
  const k = key.toUpperCase();
  const target = editSlot ? classifyV2Target(editSlot.toUpperCase().replace(/-/g, '_')) : classifyV2Target(key, category);
  if (editSlot) return { target, budget: 6, wheel: !target.startsWith('interior') && target !== 'cargo_area', requirements: [req('same_view_original', [normalizeV2Role(editSlot)], 'same-view geometry, camera and visible identity')] };
  if (target === 'cargo_area') return { target, budget: 3, wheel: false, requirements: [req('cargo_original', ['cargo', 'boot', 'open-boot', 'cargo-area', 'garage'], 'cargo floor, cover, backrests, hooks and side trim'), req('rear_evidence', REAR, 'hatch, rear lights and surrounding body')] };
  if (target === 'interior_detail') {
    const local = /STEERING/.test(k) ? ['steering', 'steering-wheel'] : /CLUSTER/.test(k) ? ['cluster', 'instrument-cluster', 'steering', 'steering-wheel'] : /SCREEN|MBUX/.test(k) ? ['screen', 'center-screen', 'dashboard'] : ['controls', 'dashboard'];
    return { target, budget: 3, wheel: false, requirements: [req('interior_detail_original', [...local, ...COCKPIT], 'photographed controls, selector, contours, materials and display layout'), req('cabin_evidence', COCKPIT, 'surrounding cabin geometry', false)] };
  }
  if (target === 'interior_cabin') {
    const rear = /REAR|SEAT|FOND/.test(k) && !/FRONT_SEAT/.test(k);
    const specific = /LIVING|KITCHEN|BATH|BED|SLEEPER/.exec(k)?.[0]?.toLowerCase();
    return { target, budget: 3, wheel: false, requirements: [req('cabin_original', specific ? [specific] : rear ? ['interior-rear', 'rear-seats', 'passenger-seat'] : ['dashboard', ...COCKPIT], rear ? 'rear seats, seat orientation, front seat presence, doors and console' : 'cabin architecture, controls, flat console and photographed equipment'), req('cabin_evidence', rear ? COCKPIT : ['interior-rear'], 'other visible cabin surfaces only', false)] };
  }
  if (target === 'wheel_detail') return { target, budget: 3, wheel: true, requirements: [req('wheel_original', ['wheel', 'wheel-detail', 'rim', ...FRONT, 'side', 'side-right'], 'wheel mounting and surrounding body')] };
  if (target === 'exterior_detail') {
    const back = /TAIL|REAR/.test(k);
    const local = /HEADLIGHT/.test(k) ? ['headlight', 'headlight-detail'] : /TAIL/.test(k) ? ['taillight', 'taillight-detail'] : /GRILLE|PANEL/.test(k) ? ['frontpanel', 'grille', 'front-panel'] : [k.toLowerCase().replace(/_/g, '-')];
    return { target, budget: 3, wheel: false, requirements: [req('local_detail_original', [...local, ...(back ? REAR : FRONT)], 'local part outline, light signature, texture, badge and adjacent body'), req('geometry_evidence', back ? REAR : FRONT, 'part position on photographed body', false)] };
  }
  if (target === 'composite' && /INTERIOR/.test(k)) return { target, budget: 3, wheel: false, requirements: [req('cabin_original', COCKPIT, 'cockpit and front cabin panels'), req('rear_cabin_original', ['interior-rear','rear-seats'], 'rear cabin panels')] };
  if (target === 'composite') return { target, budget: 6, wheel: true, requirements: [req('front_original', FRONT, 'front identity'), req('side_original', ['side', 'side-left'], 'left body identity'), req('rear_original', REAR, 'rear identity')] };
  const right = /RIGHT/.test(k), rear = /REAR/.test(k), side = /SIDE/.test(k);
  const flank = right ? ['side-right', 'side-right-full', 'truck-cab-side-right'] : ['side', 'side-left', 'truck-cab-side-left'];
  if (side) return { target, budget: 4, wheel: true, requirements: [req('physical_side_original', flank, `${right ? 'RIGHT' : 'LEFT'} physical flank and asymmetric equipment`), req('front_evidence', FRONT, 'front transition', false), req('rear_evidence', REAR, 'rear transition', false)] };
  if (rear) return { target, budget: 4, wheel: true, requirements: [req('rear_original', right ? ['34rear-right', ...REAR] : ['34rear', ...REAR], 'rear fascia and attached equipment'), req('physical_side_original', flank, `${right ? 'RIGHT' : 'LEFT'} flank`, /34/.test(k))] };
  return { target, budget: 5, wheel: true, requirements: [req('front_original', right ? ['34front-right', ...FRONT] : FRONT, 'complete connected front fascia and body generation'), req('front_detail_evidence', ['frontpanel', 'grille', 'headlight', ...FRONT], 'panel, headlamp signature, sensors and bumper transitions', false), req('geometry_evidence', flank, 'silhouette and physical side geometry', false)] };
}

/** Required originals selected before any context. Unknown detail slots are not guessed. */
export function resolveV2Evidence(args: { jobKey: string; category?: string; sources: V2Reference[]; editSlot?: string }): V2EvidencePlan {
  const p = v2Policy(args.jobKey, args.category, args.editSlot);
  const entries: V2ManifestEntry[] = [], references: V2Reference[] = [];
  const used = new Set<string>();
  const add = (s: V2Reference, role: string, authority: string) => {
    entries.push({ sourceId: s.sourceId, sourceRole: s.sourceRole, sourceType: s.sourceType, assetId: s.assetId, role, authorityTier: s.sourceType === 'original' ? 'A' : s.sourceType === 'immutable asset' ? 'B' : 'C', authority });
    references.push(s); used.add(s.sourceId);
  };
  const originals = args.sources.filter(s => s.sourceType === 'original' && s.image).sort((a, b) => a.sourceId.localeCompare(b.sourceId));
  for (const requirement of p.requirements) {
    const candidates = requirement.slots.flatMap(slot => originals.filter(s => normalizeV2Role(s.sourceRole) === slot));
    const hit = candidates.find(s => !used.has(s.sourceId));
    if (hit) add(hit, requirement.role, requirement.authority);
    else if (requirement.required && !candidates.some(s => used.has(s.sourceId))) throw new Error(`NB21 v2: Originalbeleg fehlt (${requirement.role}); keine Rekonstruktion aus generiertem Kontext.`);
  }
  const auxiliary = args.sources.filter(s => s.sourceType !== 'original' && s.image).sort((a, b) => a.sourceId.localeCompare(b.sourceId));
  const interiorOutput = p.target.startsWith('interior') || (p.target === 'composite' && /INTERIOR/.test(args.jobKey));
  const scopedAssets = auxiliary.filter(s => s.sourceType === 'immutable asset' && ['wheel', 'plate', 'manufacturer-logo', 'dealer-logo'].includes(normalizeV2Role(s.sourceRole)) && !(normalizeV2Role(s.sourceRole) === 'wheel' && !p.wheel) && !(normalizeV2Role(s.sourceRole) === 'plate' && (interiorOutput || p.target === 'cargo_area')));
  // Geometry budget and scoped asset allowance are distinct: logos never displace
  // original evidence or the selected environment. Total remains at most 8 images.
  const budget = Math.min(8, p.budget + scopedAssets.length);
  // Scope-specific immutable evidence before low-priority scene context.
  for (const s of scopedAssets) {
    const role = normalizeV2Role(s.sourceRole);
    if (role === 'wheel' && !p.wheel) continue;
    if (role === 'plate' && (p.target.startsWith('interior') || p.target === 'cargo_area')) continue;
    if (!['wheel', 'plate', 'manufacturer-logo', 'dealer-logo'].includes(role)) continue;
    if (entries.length < budget - 1) add(s, role, `immutable ${role} pixels only; no other vehicle authority`);
  }
  // At most one generated/scene context; it can never fill a missing original role.
  const context = auxiliary.find(s => s.sourceType === 'generated context' && normalizeV2Role(s.sourceRole) === 'environment') ?? auxiliary.find(s => s.sourceType === 'generated context');
  if (context && entries.length < budget) add(context, 'presentation_context', 'environment, lighting, look and coarse composition ONLY; never identity');
  return { manifest: { version: 'nb21-v2', jobKey: args.jobKey, mode: args.editSlot ? 'edit' : 'view_synthesis', target: p.target, budget, entries }, references };
}

/** Ordered wire entries are never split into independent positional pools. */
export function wireV2Evidence(plan: V2EvidencePlan, prefer: 'gemini' | 'openai' | 'inline' = 'gemini'): V2WireReference[] {
  return plan.references.map((s, i) => {
    const entry = plan.manifest.entries[i];
    if (!entry || entry.sourceId !== s.sourceId) throw new Error('NB21 v2: Manifest/Bildzuordnung ungleich.');
    if (prefer === 'openai' && s.openAIFile?.fileId) return { ...entry, transport: 'openai_file', openAIFile: s.openAIFile };
    if (prefer !== 'inline' && s.fileUri?.uri) return { ...entry, transport: 'file_uri', fileUri: s.fileUri };
    return { ...entry, transport: 'inline', imageBase64: s.image };
  });
}