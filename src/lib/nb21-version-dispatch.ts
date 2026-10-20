import { resolveNb21Version } from '@/prompts/nb21/v2';
export type Nb21PromptVersion = 'nb21-v1' | 'nb21-v2' | 'nb21-v3';
/** Do not modify the historical V2 resolver, which deliberately rejects V3. */
export function resolveStoredNb21Version(ctx?: { promptVersion?: string; modelTier?: string } | null): Nb21PromptVersion | undefined {
  if (ctx?.promptVersion === 'nb21-v3') {
    if (ctx.modelTier && ctx.modelTier !== 'nb21') throw new Error('NB21: Version und Modellstufe widersprechen sich.');
    return 'nb21-v3';
  }
  return resolveNb21Version(ctx);
}
