import { describe, expect, it } from 'vitest';
import { ImportError, MAX_IMPORT_BYTES, readBoardFile } from './importFile';

const valid = '{"columns":[]}';

describe('readBoardFile', () => {
  it('returns the parsed board', async () => {
    await expect(readBoardFile(new File([valid], 'b.json'))).resolves.toEqual({ columns: [] });
  });

  it('rejects oversized files before reading them', async () => {
    const file = new File([valid], 'b.json');
    Object.defineProperty(file, 'size', { value: MAX_IMPORT_BYTES + 1 });
    Object.defineProperty(file, 'text', {
      value: () => {
        throw new Error('should not read');
      },
    });
    await expect(readBoardFile(file)).rejects.toMatchObject({ reason: 'tooLarge' });
  });

  it('flags unreadable files', async () => {
    const file = new File([valid], 'b.json');
    Object.defineProperty(file, 'text', { value: () => Promise.reject(new Error('io')) });
    await expect(readBoardFile(file)).rejects.toMatchObject({ reason: 'unreadable' });
  });

  it('flags invalid content', async () => {
    const error = await readBoardFile(new File(['nope'], 'b.json')).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ImportError);
    expect(error).toMatchObject({ reason: 'invalid' });
  });
});
