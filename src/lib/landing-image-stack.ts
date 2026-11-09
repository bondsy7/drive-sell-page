import type { LandingPageContent } from '@/lib/landing-page-builder';

/** Marker for the section's original image inside an image stack. */
export const STACK_MAIN = '@main';
/** Minimum vertical gap between stacked image blocks (px). */
export const STACK_GAP_PX = 10;

const SEP = '::img-';

export function getImageStack(content: Pick<LandingPageContent, 'imageStacks'>, sectionId: string): string[] {
  const s = content.imageStacks?.[sectionId];
  return s && s.length ? s : [STACK_MAIN];
}

/** Image map key for a stack entry (the main entry uses the section id). */
export function stackImageKey(sectionId: string, entry: string): string {
  return entry === STACK_MAIN ? sectionId : entry;
}

export function newStackImageId(sectionId: string): string {
  return `${sectionId}${SEP}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

export function sectionOfImageId(id: string): string {
  const i = id.indexOf(SEP);
  return i < 0 ? id : id.slice(0, i);
}

export function isStackImageId(id: string): boolean {
  return id.includes(SEP);
}

export function insertStackImage(
  content: LandingPageContent, sectionId: string, anchor: string, pos: 'before' | 'after', newId: string,
): LandingPageContent {
  const stack = [...getImageStack(content, sectionId)];
  if (stack.includes(newId)) return content;
  const at = stack.indexOf(anchor);
  const idx = at < 0 ? (pos === 'before' ? 0 : stack.length) : (pos === 'before' ? at : at + 1);
  stack.splice(idx, 0, newId);
  return { ...content, imageStacks: { ...(content.imageStacks || {}), [sectionId]: stack } };
}

export function removeStackImage<T extends { content: LandingPageContent; images: Record<string, string> }>(
  state: T, id: string,
): T {
  const sectionId = sectionOfImageId(id);
  const stack = getImageStack(state.content, sectionId).filter(e => e !== id);
  const images = { ...state.images }; delete images[id];
  const imageFrames = { ...(state.content.imageFrames || {}) }; delete imageFrames[id];
  const imageSources = { ...(state.content.imageSources || {}) }; delete imageSources[id];
  return {
    ...state,
    images,
    content: { ...state.content, imageFrames, imageSources, imageStacks: { ...(state.content.imageStacks || {}), [sectionId]: stack } },
  };
}

/** Extra (inserted) images of a section that actually have a URL. */
export function hasExtraImages(content: LandingPageContent, images: Record<string, string>, sectionId: string): boolean {
  return getImageStack(content, sectionId).some(e => e !== STACK_MAIN && !!images[e]);
}

/**
 * Move one image block (main or inserted) into another section. The image is
 * re-keyed under the target section so URL, frame and provenance travel with it.
 * 'end' appends (moving up), 'start' prepends (moving down).
 */
export function moveStackImageToSection<T extends { content: LandingPageContent; images: Record<string, string> }>(
  state: T, fromSection: string, entry: string, toSection: string, at: 'start' | 'end', newId = newStackImageId(toSection),
): T {
  const key = stackImageKey(fromSection, entry);
  const url = state.images[key];
  if (!url || fromSection === toSection) return state;
  const images = { ...state.images }; delete images[key]; images[newId] = url;
  const imageFrames = { ...(state.content.imageFrames || {}) };
  const imageSources = { ...(state.content.imageSources || {}) };
  if (imageFrames[key]) imageFrames[newId] = imageFrames[key];
  if (imageSources[key]) imageSources[newId] = imageSources[key];
  delete imageFrames[key]; delete imageSources[key];
  const fromStack = getImageStack(state.content, fromSection).filter(e => e !== entry);
  const toStack = [...getImageStack(state.content, toSection)];
  if (at === 'start') toStack.unshift(newId); else toStack.push(newId);
  return {
    ...state,
    images,
    content: {
      ...state.content, imageFrames, imageSources,
      imageStacks: { ...(state.content.imageStacks || {}), [fromSection]: fromStack, [toSection]: toStack },
    },
  };
}
