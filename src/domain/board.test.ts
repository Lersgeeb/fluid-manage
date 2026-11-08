import { beforeEach, describe, expect, it } from 'vitest';
import * as ops from './board';
import type { Board, Column, OperationContext, Task, TaskInput } from './types';

let counter = 0;
const NOW = '2025-06-01T12:00:00.000Z';
const LATER = '2026-01-01T00:00:00.000Z';
const OLD = '2020-01-01T00:00:00.000Z';
const ctx: OperationContext = { id: () => `gen-${++counter}`, now: () => NOW };
const laterCtx: OperationContext = { ...ctx, now: () => LATER };

beforeEach(() => {
  counter = 0;
});

const makeTask = (id: string, columnId: string, order: number, extra: Partial<Task> = {}): Task => ({
  id,
  title: id,
  description: '',
  tag: 'tag',
  tagColor: '#000000',
  priority: 'low',
  reference: '',
  columnId,
  order,
  createdAt: OLD,
  updatedAt: OLD,
  ...extra,
});

const makeColumn = (id: string, order: number, taskIds: string[] = [], extra: Partial<Column> = {}): Column => ({
  id,
  title: id,
  order,
  tasks: taskIds.map((taskId, index) => makeTask(taskId, id, index)),
  ...extra,
});

const board = (...columns: Column[]): Board => ({ columns });
const column = (b: Board, id: string) => b.columns.find((c) => c.id === id)!;
const task = (b: Board, id: string) => b.columns.flatMap((c) => c.tasks).find((t) => t.id === id)!;
const ids = (b: Board, columnId: string) =>
  column(b, columnId)
    .tasks.toSorted((x, y) => x.order - y.order)
    .map((t) => t.id);

const input: TaskInput = {
  title: 'New',
  description: 'D',
  tag: 'T',
  tagColor: '#123456',
  priority: 'high',
  reference: 'R',
};

describe('createDefaultBoard', () => {
  it('creates the three titled columns in order', () => {
    const b = ops.createDefaultBoard(['A', 'B', 'C'], ctx);
    expect(b.columns.map((c) => [c.title, c.order, c.tasks])).toEqual([
      ['A', 0, []],
      ['B', 1, []],
      ['C', 2, []],
    ]);
  });
});

describe('columns', () => {
  it('adds a column after the last active column', () => {
    const b = ops.addColumn(board(makeColumn('a', 4)), 'New', ctx);
    expect(b.columns[1]).toEqual({ id: 'gen-1', title: 'New', tasks: [], order: 5 });
  });

  it('renames a column', () => {
    expect(column(ops.renameColumn(board(makeColumn('a', 0)), 'a', 'Z'), 'a').title).toBe('Z');
  });

  it('moves a column left and right among active columns', () => {
    const start = board(makeColumn('a', 0), makeColumn('b', 1), makeColumn('c', 2));
    const order = (b: Board) => ops.activeColumns(b).map((c) => c.id);
    expect(order(ops.moveColumn(start, 'b', -1))).toEqual(['b', 'a', 'c']);
    expect(order(ops.moveColumn(start, 'b', 1))).toEqual(['a', 'c', 'b']);
  });

  it('moves correctly when imported columns share the same order', () => {
    const start = board(makeColumn('a', 0), makeColumn('b', 0));
    expect(ops.activeColumns(ops.moveColumn(start, 'b', -1)).map((c) => c.id)).toEqual(['b', 'a']);
  });

  it('ignores moves past the edges and moves of the archive', () => {
    const start = board(makeColumn('a', 0), makeColumn('arch', 1, [], { isArchive: true }));
    expect(ops.moveColumn(start, 'a', -1)).toBe(start);
    expect(ops.moveColumn(start, 'a', 1)).toBe(start);
    expect(ops.moveColumn(start, 'arch', -1)).toBe(start);
  });

  it('deletes a normal column with its tasks', () => {
    const b = ops.deleteColumn(board(makeColumn('a', 0, ['t']), makeColumn('b', 1)), 'a');
    expect(b.columns.map((c) => c.id)).toEqual(['b']);
  });

  it('refuses to delete the archive column', () => {
    const start = board(makeColumn('arch', 0, [], { isArchive: true }));
    expect(ops.deleteColumn(start, 'arch')).toBe(start);
  });

  it('keeps the archive after active columns regardless of order', () => {
    const b = board(makeColumn('arch', 0, [], { isArchive: true }), makeColumn('a', 5));
    expect(ops.orderedColumns(b).map((c) => c.id)).toEqual(['a', 'arch']);
  });
});

