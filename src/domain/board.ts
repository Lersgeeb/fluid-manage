import type { Board, Column, Comment, OperationContext, Task, TaskInput } from './types';

const byOrder = (a: { order: number }, b: { order: number }) => a.order - b.order;

export const sortedTasks = (column: Column): Task[] => column.tasks.toSorted(byOrder);

export const activeColumns = (board: Board): Column[] => board.columns.filter((c) => !c.isArchive).toSorted(byOrder);

export const archiveColumn = (board: Board): Column | undefined => board.columns.find((c) => c.isArchive);

/** Display order: the archive always sits after the active columns. */
export const orderedColumns = (board: Board): Column[] => [
  ...activeColumns(board),
  ...board.columns.filter((c) => c.isArchive).toSorted(byOrder),
];

function nextOrder(items: readonly { order: number }[]): number {
  let max = -1;
  for (const item of items) if (item.order > max) max = item.order;
  return max + 1;
}

function locate(board: Board, taskId: string): { column: Column; task: Task } | undefined {
  for (const column of board.columns) {
    const task = column.tasks.find((t) => t.id === taskId);
    if (task) return { column, task };
  }
  return undefined;
}

export const findTask = (board: Board, taskId: string): Task | undefined => locate(board, taskId)?.task;

const replaceColumns = (board: Board, update: (column: Column) => Column): Board => ({
  ...board,
  columns: board.columns.map(update),
});

function updateOneTask(board: Board, taskId: string, update: (task: Task) => Task): Board {
  const found = locate(board, taskId);
  if (!found) return board;
  return replaceColumns(board, (column) =>
    column === found.column
      ? { ...column, tasks: column.tasks.map((t) => (t === found.task ? update(t) : t)) }
      : column,
  );
}

function omit<T extends object, K extends keyof T>(source: T, ...keys: K[]): Omit<T, K> {
  const copy = { ...source };
  for (const key of keys) delete copy[key];
  return copy;
}

const newComment = (text: string, ctx: OperationContext): Comment => {
  const now = ctx.now();
  return { id: ctx.id(), text, createdAt: now, updatedAt: now };
};

const blankColumn = (title: string, order: number, ctx: OperationContext): Column => ({
  id: ctx.id(),
  title,
  tasks: [],
  order,
});

export function createDefaultBoard(titles: readonly string[], ctx: OperationContext): Board {
  return { columns: titles.map((title, index) => blankColumn(title, index, ctx)) };
}

export function addColumn(board: Board, title: string, ctx: OperationContext): Board {
  return { ...board, columns: [...board.columns, blankColumn(title, nextOrder(activeColumns(board)), ctx)] };
}

export function renameColumn(board: Board, columnId: string, title: string): Board {
  return replaceColumns(board, (column) => (column.id === columnId ? { ...column, title } : column));
}

export function moveColumn(board: Board, columnId: string, direction: -1 | 1): Board {
  const active = activeColumns(board);
  const index = active.findIndex((c) => c.id === columnId);
  const targetIndex = index + direction;
  const target = active[targetIndex];
  const current = active[index];
  if (!current || !target) return board;

  active[index] = target;
  active[targetIndex] = current;
  // Rewriting every position (not just swapping two) handles imported ties.
  const positions = new Map(active.map((column, position) => [column.id, position]));
  return replaceColumns(board, (column) => {
    const order = positions.get(column.id);
    return order === undefined || order === column.order ? column : { ...column, order };
  });
}

export function deleteColumn(board: Board, columnId: string): Board {
  const column = board.columns.find((c) => c.id === columnId);
  if (!column || column.isArchive) return board;
  return { ...board, columns: board.columns.filter((c) => c !== column) };
}

export function createTask(board: Board, columnId: string, input: TaskInput, ctx: OperationContext): Board {
  const target = board.columns.find((c) => c.id === columnId);
  if (!target || target.isArchive) return board;
  const now = ctx.now();
  const task: Task = {
    ...input,
    id: ctx.id(),
    columnId,
    order: nextOrder(target.tasks),
    createdAt: now,
    updatedAt: now,
  };
  return replaceColumns(board, (column) =>
    column === target ? { ...column, tasks: [...column.tasks, task] } : column,
  );
}

export function updateTask(board: Board, taskId: string, input: Partial<TaskInput>, ctx: OperationContext): Board {
  return updateOneTask(board, taskId, (task) => ({ ...task, ...input, updatedAt: ctx.now() }));
}

export function deleteTask(board: Board, taskId: string): Board {
  const found = locate(board, taskId);
  if (!found) return board;
  return replaceColumns(board, (column) =>
    column === found.column ? { ...column, tasks: column.tasks.filter((t) => t !== found.task) } : column,
  );
}

export function setTaskHidden(board: Board, taskId: string, hidden: boolean): Board {
  return updateOneTask(board, taskId, (task) => ({ ...task, hidden }));
}

/** Writes sequential positions, reusing tasks that are already correct. */
function renumber(tasks: Task[], columnId: string): Task[] {
  return tasks.map((task, order) =>
    task.order === order && task.columnId === columnId ? task : { ...task, order, columnId },
  );
}

