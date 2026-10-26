/** Shared section order for the editor canvas and HTML export (incl. the live inventory block). */
export const LIVE_BLOCK_ID = 'live-fahrzeuge';
export const LIVE_AT_START = '@start';

type Ordered = { sections: { id: string }[]; liveInventoryAfter?: string };

/** Index in `sections` before which the live block renders (sections.length = end, legacy default). */
export function liveInsertIndex(content: Ordered): number {
  const after = content.liveInventoryAfter;
  if (!after) return content.sections.length;
  if (after === LIVE_AT_START) return 0;
  const i = content.sections.findIndex(s => s.id === after);
  return i < 0 ? content.sections.length : i + 1;
}

/** Moves `dragId` before/after `targetId`; either may be the live block. Returns the patched fields. */
export function reorderSections<T extends Ordered>(content: T, dragId: string, targetId: string, position: 'before' | 'after'): Pick<T, 'sections' | 'liveInventoryAfter'> {
  const ids = content.sections.map(s => s.id);
  ids.splice(liveInsertIndex(content), 0, LIVE_BLOCK_ID);
  if (dragId === targetId || !ids.includes(dragId) || !ids.includes(targetId)) {
    return { sections: content.sections, liveInventoryAfter: content.liveInventoryAfter } as any;
  }
  const order = ids.filter(id => id !== dragId);
  const t = order.indexOf(targetId);
  order.splice(position === 'before' ? t : t + 1, 0, dragId);
  const byId = new Map(content.sections.map(s => [s.id, s]));
  const sections = order.filter(id => id !== LIVE_BLOCK_ID).map(id => byId.get(id)!);
  const li = order.indexOf(LIVE_BLOCK_ID);
  const liveInventoryAfter = li === order.length - 1 ? undefined : li === 0 ? LIVE_AT_START : order[li - 1];
  return { sections, liveInventoryAfter } as any;
}
