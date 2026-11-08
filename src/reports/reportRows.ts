import { orderedColumns, sortedTasks } from '../domain/board';
import type { Board, Priority } from '../domain/types';
import { getVisibleColumns, latestComments, type ViewOptions, type VisibleColumn } from '../domain/view';

export type ReportScope = 'all' | 'visible';

export interface ReportRow {
  status: string;
  tag: string;
  priority: Priority;
  name: string;
  reference: string;
  nextStep: string;
  createdAt: string;
  updatedAt: string;
  description: string;
  lastThreeComments: string;
  lastComment: string;
}

export interface ReportLabels {
  headers: Record<keyof ReportRow, string>;
  priorities: Record<Priority, string>;
}

/** Column order shared by both report formats; the last comment is Excel-only. */
export const CSV_FIELDS = [
  'status',
  'tag',
  'priority',
  'name',
  'reference',
  'nextStep',
  'createdAt',
  'updatedAt',
  'description',
  'lastThreeComments',
] as const satisfies readonly (keyof ReportRow)[];

export const EXCEL_FIELDS = [...CSV_FIELDS, 'lastComment'] as const satisfies readonly (keyof ReportRow)[];

export function reportColumns(
  board: Board,
  view: ViewOptions,
  scope: ReportScope,
  manualColumnIds?: ReadonlySet<string>,
): VisibleColumn[] {
  if (scope === 'visible') return getVisibleColumns(board, view, manualColumnIds);
  return orderedColumns(board).map((column) => ({ column, tasks: sortedTasks(column) }));
}

const pad = (value: number) => String(value).padStart(2, '0');

function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  const day = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  return `${day} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function buildReportRows(columns: VisibleColumn[]): ReportRow[] {
  return columns.flatMap(({ column, tasks }) =>
    tasks.map((task) => {
      const recent = latestComments(task, 3);
      return {
        status: column.title,
        tag: task.tag,
        priority: task.priority,
        name: task.title,
        reference: task.reference,
        nextStep: task.nextStep ?? '',
        createdAt: formatDate(task.createdAt),
        updatedAt: formatDate(task.updatedAt),
        description: task.description,
        lastThreeComments: recent.map((comment) => comment.text).join('\n'),
        lastComment: recent[0]?.text ?? '',
      };
    }),
  );
}
