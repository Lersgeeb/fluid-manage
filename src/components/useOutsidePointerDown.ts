import { useEffect, type RefObject } from 'react';

export function useOutsidePointerDown(
  container: RefObject<HTMLElement | null>,
  active: boolean,
  onOutside: () => void,
): void {
  useEffect(() => {
    if (!active) return;
    const handlePointerDown = (event: PointerEvent) => {
      if (!container.current?.contains(event.target as Node)) onOutside();
    };
    document.addEventListener('pointerdown', handlePointerDown);
    return () => document.removeEventListener('pointerdown', handlePointerDown);
  }, [container, active, onOutside]);
}
