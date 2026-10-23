import type { LandingPageContent } from '@/lib/landing-page-builder';

/** Stable IDs survive saves; empty text alone must not trigger default fallbacks. */
export function isLandingElementRemoved(content: LandingPageContent, id: string): boolean {
  return content.removedElements?.includes(id) ?? false;
}

export function removeLandingElement(content: LandingPageContent, id: string): LandingPageContent {
  if (isLandingElementRemoved(content, id)) return content;
  return { ...content, removedElements: [...(content.removedElements ?? []), id] };
}

export interface UndoState<T> { current: T; past: T[] }
export function recordChange<T>(state: UndoState<T>, next: T): UndoState<T> {
  if (JSON.stringify(state.current) === JSON.stringify(next)) return state;
  return { current: next, past: [...state.past.slice(-49), state.current] };
}
export function undoChange<T>(state: UndoState<T>): UndoState<T> {
  const previous = state.past.at(-1);
  return previous === undefined ? state : { current: previous, past: state.past.slice(0, -1) };
}