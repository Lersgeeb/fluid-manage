import { PointerSensor, type PointerSensorOptions } from '@dnd-kit/core';
import type { PointerEvent as ReactPointerEvent } from 'react';

type PointerPress = Pick<PointerEvent, 'isPrimary' | 'button' | 'pointerType' | 'target'>;

/**
 * The mouse can pick a card up from anywhere. Touch and pen need the handle,
 * otherwise swiping through a column would drag cards instead of scrolling.
 */
export function canStartPointerDrag(event: PointerPress): boolean {
  if (!event.isPrimary || event.button !== 0) return false;
  return event.pointerType === 'mouse' || (event.target as Element).closest('[data-drag-handle]') !== null;
}

export class CardPointerSensor extends PointerSensor {
  static override activators = [
    {
      eventName: 'onPointerDown' as const,
      handler: ({ nativeEvent }: ReactPointerEvent, { onActivation }: PointerSensorOptions) => {
        if (!canStartPointerDrag(nativeEvent)) return false;
        onActivation?.({ event: nativeEvent });
        return true;
      },
    },
  ];
}
