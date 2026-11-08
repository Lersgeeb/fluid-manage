import { parseBoard } from '../domain/parseBoard';
import type { Board } from '../domain/types';

/**
 * Keeps the previous product name on purpose: same key and plain Board shape
 * as the existing app, so its data loads as is (RF-32).
 */
export const STORAGE_KEY = 'quickmanage_board';
export const BACKUP_KEY = 'fluidmanage_board_corrupt_backup';

export type LoadResult = { status: 'ok'; board: Board } | { status: 'empty' } | { status: 'corrupt' } | { status: 'unavailable' };

const blocked = (): never => {
  throw new DOMException('Storage is unavailable', 'SecurityError');
};

const UNAVAILABLE_STORAGE = { getItem: blocked, setItem: blocked, removeItem: blocked } as unknown as Storage;

/** Merely touching window.localStorage throws when the browser blocks site data. */
export function browserStorage(): Storage {
  try {
    return localStorage;
  } catch {
    return UNAVAILABLE_STORAGE;
  }
}

export function loadBoard(storage: Storage): LoadResult {
  let raw: string | null;
  try {
    raw = storage.getItem(STORAGE_KEY);
  } catch {
    return { status: 'unavailable' };
  }
  if (raw === null) return { status: 'empty' };

  try {
    return { status: 'ok', board: parseBoard(raw) };
  } catch {
    // The next autosave would overwrite this, so keep a copy for recovery.
    try {
      storage.setItem(BACKUP_KEY, raw);
    } catch {
      // Best effort: the user is still told the data could not be read.
    }
    return { status: 'corrupt' };
  }
}

export function saveBoard(board: Board, storage: Storage): boolean {
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(board));
    return true;
  } catch {
    return false;
  }
}

export function clearBoard(storage: Storage): boolean {
  try {
    storage.removeItem(STORAGE_KEY);
    return true;
  } catch {
    return false;
  }
}
