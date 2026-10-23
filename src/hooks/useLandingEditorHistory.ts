import { useCallback, useState, type SetStateAction } from 'react';
import { recordChange, undoChange, type UndoState } from '@/lib/landing-element-editing';

/** One snapshot covers text, images, stock configuration and contact-form settings. */
export function useLandingEditorHistory<T>(initial: T) {
  const [history, setHistory] = useState<UndoState<T>>({ current: initial, past: [] });
  const update = useCallback(<K extends keyof T>(key: K, value: SetStateAction<T[K]>) => {
    setHistory(previous => {
      const next = typeof value === 'function'
        ? (value as (old: T[K]) => T[K])(previous.current[key]) : value;
      return recordChange(previous, { ...previous.current, [key]: next });
    });
  }, []);
  const undo = useCallback(() => setHistory(previous => undoChange(previous)), []);
  return { state: history.current, update, undo, canUndo: history.past.length > 0 };
}