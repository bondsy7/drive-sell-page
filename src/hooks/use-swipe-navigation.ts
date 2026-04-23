import { useCallback, useRef } from 'react';

interface UseSwipeNavigationOptions {
  enabled?: boolean;
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
  threshold?: number;
  restraint?: number;
}

export function useSwipeNavigation({
  enabled = true,
  onSwipeLeft,
  onSwipeRight,
  threshold = 50,
  restraint = 90,
}: UseSwipeNavigationOptions) {
  const touchStartX = useRef<number | null>(null);
  const touchStartY = useRef<number | null>(null);

  const onTouchStart = useCallback((event: React.TouchEvent<HTMLElement>) => {
    if (!enabled) return;
    const touch = event.changedTouches[0];
    touchStartX.current = touch.clientX;
    touchStartY.current = touch.clientY;
  }, [enabled]);

  const onTouchEnd = useCallback((event: React.TouchEvent<HTMLElement>) => {
    if (!enabled || touchStartX.current === null || touchStartY.current === null) return;

    const touch = event.changedTouches[0];
    const deltaX = touch.clientX - touchStartX.current;
    const deltaY = touch.clientY - touchStartY.current;

    touchStartX.current = null;
    touchStartY.current = null;

    if (Math.abs(deltaY) > restraint || Math.abs(deltaX) < threshold) return;

    if (deltaX < 0) onSwipeLeft?.();
    if (deltaX > 0) onSwipeRight?.();
  }, [enabled, onSwipeLeft, onSwipeRight, restraint, threshold]);

  return { onTouchStart, onTouchEnd };
}