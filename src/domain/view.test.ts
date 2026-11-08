import { describe, expect, it } from 'vitest';
import { safeColor } from './constants';
import type { Board, Column, Comment, Task } from './types';
import {
  cardText,
  collectTagOptions,
  columnDropId,
  DEFAULT_VIEW,
  getVisibleColumns,
  latestComments,
  moveWithinView,
  priorityCounts,
  resolveDrop,
  type ViewOptions,
} from './view';

const makeTask = (id: string, order: number, extra: Partial<Task> = {}): Task => ({
  id,
  title: id,
  description: `desc-${id}`,
  tag: 'A',
  tagColor: '#000',
  priority: 'low',
  reference: '',
  columnId: 'c',
  order,
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-01-01T00:00:00Z',
  ...extra,
});

const comment = (id: string, createdAt: string): Comment => ({ id, text: id, createdAt, updatedAt: createdAt });

const makeColumn = (id: string, order: number, tasks: Task[], extra: Partial<Column> = {}): Column => ({
  id,
  title: id,
  order,
  tasks,
  ...extra,
});

const view = (over: Partial<ViewOptions> = {}): ViewOptions => ({ ...DEFAULT_VIEW, ...over });
const visibleIds = (board: Board, over: Partial<ViewOptions> = {}) =>
  getVisibleColumns(board, view(over)).map((c) => [c.column.id, c.tasks.map((t) => t.id)]);

describe('getVisibleColumns', () => {
  it('uses manual order by default', () => {
    const b: Board = { columns: [makeColumn('c', 0, [makeTask('b', 1), makeTask('a', 0)])] };
    expect(visibleIds(b)).toEqual([['c', ['a', 'b']]]);
  });

  it('hides hidden tasks unless asked', () => {
    const b: Board = { columns: [makeColumn('c', 0, [makeTask('a', 0, { hidden: true }), makeTask('b', 1)])] };
    expect(visibleIds(b)).toEqual([['c', ['b']]]);
    expect(visibleIds(b, { showHidden: true })).toEqual([['c', ['a', 'b']]]);
  });

  it('hides the archive column unless asked', () => {
    const b: Board = { columns: [makeColumn('c', 0, []), makeColumn('z', 1, [], { isArchive: true })] };
    expect(visibleIds(b).map(([id]) => id)).toEqual(['c']);
    expect(visibleIds(b, { showArchive: true }).map(([id]) => id)).toEqual(['c', 'z']);
  });

  it('combines tag and priority filters with visibility options', () => {
    const b: Board = {
      columns: [
        makeColumn('c', 0, [
          makeTask('match', 0, { tag: 'X', priority: 'high' }),
          makeTask('wrongTag', 1, { tag: 'Y', priority: 'high' }),
          makeTask('wrongPriority', 2, { tag: 'X' }),
          makeTask('hiddenMatch', 3, { tag: 'X', priority: 'high', hidden: true }),
        ]),
        makeColumn('z', 1, [makeTask('archived', 0, { tag: 'X', priority: 'high' })], { isArchive: true }),
      ],
    };
    const filter = { tag: 'X', priority: 'high' } as const;
    expect(visibleIds(b, filter)).toEqual([['c', ['match']]]);
    expect(visibleIds(b, { ...filter, showHidden: true, showArchive: true })).toEqual([
      ['c', ['match', 'hiddenMatch']],
      ['z', ['archived']],
    ]);
  });

  it('sorts by priority in both directions', () => {
    const b: Board = {
      columns: [
        makeColumn('c', 0, [
          makeTask('m', 0, { priority: 'medium' }),
          makeTask('c', 1, { priority: 'critical' }),
          makeTask('l', 2, { priority: 'low' }),
        ]),
      ],
    };
    expect(visibleIds(b, { sortBy: 'priority', sortDirection: 'asc' })).toEqual([['c', ['l', 'm', 'c']]]);
    expect(visibleIds(b, { sortBy: 'priority', sortDirection: 'desc' })).toEqual([['c', ['c', 'm', 'l']]]);
  });

  it.each(['createdAt', 'updatedAt'] as const)('sorts by %s in both directions', (sortBy) => {
    const at = (value: string) => ({ [sortBy]: value });
    const b: Board = {
      columns: [
        makeColumn('c', 0, [
          makeTask('mid', 0, at('2024-02-01T00:00:00Z')),
          makeTask('new', 1, at('2024-03-01T00:00:00Z')),
          makeTask('old', 2, at('2024-01-01T00:00:00Z')),
        ]),
      ],
    };
    expect(visibleIds(b, { sortBy, sortDirection: 'asc' })).toEqual([['c', ['old', 'mid', 'new']]]);
    expect(visibleIds(b, { sortBy, sortDirection: 'desc' })).toEqual([['c', ['new', 'mid', 'old']]]);
  });

  it('ignores direction for manual order and does not mutate the board', () => {
    const tasks = [makeTask('b', 1), makeTask('a', 0)];
    const b: Board = { columns: [makeColumn('c', 0, tasks)] };
    expect(visibleIds(b, { sortDirection: 'desc' })).toEqual([['c', ['a', 'b']]]);
    expect(tasks.map((t) => t.id)).toEqual(['b', 'a']);
  });
});