describe('tasks', () => {
  it('creates a task with generated id, column, order and dates', () => {
    const b = ops.createTask(board(makeColumn('a', 0, ['x'])), 'a', input, ctx);
    expect(task(b, 'gen-1')).toEqual({
      ...input,
      id: 'gen-1',
      columnId: 'a',
      order: 1,
      createdAt: NOW,
      updatedAt: NOW,
    });
  });

  it('does not create tasks in the archive', () => {
    const start = board(makeColumn('arch', 0, [], { isArchive: true }));
    expect(ops.createTask(start, 'arch', input, ctx)).toBe(start);
  });

  it('edits a task and touches updatedAt', () => {
    const start = board(makeColumn('a', 0, ['x']));
    const updated = task(ops.updateTask(start, 'x', { ...input, title: 'E' }, ctx), 'x');
    expect(updated).toMatchObject({
      title: 'E',
      priority: 'high',
      updatedAt: NOW,
      createdAt: OLD,
      columnId: 'a',
      order: 0,
    });
  });

  it('deletes a task', () => {
    expect(ids(ops.deleteTask(board(makeColumn('a', 0, ['x', 'y'])), 'x'), 'a')).toEqual(['y']);
  });

  it('toggles hidden', () => {
    const start = board(makeColumn('a', 0, ['x']));
    const hidden = ops.setTaskHidden(start, 'x', true);
    expect(task(hidden, 'x').hidden).toBe(true);
    expect(task(ops.setTaskHidden(hidden, 'x', false), 'x').hidden).toBe(false);
  });

  it('keeps references of untouched tasks and columns', () => {
    const start = board(makeColumn('a', 0, ['x', 'y']), makeColumn('b', 1, ['z']));
    const next = ops.updateTask(start, 'x', input, ctx);
    expect(column(next, 'b')).toBe(column(start, 'b'));
    expect(task(next, 'y')).toBe(task(start, 'y'));
  });
});

describe('moveTask', () => {
  const start = board(makeColumn('a', 0, ['1', '2', '3']), makeColumn('b', 1, ['4']));

  it('reorders within a column, placing before the target', () => {
    const next = ops.moveTask(start, '3', 'a', '1');
    expect(ids(next, 'a')).toEqual(['3', '1', '2']);
    expect(
      column(next, 'a')
        .tasks.map((t) => t.order)
        .toSorted(),
    ).toEqual([0, 1, 2]);
  });

  it('moves to the end when there is no target', () => {
    expect(ids(ops.moveTask(start, '1', 'a', null), 'a')).toEqual(['2', '3', '1']);
  });

  it('moves between columns, updating columnId and renumbering both', () => {
    const next = ops.moveTask(start, '2', 'b', '4');
    expect(ids(next, 'a')).toEqual(['1', '3']);
    expect(ids(next, 'b')).toEqual(['2', '4']);
    expect(task(next, '2').columnId).toBe('b');
    expect(task(next, '3').order).toBe(1);
  });

  it('respects the order field rather than array position', () => {
    const shuffled = board(
      { ...makeColumn('a', 0), tasks: [makeTask('p', 'a', 1), makeTask('q', 'a', 0)] },
      makeColumn('b', 1),
    );
    expect(ids(ops.moveTask(shuffled, 'q', 'b', null), 'a')).toEqual(['p']);
    expect(ids(ops.moveTask(shuffled, 'p', 'a', 'q'), 'a')).toEqual(['p', 'q']);
  });

  it('does not touch tasks whose order is unchanged', () => {
    const next = ops.moveTask(start, '3', 'b', null);
    expect(task(next, '1')).toBe(task(start, '1'));
  });

  it('returns the same board when nothing would change', () => {
    expect(ops.moveTask(start, '1', 'a', '2')).toBe(start);
    expect(ops.moveTask(start, '3', 'a', null)).toBe(start);
    expect(ops.moveTask(start, '1', 'a', '1')).toBe(start);
    expect(ops.moveTask(start, 'missing', 'a', null)).toBe(start);
    expect(ops.moveTask(start, '1', 'missing', null)).toBe(start);
  });

  it('refuses moves into or out of the archive', () => {
    const withArchive = board(makeColumn('a', 0, ['1']), makeColumn('arch', 1, ['2'], { isArchive: true }));
    expect(ops.moveTask(withArchive, '1', 'arch', null)).toBe(withArchive);
    expect(ops.moveTask(withArchive, '2', 'a', null)).toBe(withArchive);
  });
});