/**
 * Moves a task before `beforeTaskId`, or to the end when it is null.
 *
 * Addressing by neighbor rather than index keeps this correct while filters
 * or hidden tasks make the on-screen positions differ from the real ones.
 */
export function moveTask(board: Board, taskId: string, toColumnId: string, beforeTaskId: string | null): Board {
  const found = locate(board, taskId);
  const target = board.columns.find((c) => c.id === toColumnId);
  if (!found || !target || found.column.isArchive || target.isArchive || beforeTaskId === taskId) return board;

  const sameColumn = found.column === target;
  const original = sortedTasks(target);
  const destination = original.filter((t) => t !== found.task);
  const beforeIndex = beforeTaskId === null ? -1 : destination.findIndex((t) => t.id === beforeTaskId);
  destination.splice(beforeIndex < 0 ? destination.length : beforeIndex, 0, found.task);

  if (sameColumn && destination.every((t, i) => t === original[i])) return board;

  const remaining = sortedTasks(found.column).filter((t) => t !== found.task);
  return replaceColumns(board, (column) => {
    if (column === target) return { ...column, tasks: renumber(destination, column.id) };
    if (column === found.column) return { ...column, tasks: renumber(remaining, column.id) };
    return column;
  });
}

/** Makes a column's manual order match the given sequence of task ids. */
export function applyTaskOrder(board: Board, columnId: string, taskIds: readonly string[]): Board {
  const positions = new Map(taskIds.map((id, position) => [id, position]));
  return replaceColumns(board, (column) =>
    column.id === columnId
      ? {
          ...column,
          tasks: column.tasks.map((task) => {
            const order = positions.get(task.id);
            return order === undefined || order === task.order ? task : { ...task, order };
          }),
        }
      : column,
  );
}

export function archiveTask(board: Board, taskId: string, archiveTitle: string, ctx: OperationContext): Board {
  const found = locate(board, taskId);
  if (!found || found.column.isArchive) return board;

  const existing = archiveColumn(board);
  const archive = existing ?? { ...blankColumn(archiveTitle, nextOrder(board.columns), ctx), isArchive: true };
  const archived: Task = {
    ...found.task,
    columnId: archive.id,
    order: nextOrder(archive.tasks),
    archivedFromColumnId: found.column.id,
    archivedAt: ctx.now(),
  };
  const columns = board.columns.map((column) =>
    column === found.column ? { ...column, tasks: column.tasks.filter((t) => t !== found.task) } : column,
  );
  const withArchive = existing ? columns : [...columns, archive];
  return {
    ...board,
    columns: withArchive.map((column) =>
      column.id === archive.id ? { ...column, tasks: [...column.tasks, archived] } : column,
    ),
  };
}

export function restoreTask(board: Board, taskId: string, ctx: OperationContext): Board {
  const found = locate(board, taskId);
  if (!found?.column.isArchive) return board;

  const active = activeColumns(board);
  const target = active.find((c) => c.id === found.task.archivedFromColumnId) ?? active[0];
  if (!target) return board;

  const restored: Task = {
    ...omit(found.task, 'archivedFromColumnId', 'archivedAt'),
    columnId: target.id,
    order: nextOrder(target.tasks),
    updatedAt: ctx.now(),
  };
  return replaceColumns(board, (column) => {
    if (column === found.column) return { ...column, tasks: column.tasks.filter((t) => t !== found.task) };
    if (column === target) return { ...column, tasks: [...column.tasks, restored] };
    return column;
  });
}

export function setNextStep(board: Board, taskId: string, nextStep: string, ctx: OperationContext): Board {
  const trimmed = nextStep.trim();
  return updateOneTask(board, taskId, (task) => ({
    ...(trimmed ? { ...task, nextStep: trimmed } : omit(task, 'nextStep')),
    updatedAt: ctx.now(),
  }));
}

export function completeNextStep(board: Board, taskId: string, commentText: string, ctx: OperationContext): Board {
  if (!findTask(board, taskId)?.nextStep) return board;
  return updateOneTask(board, taskId, (task) => ({
    ...omit(task, 'nextStep'),
    comments: [...(task.comments ?? []), newComment(commentText, ctx)],
    updatedAt: ctx.now(),
  }));
}

export function addComment(board: Board, taskId: string, text: string, ctx: OperationContext): Board {
  return updateOneTask(board, taskId, (task) => ({
    ...task,
    comments: [...(task.comments ?? []), newComment(text, ctx)],
    updatedAt: ctx.now(),
  }));
}

export function updateComment(
  board: Board,
  taskId: string,
  commentId: string,
  text: string,
  ctx: OperationContext,
): Board {
  return updateOneTask(board, taskId, (task) => {
    const now = ctx.now();
    return {
      ...task,
      comments: task.comments?.map((c) => (c.id === commentId ? { ...c, text, updatedAt: now } : c)),
      updatedAt: now,
    };
  });
}

export function deleteComment(board: Board, taskId: string, commentId: string, ctx: OperationContext): Board {
  return updateOneTask(board, taskId, (task) => ({
    ...task,
    comments: task.comments?.filter((c) => c.id !== commentId),
    updatedAt: ctx.now(),
  }));
}