describe('moveWithinView', () => {
  const NONE = new Set<string>();
  const byPriority = view({ sortBy: 'priority', sortDirection: 'desc' });
  const sortedBoard = (): Board => ({
    columns: [
      makeColumn('a', 0, [
        makeTask('low', 0, { columnId: 'a' }),
        makeTask('med', 1, { columnId: 'a', priority: 'medium' }),
        makeTask('high', 2, { columnId: 'a', priority: 'high' }),
      ]),
      makeColumn('b', 1, [makeTask('other', 0, { columnId: 'b' })]),
    ],
  });
  const shown = (b: Board, manual: ReadonlySet<string>, options = byPriority) =>
    getVisibleColumns(b, options, manual)[0]!.tasks.map((t) => t.id);

  it('keeps a vertical move where it was dropped while sorted', () => {
    const result = moveWithinView(sortedBoard(), byPriority, NONE, 'low', { toColumnId: 'a', beforeTaskId: 'high' });
    expect(result.sortOverridden).toBe(true);
    expect(shown(result.board, new Set(['a']))).toEqual(['low', 'high', 'med']);
  });

  it('persists the dropped sequence as the manual order', () => {
    const { board } = moveWithinView(sortedBoard(), byPriority, NONE, 'low', { toColumnId: 'a', beforeTaskId: 'high' });
    expect(shown(board, NONE, view())).toEqual(['low', 'high', 'med']);
  });

  it('places tasks hidden by a filter according to the sort', () => {
    const filtered = view({ sortBy: 'priority', sortDirection: 'desc', priority: 'high' });
    const b = sortedBoard();
    const { board } = moveWithinView(b, filtered, NONE, 'med', { toColumnId: 'a', beforeTaskId: 'high' });
    expect(shown(board, NONE, view())).toEqual(['med', 'high', 'low']);
  });

  it('builds on the current order once a column has been reordered', () => {
    const manual = new Set(['a']);
    const first = moveWithinView(sortedBoard(), byPriority, NONE, 'low', { toColumnId: 'a', beforeTaskId: 'high' });
    const second = moveWithinView(first.board, byPriority, manual, 'med', { toColumnId: 'a', beforeTaskId: 'low' });
    expect(second.sortOverridden).toBe(false);
    expect(shown(second.board, manual)).toEqual(['med', 'low', 'high']);
  });

  it('changes nothing when dropped on its own sorted position', () => {
    const b = sortedBoard();
    const result = moveWithinView(b, byPriority, NONE, 'high', { toColumnId: 'a', beforeTaskId: 'med' });
    expect(result.board).toBe(b);
    expect(result.sortOverridden).toBe(false);
  });

  it('does not override the sort for moves in manual order or between columns', () => {
    const b = sortedBoard();
    expect(moveWithinView(b, view(), NONE, 'low', { toColumnId: 'a', beforeTaskId: null }).sortOverridden).toBe(false);
    const across = moveWithinView(b, byPriority, NONE, 'low', { toColumnId: 'b', beforeTaskId: null });
    expect(across.sortOverridden).toBe(false);
    expect(across.board.columns[1]!.tasks.map((t) => t.id)).toEqual(['other', 'low']);
  });
});

describe('priorityCounts', () => {
  it('counts tasks per priority, including empty ones', () => {
    const tasks = [makeTask('a', 0, { priority: 'high' }), makeTask('b', 1, { priority: 'high' }), makeTask('c', 2)];
    expect(priorityCounts(tasks)).toEqual({ low: 1, medium: 0, high: 2, critical: 0 });
  });
});