describe('archive and restore', () => {
  it('creates the archive on first use and stores origin and date', () => {
    const b = ops.archiveTask(board(makeColumn('a', 0, ['x'])), 'x', 'Archive', ctx);
    const archive = b.columns.find((c) => c.isArchive)!;
    expect(archive).toMatchObject({ id: 'gen-1', title: 'Archive', isArchive: true, order: 1 });
    expect(archive.tasks[0]).toMatchObject({ id: 'x', columnId: 'gen-1', archivedFromColumnId: 'a', archivedAt: NOW });
    expect(column(b, 'a').tasks).toEqual([]);
  });

  it('reuses an existing archive and appends', () => {
    const start = board(makeColumn('a', 0, ['x']), makeColumn('arch', 1, ['old'], { isArchive: true }));
    const b = ops.archiveTask(start, 'x', 'Archive', ctx);
    expect(b.columns.filter((c) => c.isArchive)).toHaveLength(1);
    expect(ids(b, 'arch')).toEqual(['old', 'x']);
  });

  it('does nothing when the task is already archived', () => {
    const start = board(makeColumn('arch', 1, ['x'], { isArchive: true }));
    expect(ops.archiveTask(start, 'x', 'Archive', ctx)).toBe(start);
  });

  const archived = (from: string) =>
    board(makeColumn('a', 0, ['y']), makeColumn('b', 1), {
      ...makeColumn('arch', 2, [], { isArchive: true }),
      tasks: [makeTask('x', 'arch', 0, { archivedFromColumnId: from, archivedAt: OLD })],
    });

  it('restores to the origin column, clearing archive data', () => {
    const b = ops.restoreTask(archived('b'), 'x', ctx);
    const restored = task(b, 'x');
    expect(ids(b, 'b')).toEqual(['x']);
    expect(restored.columnId).toBe('b');
    expect(restored.updatedAt).toBe(NOW);
    expect(restored).not.toHaveProperty('archivedFromColumnId');
    expect(restored).not.toHaveProperty('archivedAt');
    expect(column(b, 'arch').tasks).toEqual([]);
  });

  it('falls back to the first active column at the end', () => {
    const b = ops.restoreTask(archived('deleted'), 'x', ctx);
    expect(ids(b, 'a')).toEqual(['y', 'x']);
  });

  it('is a no-op when no active column exists', () => {
    const start = board({
      ...makeColumn('arch', 0, [], { isArchive: true }),
      tasks: [makeTask('x', 'arch', 0, { archivedFromColumnId: 'gone' })],
    });
    expect(ops.restoreTask(start, 'x', ctx)).toBe(start);
  });

  it('only restores tasks that are in the archive', () => {
    const start = board(makeColumn('a', 0, ['x']));
    expect(ops.restoreTask(start, 'x', ctx)).toBe(start);
  });
});

describe('next step', () => {
  const start = board(makeColumn('a', 0, ['x']));

  it('sets and edits the next step, touching updatedAt', () => {
    const t = task(ops.setNextStep(start, 'x', 'Call', ctx), 'x');
    expect(t.nextStep).toBe('Call');
    expect(t.updatedAt).toBe(NOW);
  });

  it('removes the field when the next step is emptied', () => {
    const withStep = ops.setNextStep(start, 'x', 'Call', ctx);
    expect(task(ops.setNextStep(withStep, 'x', '  ', ctx), 'x')).not.toHaveProperty('nextStep');
  });

  it('completes: clears the field and appends a comment', () => {
    const withStep = ops.setNextStep(start, 'x', 'Call', ctx);
    const t = task(ops.completeNextStep(withStep, 'x', 'Done: Call', laterCtx), 'x');
    expect(t).not.toHaveProperty('nextStep');
    expect(t.comments).toEqual([{ id: 'gen-1', text: 'Done: Call', createdAt: LATER, updatedAt: LATER }]);
    expect(t.updatedAt).toBe(LATER);
  });

  it('does nothing when there is no next step', () => {
    expect(ops.completeNextStep(start, 'x', 'Done', ctx)).toBe(start);
  });
});

describe('comments', () => {
  const withComment = () => ops.addComment(board(makeColumn('a', 0, ['x'])), 'x', 'hello', ctx);

  it('adds a comment and updates the task date', () => {
    const t = task(withComment(), 'x');
    expect(t.comments).toEqual([{ id: 'gen-1', text: 'hello', createdAt: NOW, updatedAt: NOW }]);
    expect(t.updatedAt).toBe(NOW);
  });

  it('edits keeping id and createdAt', () => {
    const t = task(ops.updateComment(withComment(), 'x', 'gen-1', 'edited', laterCtx), 'x');
    expect(t.comments![0]).toEqual({ id: 'gen-1', text: 'edited', createdAt: NOW, updatedAt: LATER });
    expect(t.updatedAt).toBe(LATER);
  });

  it('deletes and updates the task date', () => {
    const t = task(ops.deleteComment(withComment(), 'x', 'gen-1', laterCtx), 'x');
    expect(t.comments).toEqual([]);
    expect(t.updatedAt).toBe(LATER);
  });
});
