import { describe, expect, it } from 'vitest';
import { canStartPointerDrag } from './CardPointerSensor';

function card() {
  const root = document.createElement('article');
  root.innerHTML = '<p>text</p><button data-drag-handle><svg></svg></button>';
  return {
    body: root.querySelector('p')!,
    handleIcon: root.querySelector('svg')!,
  };
}

const press = (target: Element, overrides: Partial<PointerEvent> = {}) =>
  ({ isPrimary: true, button: 0, pointerType: 'mouse', target, ...overrides }) as unknown as PointerEvent;

describe('canStartPointerDrag', () => {
  it('lets the mouse drag from anywhere on the card', () => {
    expect(canStartPointerDrag(press(card().body))).toBe(true);
    expect(canStartPointerDrag(press(card().handleIcon))).toBe(true);
  });

  it.each(['touch', 'pen'])('reserves the card body for scrolling on %s', (pointerType) => {
    expect(canStartPointerDrag(press(card().body, { pointerType }))).toBe(false);
  });

  it.each(['touch', 'pen'])('lets %s drag from the handle', (pointerType) => {
    expect(canStartPointerDrag(press(card().handleIcon, { pointerType }))).toBe(true);
  });

  it('ignores secondary buttons and extra pointers', () => {
    expect(canStartPointerDrag(press(card().body, { button: 2 }))).toBe(false);
    expect(canStartPointerDrag(press(card().body, { isPrimary: false }))).toBe(false);
  });
});
