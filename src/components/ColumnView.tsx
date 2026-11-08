import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { ChevronLeft, ChevronRight, MoreVertical, Plus } from 'lucide-react';
import { memo, useId, useMemo, useState } from 'react';
import { PRIORITIES } from '../domain/constants';
import type { Column, Task } from '../domain/types';
import { columnDropId, priorityCounts, type CardTextMode } from '../domain/view';
import { useI18n } from '../i18n/I18nProvider';
import { Dropdown } from './Dropdown';
import { InlineNameInput } from './InlineNameInput';
import { TaskCard } from './TaskCard';

export interface ColumnActions {
  rename: (columnId: string, title: string) => void;
  move: (columnId: string, direction: -1 | 1) => void;
  remove: (column: Column) => void;
  addTask: (columnId: string) => void;
  openTask: (taskId: string) => void;
}

function ColumnSummary({ tasks }: { tasks: Task[] }) {
  const { t } = useI18n();
  const titleId = useId();
  const counts = useMemo(() => priorityCounts(tasks), [tasks]);

  return (
    <footer className="summary">
      <p id={titleId} className="summary__title">
        {t('column.summary')}
      </p>
      <ul className="summary__list" aria-labelledby={titleId}>
        {PRIORITIES.map((priority) => (
          <li key={priority} className="summary__item" title={t(`priority.${priority}`)}>
            <span className={`summary__dot priority--${priority}`} />
            <span className="visually-hidden">{t(`priority.${priority}`)}: </span>
            {counts[priority]}
          </li>
        ))}
      </ul>
    </footer>
  );
}

interface ColumnViewProps {
  column: Column;
  tasks: Task[];
  textMode: CardTextMode;
  canDrag: boolean;
  isFirst: boolean;
  isLast: boolean;
  actions: ColumnActions;
}

export const ColumnView = memo(function ColumnView({
  column,
  tasks,
  textMode,
  canDrag,
  isFirst,
  isLast,
  actions,
}: ColumnViewProps) {
  const { t } = useI18n();
  const [renaming, setRenaming] = useState(false);
  const isArchive = Boolean(column.isArchive);
  const draggable = canDrag && !isArchive;
  const { setNodeRef, isOver } = useDroppable({ id: columnDropId(column.id), disabled: !draggable });
  const taskIds = useMemo(() => tasks.map((task) => task.id), [tasks]);
  const name = column.title;

  return (
    <section
      ref={setNodeRef}
      aria-label={name}
      className={`column${isArchive ? ' column--archive' : ''}${isOver ? ' column--over' : ''}`}
    >
      <header className="column__header">
        {renaming ? (
          <InlineNameInput
            initialValue={name}
            onCommit={(title) => {
              setRenaming(false);
              actions.rename(column.id, title);
            }}
            onCancel={() => setRenaming(false)}
          />
        ) : (
          <>
            <h2 className="column__title">{name}</h2>
            <span className="column__count">{tasks.length}</span>
            <div className="column__tools">
              {isArchive ? null : (
                <>
                  <button
                    type="button"
                    className="icon-btn"
                    aria-label={t('column.addTask', { name })}
                    onClick={() => actions.addTask(column.id)}
                  >
                    <Plus size={17} aria-hidden />
                  </button>
                  <button
                    type="button"
                    className="icon-btn"
                    aria-label={t('column.moveLeft', { name })}
                    disabled={isFirst}
                    onClick={() => actions.move(column.id, -1)}
                  >
                    <ChevronLeft size={16} aria-hidden />
                  </button>
                  <button
                    type="button"
                    className="icon-btn"
                    aria-label={t('column.moveRight', { name })}
                    disabled={isLast}
                    onClick={() => actions.move(column.id, 1)}
                  >
                    <ChevronRight size={16} aria-hidden />
                  </button>
                </>
              )}
              <Dropdown
                triggerClassName="icon-btn"
                label={t('column.options', { name })}
                trigger={<MoreVertical size={16} aria-hidden />}
              >
                <button type="button" role="menuitem" className="menu__item" onClick={() => setRenaming(true)}>
                  {t('column.renameItem')}
                </button>
                {isArchive ? null : (
                  <button
                    type="button"
                    role="menuitem"
                    className="menu__item menu__item--danger"
                    onClick={() => actions.remove(column)}
                  >
                    {t('column.deleteItem')}
                  </button>
                )}
              </Dropdown>
            </div>
          </>
        )}
      </header>

      <div className="column__tasks">
        <SortableContext items={taskIds} strategy={verticalListSortingStrategy}>
          {tasks.map((task) => (
            <TaskCard key={task.id} task={task} textMode={textMode} canDrag={draggable} onOpen={actions.openTask} />
          ))}
        </SortableContext>
        {tasks.length === 0 ? <p className="column__empty">{t('column.empty')}</p> : null}
      </div>

      <ColumnSummary tasks={tasks} />
    </section>
  );
});
