import { describe, expect, it, vi } from 'vitest';
import type { Board } from '../domain/types';
import { BACKUP_KEY, clearBoard, loadBoard, saveBoard, STORAGE_KEY } from './boardStorage';
import { readPreference, writePreference } from './preferences';

const board: Board = { columns: [{ id: 'c', title: 'T', tasks: [], order: 0 }] };

const brokenStorage = (): Storage =>
  ({
    getItem: () => {
      throw new DOMException('denied', 'SecurityError');
    },
    setItem: () => {
      throw new DOMException('full', 'QuotaExceededError');
    },
    removeItem: () => {
      throw new DOMException('denied', 'SecurityError');
    },
  }) as unknown as Storage;

describe('boardStorage', () => {
  it('uses the key of the existing application', () => {
    expect(STORAGE_KEY).toBe('quickmanage_board');
  });

  it('reports an empty store', () => {
    expect(loadBoard(localStorage)).toEqual({ status: 'empty' });
  });

  it('round-trips a board', () => {
    expect(saveBoard(board, localStorage)).toBe(true);
    expect(loadBoard(localStorage)).toEqual({ status: 'ok', board });
  });

  it('stores the plain Board shape, with no envelope', () => {
    saveBoard(board, localStorage);
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY)!)).toEqual(board);
  });

  it('normalizes legacy data already in storage', () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        columns: [
          {
            id: 'c',
            title: 'T',
            order: 0,
            tasks: [{ id: 't', title: 'x', client: 'Co', clientColor: '#111111', columnId: 'c', order: 0, createdAt: 'a', updatedAt: 'b' }],
          },
        ],
      }),
    );
    const result = loadBoard(localStorage);
    expect(result.status === 'ok' && result.board.columns[0]!.tasks[0]!.tag).toBe('Co');
  });

  it('backs up corrupt data before reporting it', () => {
    localStorage.setItem(STORAGE_KEY, '{broken');
    expect(loadBoard(localStorage)).toEqual({ status: 'corrupt' });
    expect(localStorage.getItem(BACKUP_KEY)).toBe('{broken');
  });

  it('reports failures instead of throwing', () => {
    const storage = brokenStorage();
    expect(loadBoard(storage)).toEqual({ status: 'unavailable' });
    expect(saveBoard(board, storage)).toBe(false);
    expect(clearBoard(storage)).toBe(false);
  });

  it('clears the saved board', () => {
    saveBoard(board, localStorage);
    expect(clearBoard(localStorage)).toBe(true);
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
  });
});

describe('preferences', () => {
  const allowed = ['es', 'en'] as const;

  it('reads only allowed values', () => {
    expect(readPreference('k', allowed)).toBeNull();
    writePreference('k', 'en');
    expect(readPreference('k', allowed)).toBe('en');
    localStorage.setItem('k', 'fr');
    expect(readPreference('k', allowed)).toBeNull();
  });

  it('survives blocked storage', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    expect(readPreference('k', allowed)).toBeNull();
    expect(() => writePreference('k', 'en')).not.toThrow();
  });
});
