import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Board } from '../domain/types';
import { createBoardStore, SAVE_DELAY_MS } from './boardStore';
import { createOperationContext } from './operationContext';

const board = (title: string): Board => ({ columns: [{ id: 'c', title, tasks: [], order: 0 }] });

function setup() {
  const save = vi.fn<(board: Board) => boolean>(() => true);
  const onSaveError = vi.fn();
  const store = createBoardStore({ initial: board('start'), save, onSaveError });
  return { store, save, onSaveError };
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('boardStore', () => {
  it('applies updates and notifies subscribers', () => {
    const { store } = setup();
    const listener = vi.fn();
    store.subscribe(listener);
    store.update(() => board('next'));
    expect(store.getBoard().columns[0]!.title).toBe('next');
    expect(listener).toHaveBeenCalledOnce();
  });

  it('skips no-op updates entirely', () => {
    const { store, save } = setup();
    const listener = vi.fn();
    store.subscribe(listener);
    store.update((current) => current);
    vi.advanceTimersByTime(SAVE_DELAY_MS);
    expect(listener).not.toHaveBeenCalled();
    expect(save).not.toHaveBeenCalled();
  });

  it('coalesces rapid updates into one save of the latest board', () => {
    const { store, save } = setup();
    store.update(() => board('a'));
    store.update(() => board('b'));
    expect(save).not.toHaveBeenCalled();
    vi.advanceTimersByTime(SAVE_DELAY_MS);
    expect(save).toHaveBeenCalledOnce();
    expect(save.mock.calls[0]![0].columns[0]!.title).toBe('b');
  });

  it('flush saves pending work immediately and only once', () => {
    const { store, save } = setup();
    store.update(() => board('a'));
    store.flush();
    expect(save).toHaveBeenCalledOnce();
    vi.advanceTimersByTime(SAVE_DELAY_MS);
    store.flush();
    expect(save).toHaveBeenCalledOnce();
  });

  it('replace persists immediately', () => {
    const { store, save } = setup();
    store.replace(board('imported'));
    expect(store.getBoard().columns[0]!.title).toBe('imported');
    expect(save).toHaveBeenCalledOnce();
  });

  it('reports save failures', () => {
    const { store, save, onSaveError } = setup();
    save.mockReturnValue(false);
    store.update(() => board('a'));
    vi.advanceTimersByTime(SAVE_DELAY_MS);
    expect(onSaveError).toHaveBeenCalledOnce();
  });

  it('applyExternal updates without saving and cancels a pending save', () => {
    const { store, save } = setup();
    const listener = vi.fn();
    store.subscribe(listener);
    store.update(() => board('local'));
    store.applyExternal(board('other tab'));
    vi.advanceTimersByTime(SAVE_DELAY_MS);
    expect(store.getBoard().columns[0]!.title).toBe('other tab');
    expect(save).not.toHaveBeenCalled();
    expect(listener).toHaveBeenCalledTimes(2);
  });

  it('stops notifying after unsubscribe', () => {
    const { store } = setup();
    const listener = vi.fn();
    store.subscribe(listener)();
    store.update(() => board('a'));
    expect(listener).not.toHaveBeenCalled();
  });
});

describe('createOperationContext', () => {
  it('produces unique ids and ISO dates', () => {
    const ctx = createOperationContext();
    expect(ctx.id()).not.toBe(ctx.id());
    expect(new Date(ctx.now()).toISOString()).toBe(ctx.now());
  });

  it('still produces ids outside secure contexts', () => {
    vi.stubGlobal('crypto', { getRandomValues: (array: Uint8Array) => array.fill(7) });
    expect(createOperationContext().id()).toBe('07'.repeat(16));
    vi.unstubAllGlobals();
  });
});
