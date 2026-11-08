import { useCallback, useMemo, useState, useSyncExternalStore } from 'react';
import * as ops from '../domain/board';
import type { Column, Task } from '../domain/types';
import {
  collectTagOptions,
  DEFAULT_VIEW,
  getVisibleColumns,
  moveWithinView,
  NO_MANUAL_COLUMNS,
  type CardTextMode,
  type DropTarget,
  type ViewOptions,
} from '../domain/view';
import { useI18n } from '../i18n/I18nProvider';
import type { MessageKey } from '../i18n/messages';
import { exportCsv, exportExcel, exportJson, reportLabels } from '../reports/exporters';
import { buildReportRows, reportColumns, type ReportScope } from '../reports/reportRows';
import { browserStorage, clearBoard } from '../storage/boardStorage';
import { ImportError, readBoardFile, type ImportFailure } from '../storage/importFile';
import { defaultBoard, useBoardSession } from '../store/useBoardSession';
import { AppHeader, type DataActions } from './AppHeader';
import { BoardView } from './BoardView';
import type { ColumnActions } from './ColumnView';
import { useConfirm } from './ConfirmProvider';
import { FiltersBar } from './FiltersBar';
import { useNotify } from './NoticeProvider';
import { CreateTaskDialog, TaskDetailDialog, type TaskDetailActions } from './TaskDialog';

type DialogState = { mode: 'create'; columnId: string } | { mode: 'detail'; taskId: string } | null;

const IMPORT_ERRORS: Record<ImportFailure, MessageKey> = {
  tooLarge: 'notice.importTooLarge',
  unreadable: 'notice.importUnreadable',
  invalid: 'notice.importInvalid',
};