describe('collectTagOptions', () => {
  it('returns unique tags sorted, including archived ones', () => {
    const b: Board = {
      columns: [
        makeColumn('c', 0, [makeTask('1', 0, { tag: 'b' }), makeTask('2', 1, { tag: 'a' }), makeTask('3', 2, { tag: 'b' })]),
        makeColumn('z', 1, [makeTask('4', 0, { tag: 'c' })], { isArchive: true }),
      ],
    };
    expect(collectTagOptions(b).map((option) => option.tag)).toEqual(['a', 'b', 'c']);
  });

  it('uses the most common color when a tag has several', () => {
    const b: Board = {
      columns: [
        makeColumn('c', 0, [
          makeTask('1', 0, { tag: 'a', tagColor: '#111111' }),
          makeTask('2', 1, { tag: 'a', tagColor: '#222222' }),
          makeTask('3', 2, { tag: 'a', tagColor: '#222222' }),
        ]),
      ],
    };
    expect(collectTagOptions(b)).toEqual([{ tag: 'a', color: '#222222' }]);
  });
});

describe('latestComments', () => {
  it('returns most recent first, by date and not by array position', () => {
    const t = makeTask('x', 0, {
      comments: [
        comment('new', '2024-03-01T00:00:00Z'),
        comment('old', '2024-01-01T00:00:00Z'),
        comment('mid', '2024-02-01T00:00:00Z'),
        comment('oldest', '2023-01-01T00:00:00Z'),
      ],
    });
    expect(latestComments(t, 3).map((c) => c.id)).toEqual(['new', 'mid', 'old']);
  });

  it('breaks date ties in favor of the later entry', () => {
    const t = makeTask('x', 0, { comments: [comment('first', '2024-01-01T00:00:00Z'), comment('second', '2024-01-01T00:00:00Z')] });
    expect(latestComments(t, 1)[0]!.id).toBe('second');
  });

  it('handles tasks without comments', () => {
    expect(latestComments(makeTask('x', 0), 3)).toEqual([]);
  });
});

describe('cardText', () => {
  const t = makeTask('x', 0, { nextStep: 'step', comments: [comment('latest', '2024-01-01T00:00:00Z')] });

  it('selects the requested text', () => {
    expect(cardText(t, 'description')).toBe('desc-x');
    expect(cardText(t, 'nextStep')).toBe('step');
    expect(cardText(t, 'lastComment')).toBe('latest');
  });

  it('is empty when the source is missing', () => {
    expect(cardText(makeTask('y', 0), 'nextStep')).toBe('');
    expect(cardText(makeTask('y', 0), 'lastComment')).toBe('');
  });
});

describe('resolveDrop', () => {
  const columns = [
    { column: makeColumn('a', 0, []), tasks: [makeTask('1', 0), makeTask('2', 1), makeTask('3', 2)] },
    { column: makeColumn('b', 1, []), tasks: [makeTask('4', 0), makeTask('5', 1)] },
  ];

  it('dragging down places after the target', () => {
    expect(resolveDrop(columns, '1', '2', false)).toEqual({ toColumnId: 'a', beforeTaskId: '3' });
    expect(resolveDrop(columns, '1', '3', false)).toEqual({ toColumnId: 'a', beforeTaskId: null });
  });

  it('dragging up places before the target', () => {
    expect(resolveDrop(columns, '3', '1', false)).toEqual({ toColumnId: 'a', beforeTaskId: '1' });
  });

  it('across columns honors the pointer half of the target', () => {
    expect(resolveDrop(columns, '1', '4', false)).toEqual({ toColumnId: 'b', beforeTaskId: '4' });
    expect(resolveDrop(columns, '1', '4', true)).toEqual({ toColumnId: 'b', beforeTaskId: '5' });
    expect(resolveDrop(columns, '1', '5', true)).toEqual({ toColumnId: 'b', beforeTaskId: null });
  });

  it('dropping on a column appends', () => {
    expect(resolveDrop(columns, '1', columnDropId('b'), false)).toEqual({ toColumnId: 'b', beforeTaskId: null });
  });

  it('returns null when dropped on itself or something unknown', () => {
    expect(resolveDrop(columns, '1', '1', false)).toBeNull();
    expect(resolveDrop(columns, '1', 'nope', false)).toBeNull();
    expect(resolveDrop(columns, 'nope', '1', false)).toBeNull();
  });
});

describe('safeColor', () => {
  it.each(['#abc', '#ABCD', '#112233', '#11223344'])('keeps %s', (color) => {
    expect(safeColor(color)).toBe(color);
  });

  it.each(['url(https://evil.test/x)', 'red;background:url(x)', '', '#12', 'javascript:alert(1)'])(
    'replaces %s',
    (color) => {
      expect(safeColor(color, '#000')).toBe('#000');
    },
  );
});
