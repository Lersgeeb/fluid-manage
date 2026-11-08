import {
  closestCorners,
  DndContext,
  DragOverlay,
  KeyboardSensor,
  pointerWithin,
  useSensor,
  useSensors,
  type Announcements,
  type CollisionDetection,
  type DragEndEvent,
  type DragStartEvent,
  type ScreenReaderInstructions,
} from '@dnd-kit/core';
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import { useMemo, useState } from 'react';
import type { Task } from '../domain/types';
import { isColumnDropId, resolveDrop, type CardTextMode, type DropTarget, type VisibleColumn } from '../domain/view';
import { useI18n } from '../i18n/I18nProvider';
import { CardPointerSensor } from './CardPointerSensor';
import { ColumnView, type ColumnActions } from './ColumnView';
import { InlineNameInput } from './InlineNameInput';
import { CardContent } from './TaskCard';

const POINTER_ACTIVATION = { activationConstraint: { distance: 4 } };
const KEYBOARD_OPTIONS = { coordinateGetter: sortableKeyboardCoordinates };

/** Prefers the card under the pointer; the keyboard has no pointer to go by. */
const detectCollision: CollisionDetection = (args) => {
  const within = pointerWithin(args);
  if (within.length === 0) return closestCorners(args);
  const cards = within.filter((collision) => !isColumnDropId(String(collision.id)));
  return cards.length > 0 ? cards : within;
};

interface BoardViewProps {
  columns: VisibleColumn[];
  textMode: CardTextMode;
  actions: ColumnActions;
  addingColumn: boolean;
  onAddColumn: (title: string) => void;
  onCancelAddColumn: () => void;
  onMoveTask: (taskId: string, drop: DropTarget) => void;
}

export function BoardView({
  columns,
  textMode,
  actions,
  addingColumn,
  onAddColumn,
  onCancelAddColumn,
  onMoveTask,
}: BoardViewProps) {
  const { t } = useI18n();
  const [activeTask, setActiveTask] = useState<Task | null>(null);
  const sensors = useSensors(useSensor(CardPointerSensor, POINTER_ACTIVATION), useSensor(KeyboardSensor, KEYBOARD_OPTIONS));

  const accessibility = useMemo(() => {
    const title = (data: { current?: Record<string, unknown> }) => String(data.current?.title ?? '');
    const announcements: Announcements = {
      onDragStart: ({ active }) => t('dnd.start', { title: title(active.data) }),
      onDragOver: ({ active }) => t('dnd.over', { title: title(active.data) }),
      onDragEnd: ({ active }) => t('dnd.end', { title: title(active.data) }),
      onDragCancel: ({ active }) => t('dnd.cancel', { title: title(active.data) }),
    };
    const screenReaderInstructions: ScreenReaderInstructions = { draggable: t('dnd.instructions') };
    return { announcements, screenReaderInstructions };
  }, [t]);

  const handleDragStart = ({ active }: DragStartEvent) => {
    const task = columns.flatMap((c) => c.tasks).find((candidate) => candidate.id === active.id);
    setActiveTask(task ?? null);
  };

  const handleDragEnd = ({ active, over }: DragEndEvent) => {
    setActiveTask(null);
    if (!over) return;
    const dragged = active.rect.current.translated;
    const placeAfter = dragged ? dragged.top + dragged.height / 2 > over.rect.top + over.rect.height / 2 : false;
    const drop = resolveDrop(columns, String(active.id), String(over.id), placeAfter);
    if (drop) onMoveTask(String(active.id), drop);
  };

  const activeColumnCount = columns.filter((c) => !c.column.isArchive).length;

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={detectCollision}
      accessibility={accessibility}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={() => setActiveTask(null)}
    >
      <main className="board">
        {columns.map(({ column, tasks }, index) => (
          <ColumnView
            key={column.id}
            column={column}
            tasks={tasks}
            textMode={textMode}
            isFirst={index === 0}
            isLast={index === activeColumnCount - 1}
            actions={actions}
          />
        ))}
        {addingColumn ? (
          <div className="board__add">
            <InlineNameInput onCommit={onAddColumn} onCancel={onCancelAddColumn} />
          </div>
        ) : null}
      </main>
      <DragOverlay>
        {activeTask ? (
          <div className={`card card--${activeTask.priority} card--overlay`}>
            <CardContent task={activeTask} textMode={textMode} />
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
