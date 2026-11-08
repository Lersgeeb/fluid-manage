import { describe, expect, it } from 'vitest';
import { BoardFormatError, parseBoard } from './parseBoard';

const task = (overrides: Record<string, unknown> = {}) => ({
  id: 't1',
  title: 'Task',
  description: 'Desc',
  tag: 'ACME',
  tagColor: '#112233',
  priority: 'high',
  reference: 'REF-1',
  columnId: 'c1',
  order: 0,
  createdAt: '2024-01-01T00:00:00.000Z',
  updatedAt: '2024-01-02T00:00:00.000Z',
  ...overrides,
});

const board = (tasks: unknown[] = [task()], extra: Record<string, unknown> = {}) => ({
  columns: [{ id: 'c1', title: 'Todo', tasks, order: 0 }],
  ...extra,
});

const parse = (value: unknown) => parseBoard(JSON.stringify(value));

describe('parseBoard', () => {
  it('round-trips a complete board without losing any data', () => {
    const full = {
      columns: [
        {
          id: 'c1',
          title: 'Todo',
          order: 3,
          tasks: [
            task({
              nextStep: 'Call',
              hidden: true,
              comments: [
                { id: 'k1', text: 'hi', createdAt: '2024-01-03T00:00:00Z', updatedAt: '2024-01-04T00:00:00Z' },
              ],
            }),
          ],
        },
        {
          id: 'arch',
          title: 'Archive',
          order: 9,
          isArchive: true,
          tasks: [
            task({ id: 't2', columnId: 'arch', archivedFromColumnId: 'gone', archivedAt: '2024-02-01T00:00:00Z' }),
          ],
        },
      ],
      presentationColumns: [{ id: 'p1', title: 'Slide', tasks: [], order: 0 }],
    };
    const first = parse(full);
    expect(first).toEqual(full);
    expect(parseBoard(JSON.stringify(first))).toEqual(full);
  });

  it('accepts files without optional fields and does not invent them', () => {
    const result = parse(board());
    const parsed = result.columns[0]!.tasks[0]!;
    expect(parsed).not.toHaveProperty('nextStep');
    expect(parsed).not.toHaveProperty('comments');
    expect(parsed).not.toHaveProperty('hidden');
    expect(result).not.toHaveProperty('presentationColumns');
  });

  it('normalizes legacy client fields to tag fields', () => {
    const legacy = task({ client: 'Old Co', clientColor: '#abcdef' }) as Record<string, unknown>;
    delete legacy.tag;
    delete legacy.tagColor;
    const parsed = parse(board([legacy])).columns[0]!.tasks[0]!;
    expect(parsed.tag).toBe('Old Co');
    expect(parsed.tagColor).toBe('#abcdef');
    expect(parsed).not.toHaveProperty('client');
    expect(parsed).not.toHaveProperty('clientColor');
  });

  it('prefers tag over a stale client value', () => {
    const parsed = parse(board([task({ client: 'Old', clientColor: '#000000' })])).columns[0]!.tasks[0]!;
    expect(parsed.tag).toBe('ACME');
    expect(parsed.tagColor).toBe('#112233');
  });

  it('fills missing text fields instead of rejecting older exports', () => {
    const sparse = task() as Record<string, unknown>;
    delete sparse.description;
    delete sparse.reference;
    const parsed = parse(board([sparse])).columns[0]!.tasks[0]!;
    expect(parsed.description).toBe('');
    expect(parsed.reference).toBe('');
  });

  it.each([[undefined], ['urgent'], [3], [null]])('falls back to low for priority %s', (priority) => {
    expect(parse(board([task({ priority })])).columns[0]!.tasks[0]!.priority).toBe('low');
  });

  it('keeps presentationColumns opaque, without normalizing them', () => {
    const presentationColumns = [{ anything: { goes: [1, 2] }, client: 'x' }];
    expect(parse(board([], { presentationColumns })).presentationColumns).toEqual(presentationColumns);
  });

  it('keeps unknown fields so future data is not lost', () => {
    expect(parse(board([task({ custom: 1 })])).columns[0]!.tasks[0]).toHaveProperty('custom', 1);
  });

  it('drops prototype-polluting keys at any depth', () => {
    const raw =
      '{"__proto__":{"polluted":true},"columns":[{"id":"c","title":"T","order":0,"constructor":{"prototype":{"polluted":true}},"tasks":[]}]}';
    const result = parseBoard(raw);
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
    expect(Object.keys(result)).toEqual(['columns']);
    expect(Object.keys(result.columns[0]!)).not.toContain('constructor');
  });

  describe('rejects invalid structures', () => {
    it.each<[string, string]>([
      ['malformed JSON', '{nope'],
      ['a non-object root', '[]'],
      ['null', 'null'],
      ['a wrapped board', '{"board":{"columns":[]}}'],
      ['non-array columns', '{"columns":{}}'],
      ['a column without id', '{"columns":[{"title":"x","tasks":[],"order":0}]}'],
      ['a column without tasks', '{"columns":[{"id":"c","title":"x","order":0}]}'],
      ['a non-numeric column order', '{"columns":[{"id":"c","title":"x","tasks":[],"order":"1"}]}'],
    ])('%s', (_name, raw) => {
      expect(() => parseBoard(raw)).toThrow(BoardFormatError);
    });

    it.each<[string, Record<string, unknown>]>([
      ['task without id', { id: undefined }],
      ['task without title', { title: undefined }],
      ['task without columnId', { columnId: undefined }],
      ['task with non-numeric order', { order: 'a' }],
      ['task without createdAt', { createdAt: undefined }],
      ['task without updatedAt', { updatedAt: undefined }],
      ['non-string description', { description: 4 }],
      ['non-boolean hidden', { hidden: 'yes' }],
      ['non-string nextStep', { nextStep: 1 }],
      ['non-array comments', { comments: {} }],
      ['malformed comment', { comments: [{ id: 'x' }] }],
    ])('%s', (_name, overrides) => {
      expect(() => parse(board([task(overrides)]))).toThrow(BoardFormatError);
    });

    it('non-array presentationColumns', () => {
      expect(() => parse(board([], { presentationColumns: {} }))).toThrow(BoardFormatError);
    });

    it('duplicate column ids', () => {
      const column = { id: 'c', title: 'x', tasks: [], order: 0 };
      expect(() => parse({ columns: [column, column] })).toThrow(BoardFormatError);
    });

    it('duplicate task ids across columns', () => {
      expect(() =>
        parse({
          columns: [
            { id: 'a', title: 'x', order: 0, tasks: [task()] },
            { id: 'b', title: 'y', order: 1, tasks: [task()] },
          ],
        }),
      ).toThrow(BoardFormatError);
    });
  });
});
