import type { Board, OperationContext } from '../domain/types';
import { createOperationContext } from './operationContext';

export const SAVE_DELAY_MS = 250;

export interface BoardStore {
  getBoard: () => Board;
  subscribe: (listener: () => void) => () => void;
  update: (operation: (board: Board, ctx: OperationContext) => Board) => void;
  replace: (board: Board) => void;
  applyExternal: (board: Board) => void;
  flush: () => void;
}

interface BoardStoreOptions {
  initial: Board;
  save: (board: Board) => boolean;
  onSaveError: () => void;
}

/**
 * Holds the board outside React. Serializing on every keystroke-sized change
 * would block the main thread on large boards, so writes are debounced;
 * callers flush when the page is being left.
 */
export function createBoardStore({ initial, save, onSaveError }: BoardStoreOptions): BoardStore {
  const ctx = createOperationContext();
  const listeners = new Set<() => void>();
  let board = initial;
  let timer: ReturnType<typeof setTimeout> | undefined;

  const publish = (next: Board) => {
    board = next;
    for (const listener of listeners) listener();
  };

  const cancelPending = () => {
    clearTimeout(timer);
    timer = undefined;
  };

  const persist = () => {
    cancelPending();
    if (!save(board)) onSaveError();
  };

  return {
    getBoard: () => board,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    update(operation) {
      const next = operation(board, ctx);
      if (next === board) return;
      publish(next);
      cancelPending();
      timer = setTimeout(persist, SAVE_DELAY_MS);
    },
    replace(next) {
      publish(next);
      persist();
    },
    applyExternal(next) {
      cancelPending();
      publish(next);
    },
    flush() {
      if (timer !== undefined) persist();
    },
  };
}
