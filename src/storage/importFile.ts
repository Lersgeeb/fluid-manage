import { parseBoard } from '../domain/parseBoard';
import type { Board } from '../domain/types';

/** Well above what localStorage can hold; stops huge files from freezing the tab. */
export const MAX_IMPORT_BYTES = 20 * 1024 * 1024;

export type ImportFailure = 'tooLarge' | 'unreadable' | 'invalid';

export class ImportError extends Error {
  override name = 'ImportError';
  constructor(readonly reason: ImportFailure) {
    super(reason);
  }
}

export async function readBoardFile(file: File): Promise<Board> {
  if (file.size > MAX_IMPORT_BYTES) throw new ImportError('tooLarge');

  let text: string;
  try {
    text = await file.text();
  } catch {
    throw new ImportError('unreadable');
  }

  try {
    return parseBoard(text);
  } catch {
    throw new ImportError('invalid');
  }
}
