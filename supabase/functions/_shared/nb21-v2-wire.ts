import { normalizeV2Role, type V2Manifest, type V2WireReference } from './nb21-v2-contract.ts';

/** Validate exactly the objects used to construct outgoing provider parts. */
export function validateV2Wire(manifest: V2Manifest, refs: V2WireReference[]) {
  if (!manifest || manifest.version !== 'nb21-v2' || !Array.isArray(refs) || !refs.length || refs.length > manifest.budget || manifest.budget > 8) throw new Error('NB21 v2: Ungültiges Referenzbudget.');
  if (!Array.isArray(manifest.entries) || manifest.entries.length !== refs.length) throw new Error('NB21 v2: Manifest/Bilder ungleich.');
  if (!['edit', 'view_synthesis'].includes(manifest.mode)) throw new Error('NB21 v2: Modus fehlt.');
  const ids = new Set<string>();
  for (const [i, r] of refs.entries()) {
    const m = manifest.entries[i];
    // Compare fields, not insertion order; no payload bytes belong to metadata.
    if (!m || ['sourceId','sourceRole','sourceType','role','authorityTier','authority','assetId'].some(k => (m as any)[k] !== (r as any)[k])) throw new Error('NB21 v2: Referenzidentität stimmt nicht.');
    if (ids.has(r.sourceId) || !r.sourceId || !r.sourceRole) throw new Error('NB21 v2: Doppelte/fehlende Referenzidentität.');
    ids.add(r.sourceId);
    const tier = r.sourceType === 'original' ? 'A' : r.sourceType === 'immutable asset' ? 'B' : r.sourceType === 'generated context' ? 'C' : null;
    if (!tier || r.authorityTier !== tier) throw new Error('NB21 v2: Falsche Autorität.');
    if (tier === 'C' && r.role !== 'presentation_context') throw new Error('NB21 v2: Generierter Kontext darf keine Identitätsrolle erhalten.');
    if (manifest.target.startsWith('interior') && (r.sourceType === 'original' && !/interior|cockpit|cabin|steering|cluster|screen|dashboard|seat|controls|living|kitchen|bath|bed|sleeper|mbux|passenger/.test(normalizeV2Role(r.sourceRole)) || normalizeV2Role(r.sourceRole) === 'wheel')) throw new Error('NB21 v2: Unzulässige Innenraumautorität.');
    if (r.transport === 'file_uri' ? !r.fileUri?.uri : r.transport === 'openai_file' ? !r.openAIFile?.fileId : r.transport === 'inline' ? !r.imageBase64 : true) throw new Error('NB21 v2: Bildtransport fehlt.');
  }
  if (!refs.some(r => r.authorityTier === 'A')) throw new Error('NB21 v2: Originalbeleg fehlt.');
  if (manifest.mode === 'view_synthesis' && manifest.target === 'cargo_area' && !['cargo_original','rear_evidence'].every(role => refs.some(r => r.role === role && r.authorityTier === 'A'))) throw new Error('NB21 v2: Cargo und Heckbeleg erforderlich.');
}

export async function v2TransportManifest(refs: V2WireReference[]) {
  return Promise.all(refs.map(async ({ imageBase64, fileUri, openAIFile, ...safe }, index) => {
    const raw = imageBase64?.split(',').pop() ?? '';
    const hash = raw ? Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(raw)))).map(b => b.toString(16).padStart(2, '0')).join('') : undefined;
    return { ...safe, providerImageIndex: index + 1, fileIdentifier: fileUri?.uri?.split('?')[0] ?? openAIFile?.fileId, inlineSha256: hash, inlineEncodedBytes: raw.length || undefined };
  }));
}