export function BoardPage() {
  const { t } = useI18n();
  const notify = useNotify();
  const confirm = useConfirm();
  const store = useBoardSession();
  const board = useSyncExternalStore(store.subscribe, store.getBoard);

  const [view, setView] = useState<ViewOptions>(DEFAULT_VIEW);
  const [textMode, setTextMode] = useState<CardTextMode>('description');
  const [dialog, setDialog] = useState<DialogState>(null);
  const [addingColumn, setAddingColumn] = useState(false);
  const [manualColumns, setManualColumns] = useState(NO_MANUAL_COLUMNS);

  const tags = useMemo(() => collectTagOptions(board), [board]);

  // A tag can disappear (deleted task, import) while still selected as filter.
  const effectiveTag = tags.some(({ tag }) => tag === view.tag) ? view.tag : null;
  const effectiveView = useMemo(() => ({ ...view, tag: effectiveTag }), [view, effectiveTag]);
  const columns = useMemo(
    () => getVisibleColumns(board, effectiveView, manualColumns),
    [board, effectiveView, manualColumns],
  );

  const closeDialog = useCallback(() => setDialog(null), []);
  const changeView = useCallback((patch: Partial<ViewOptions>) => {
    setView((v) => ({ ...v, ...patch }));
    // Choosing a sort again is how columns reordered by hand get sorted again.
    if (patch.sortBy !== undefined || patch.sortDirection !== undefined) setManualColumns(NO_MANUAL_COLUMNS);
  }, []);

  const columnActions = useMemo<ColumnActions>(
    () => ({
      rename: (columnId, title) => store.update((b) => ops.renameColumn(b, columnId, title)),
      move: (columnId, direction) => store.update((b) => ops.moveColumn(b, columnId, direction)),
      remove: async (column: Column) => {
        const count = column.tasks.length;
        const message =
          count === 0
            ? t('column.deleteEmpty')
            : count === 1
              ? t('column.deleteOne')
              : t('column.deleteMany', { count });
        const accepted = await confirm({
          title: t('column.deleteTitle', { name: column.title }),
          message,
          confirmLabel: t('common.delete'),
        });
        if (accepted) store.update((b) => ops.deleteColumn(b, column.id));
      },
      addTask: (columnId) => setDialog({ mode: 'create', columnId }),
      openTask: (taskId) => setDialog({ mode: 'detail', taskId }),
    }),
    [store, confirm, t],
  );

  const taskActions = useMemo<TaskDetailActions>(
    () => ({
      save: (taskId, input) => store.update((b, ctx) => ops.updateTask(b, taskId, input, ctx)),
      setHidden: (taskId, hidden) => store.update((b) => ops.setTaskHidden(b, taskId, hidden)),
      archive: (taskId) => {
        store.update((b, ctx) => ops.archiveTask(b, taskId, t('column.archive'), ctx));
        setDialog(null);
      },
      restore: (taskId) => {
        setDialog(null);
        if (ops.activeColumns(store.getBoard()).length === 0) {
          notify('error', 'notice.restoreNoColumn');
          return;
        }
        store.update((b, ctx) => ops.restoreTask(b, taskId, ctx));
      },
      remove: async (task: Task) => {
        const accepted = await confirm({
          title: t('task.deleteTitle', { title: task.title }),
          message: t('task.deleteBody'),
          confirmLabel: t('common.delete'),
        });
        if (!accepted) return;
        store.update((b) => ops.deleteTask(b, task.id));
        setDialog(null);
      },
      setNextStep: (taskId, nextStep) => store.update((b, ctx) => ops.setNextStep(b, taskId, nextStep, ctx)),
      completeNextStep: (task) => {
        const text = t('nextStep.completedComment', { step: task.nextStep ?? '' });
        store.update((b, ctx) => ops.completeNextStep(b, task.id, text, ctx));
      },
      addComment: (taskId, text) => store.update((b, ctx) => ops.addComment(b, taskId, text, ctx)),
      updateComment: (taskId, commentId, text) =>
        store.update((b, ctx) => ops.updateComment(b, taskId, commentId, text, ctx)),
      deleteComment: async (taskId, commentId) => {
        const accepted = await confirm({
          title: t('comments.deleteTitle'),
          message: t('comments.deleteBody'),
          confirmLabel: t('common.delete'),
        });
        if (accepted) store.update((b, ctx) => ops.deleteComment(b, taskId, commentId, ctx));
      },
    }),
    [store, confirm, notify, t],
  );

  const addColumn = useCallback(
    (title: string) => {
      setAddingColumn(false);
      store.update((b, ctx) => ops.addColumn(b, title, ctx));
    },
    [store],
  );
  const startAddingColumn = useCallback(() => setAddingColumn(true), []);
  const cancelAddingColumn = useCallback(() => setAddingColumn(false), []);

  const moveTask = useCallback(
    (taskId: string, drop: DropTarget) => {
      let sortOverridden = false;
      store.update((b) => {
        const result = moveWithinView(b, effectiveView, manualColumns, taskId, drop);
        sortOverridden = result.sortOverridden;
        return result.board;
      });
      if (sortOverridden) setManualColumns((current) => new Set(current).add(drop.toColumnId));
    },
    [store, effectiveView, manualColumns],
  );

  const reportRows = (scope: ReportScope) =>
    buildReportRows(reportColumns(store.getBoard(), effectiveView, scope, manualColumns));

  const runExport = async (work: () => void | Promise<void>) => {
    try {
      await work();
    } catch {
      notify('error', 'notice.exportFailed');
    }
  };

  const dataActions: DataActions = {
    importFile: async (file) => {
      try {
        const imported = await readBoardFile(file);
        const accepted = await confirm({
          title: t('data.importTitle'),
          message: t('data.importBody', { file: file.name }),
          confirmLabel: t('data.importConfirm'),
        });
        if (!accepted) return;
        store.replace(imported);
        setManualColumns(NO_MANUAL_COLUMNS);
        setDialog(null);
        notify('success', 'notice.imported');
      } catch (error) {
        notify('error', error instanceof ImportError ? IMPORT_ERRORS[error.reason] : 'notice.importUnreadable');
      }
    },
    exportJson: () => void runExport(() => exportJson(store.getBoard())),
    exportCsv: (scope) => void runExport(() => exportCsv(reportRows(scope), reportLabels(t))),
    exportExcel: (scope) => void runExport(() => exportExcel(reportRows(scope), reportLabels(t))),
    clearBoard: async () => {
      const accepted = await confirm({
        title: t('data.clearTitle'),
        message: t('data.clearBody'),
        confirmLabel: t('data.clearConfirm'),
      });
      if (!accepted) return;
      if (!clearBoard(browserStorage())) {
        notify('error', 'notice.clearFailed');
        return;
      }
      store.applyExternal(defaultBoard(t));
      setView(DEFAULT_VIEW);
    },
  };

  const detailTask = dialog?.mode === 'detail' ? ops.findTask(board, dialog.taskId) : undefined;
  const detailIsArchived = board.columns.some(
    (column) => column.isArchive && detailTask !== undefined && column.tasks.includes(detailTask),
  );

  return (
    <div className="app">
      <AppHeader
        actions={dataActions}
        view={effectiveView}
        onViewChange={changeView}
        onAddColumn={startAddingColumn}
      />
      <FiltersBar
        view={effectiveView}
        tags={tags}
        textMode={textMode}
        onViewChange={changeView}
        onTextModeChange={setTextMode}
      />
      <BoardView
        columns={columns}
        textMode={textMode}
        actions={columnActions}
        addingColumn={addingColumn}
        onAddColumn={addColumn}
        onCancelAddColumn={cancelAddingColumn}
        onMoveTask={moveTask}
      />
      {dialog?.mode === 'create' ? (
        <CreateTaskDialog
          onClose={closeDialog}
          onCreate={(input) => {
            store.update((b, ctx) => ops.createTask(b, dialog.columnId, input, ctx));
            setDialog(null);
          }}
        />
      ) : null}
      {detailTask ? (
        <TaskDetailDialog
          key={detailTask.id}
          task={detailTask}
          isArchived={detailIsArchived}
          actions={taskActions}
          onClose={closeDialog}
        />
      ) : null}
    </div>
  );
}
