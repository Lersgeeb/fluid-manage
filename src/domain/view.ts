import { orderedColumns, sortedTasks } from './board';
import { PRIORITIES } from './constants';
import type { Board, Column, Comment, Priority, Task } from './types';

export type SortBy = 'manual' | 'priority' | 'createdAt' | 'updatedAt';
export type SortDirection = 'asc' | 'desc';
export type CardTextMode = 'description' | 'nextStep' | 'lastComment';

export interface ViewOptions {
  tag: string | null;
  priority: Priority | null;
  showHidden: boolean;
  showArchive: boolean;
  sortBy: SortBy;
  sortDirection: SortDirection;
}

export const DEFAULT_VIEW: ViewOptions = {
  tag: null,
  priority: null,
  showHidden: false,
  showArchive: false,
  sortBy: 'manual',
  sortDirection: 'asc',
};

export interface VisibleColumn {
  column: Column;
  tasks: Task[];
}

const timestamp = (value: string) => {
  const time = Date.parse(value);
  return Number.isNaN(time) ? 0 : time;
};

const PRIORITY_RANK = new Map(PRIORITIES.map((priority, rank) => [priority, rank]));

function comparator(sortBy: Exclude<SortBy, 'manual'>): (a: Task, b: Task) => number {
  if (sortBy === 'priority') {
    return (a, b) => (PRIORITY_RANK.get(a.priority) ?? 0) - (PRIORITY_RANK.get(b.priority) ?? 0);
  }
  return (a, b) => timestamp(a[sortBy]) - timestamp(b[sortBy]);
}

function arrange(tasks: Task[], view: ViewOptions): Task[] {
  if (view.sortBy === 'manual') return tasks;
  const compare = comparator(view.sortBy);
  return tasks.toSorted(view.sortDirection === 'asc' ? compare : (a, b) => compare(b, a));
}

export function getVisibleColumns(board: Board, view: ViewOptions): VisibleColumn[] {
  const isVisible = (task: Task) =>
    (view.showHidden || !task.hidden) &&
    (view.tag === null || task.tag === view.tag) &&
    (view.priority === null || task.priority === view.priority);

  return orderedColumns(board)
    .filter((column) => view.showArchive || !column.isArchive)
    .map((column) => ({ column, tasks: arrange(sortedTasks(column).filter(isVisible), view) }));
}

export function priorityCounts(tasks: readonly Task[]): Record<Priority, number> {
  const counts: Record<Priority, number> = { low: 0, medium: 0, high: 0, critical: 0 };
  for (const task of tasks) counts[task.priority] += 1;
  return counts;
}

export interface TagOption {
  tag: string;
  color: string;
}

function mostUsed(counts: Map<string, number>): string {
  let best = '';
  let bestCount = 0;
  for (const [value, count] of counts) {
    if (count > bestCount) {
      best = value;
      bestCount = count;
    }
  }
  return best;
}

/** One entry per tag. Older data can color the same tag differently, so the majority wins. */
export function collectTagOptions(board: Board): TagOption[] {
  const usage = new Map<string, Map<string, number>>();
  for (const column of board.columns) {
    for (const task of column.tasks) {
      const colors = usage.get(task.tag) ?? new Map<string, number>();
      colors.set(task.tagColor, (colors.get(task.tagColor) ?? 0) + 1);
      usage.set(task.tag, colors);
    }
  }
  return [...usage]
    .map(([tag, colors]) => ({ tag, color: mostUsed(colors) }))
    .toSorted((a, b) => a.tag.localeCompare(b.tag));
}

/** Most recent first. Uses dates because array position is not guaranteed in imported data. */
export function latestComments(task: Task, count: number): Comment[] {
  return (task.comments ?? [])
    .map((comment, index) => ({ comment, index, time: timestamp(comment.createdAt) }))
    .sort((a, b) => b.time - a.time || b.index - a.index)
    .slice(0, count)
    .map((entry) => entry.comment);
}

export function cardText(task: Task, mode: CardTextMode): string {
  if (mode === 'description') return task.description;
  if (mode === 'nextStep') return task.nextStep ?? '';
  return latestComments(task, 1)[0]?.text ?? '';
}

const COLUMN_DROP_PREFIX = 'column:';

/** Namespaced so a column can never collide with a task id from an imported file. */
export const columnDropId = (columnId: string) => `${COLUMN_DROP_PREFIX}${columnId}`;

export const isColumnDropId = (id: string) => id.startsWith(COLUMN_DROP_PREFIX);

export interface DropTarget {
  toColumnId: string;
  beforeTaskId: string | null;
}

/** Translates a drag gesture over the visible cards into a board position. */
export function resolveDrop(
  columns: VisibleColumn[],
  activeId: string,
  overId: string,
  placeAfter: boolean,
): DropTarget | null {
  if (activeId === overId) return null;
  const source = columns.find((c) => c.tasks.some((t) => t.id === activeId));
  if (!source) return null;

  if (isColumnDropId(overId)) {
    return { toColumnId: overId.slice(COLUMN_DROP_PREFIX.length), beforeTaskId: null };
  }

  const target = columns.find((c) => c.tasks.some((t) => t.id === overId));
  if (!target) return null;

  const overIndex = target.tasks.findIndex((t) => t.id === overId);
  const after =
    target === source ? source.tasks.findIndex((t) => t.id === activeId) < overIndex : placeAfter;
  const beforeTaskId = after ? (target.tasks[overIndex + 1]?.id ?? null) : overId;
  return { toColumnId: target.column.id, beforeTaskId };
}
