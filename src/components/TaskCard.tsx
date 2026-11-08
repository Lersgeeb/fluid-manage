import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { EyeOff, GripVertical } from 'lucide-react';
import { memo, type MouseEvent } from 'react';
import type { Task } from '../domain/types';
import { cardText, type CardTextMode } from '../domain/view';
import { useI18n } from '../i18n/I18nProvider';
import { PriorityPill, TagChip } from './TaskChips';

/** Mice open cards with a double click; keyboards (detail 0) and touch screens can't. */
const opensOnSingleActivation = (event: MouseEvent) =>
  event.detail === 0 || window.matchMedia?.('(hover: none)').matches;

interface CardContentProps {
  task: Task;
  textMode: CardTextMode;
  onOpen?: (taskId: string) => void;
}

/** Split from the sortable shell so drag updates don't re-render card content. */
export const CardContent = memo(function CardContent({ task, textMode, onOpen }: CardContentProps) {
  const { t } = useI18n();
  const text = cardText(task, textMode);

  return (
    <div className="card__content">
      <button
        type="button"
        className="card__title"
        onClick={(event) => {
          if (opensOnSingleActivation(event)) onOpen?.(task.id);
        }}
      >
        {task.title}
      </button>
      {text ? <p className="card__text">{text}</p> : null}
      <div className="card__meta">
        <TagChip task={task} />
        <PriorityPill priority={task.priority} />
        {task.hidden ? (
          <span className="card__hidden">
            <EyeOff size={13} aria-hidden />
            {t('task.hiddenBadge')}
          </span>
        ) : null}
        {task.reference ? (
          <span className="card__reference" title={task.reference}>
            {task.reference}
          </span>
        ) : null}
      </div>
    </div>
  );
});

interface TaskCardProps extends CardContentProps {
  canDrag: boolean;
}

export const TaskCard = memo(function TaskCard({ task, textMode, onOpen, canDrag }: TaskCardProps) {
  const { t } = useI18n();
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({
    id: task.id,
    disabled: !canDrag,
    data: { title: task.title },
  });

  return (
    <article
      ref={setNodeRef}
      aria-label={task.title}
      className={`card card--${task.priority}${canDrag ? ' card--draggable' : ''}${task.hidden ? ' card--muted' : ''}${isDragging ? ' card--dragging' : ''}`}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      onDoubleClick={() => onOpen?.(task.id)}
      {...listeners}
    >
      <CardContent task={task} textMode={textMode} onOpen={onOpen} />
      {canDrag ? (
        <button
          type="button"
          ref={setActivatorNodeRef}
          className="card__handle"
          data-drag-handle
          {...attributes}
          aria-label={t('task.drag', { title: task.title })}
        >
          <GripVertical size={16} aria-hidden />
        </button>
      ) : null}
    </article>
  );
});
