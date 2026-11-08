import {
  Archive,
  ArchiveRestore,
  ArrowDown,
  ArrowUp,
  CircleCheck,
  Eye,
  EyeOff,
  Pencil,
  Save,
  Trash2,
  X,
} from 'lucide-react';
import { useEffect, useId, useRef, useState, type ComponentProps, type KeyboardEvent, type ReactNode } from 'react';
import type { Comment, Task, TaskInput } from '../domain/types';
import { latestComments } from '../domain/view';
import { useI18n } from '../i18n/I18nProvider';
import { formatDateTime } from '../i18n/formatDate';
import { Modal } from './Modal';
import { PriorityPill, TagChip } from './TaskChips';
import { TaskForm } from './TaskForm';

export interface TaskDetailActions {
  save: (taskId: string, input: Partial<TaskInput>) => void;
  setHidden: (taskId: string, hidden: boolean) => void;
  archive: (taskId: string) => void;
  restore: (taskId: string) => void;
  remove: (task: Task) => void;
  setNextStep: (taskId: string, nextStep: string) => void;
  completeNextStep: (task: Task) => void;
  addComment: (taskId: string, text: string) => void;
  updateComment: (taskId: string, commentId: string, text: string) => void;
  deleteComment: (taskId: string, commentId: string) => void;
}

export function CreateTaskDialog({ onCreate, onClose }: { onCreate: (input: TaskInput) => void; onClose: () => void }) {
  const { t } = useI18n();
  const titleId = useId();
  return (
    <Modal labelledBy={titleId} onClose={onClose}>
      <div className="modal__header">
        <h2 id={titleId} className="modal__title">
          {t('task.new')}
        </h2>
        <button type="button" className="icon-btn" aria-label={t('common.close')} onClick={onClose}>
          <X size={18} aria-hidden />
        </button>
      </div>
      <TaskForm submitLabel={t('task.create')} onSubmit={onCreate} />
    </Modal>
  );
}

/** Leaving edit mode removes the focused control, so focus returns to the pencil. */
function useFocusWhenDone(editing: boolean) {
  const target = useRef<HTMLButtonElement>(null);
  const wasEditing = useRef(editing);
  useEffect(() => {
    if (wasEditing.current && !editing) target.current?.focus();
    wasEditing.current = editing;
  }, [editing]);
  return target;
}

/** Stops Escape from reaching the dialog, which would close it and lose the other edits. */
const cancelOnEscape = (cancel: () => void) => (event: KeyboardEvent) => {
  if (event.key !== 'Escape') return;
  event.preventDefault();
  event.stopPropagation();
  cancel();
};

function ToolButton({ label, accent, ...props }: ComponentProps<'button'> & { label: string; accent?: boolean }) {
  return (
    <button
      type="button"
      className={`icon-btn${accent ? ' icon-btn--accent' : ''}`}
      aria-label={label}
      title={label}
      {...props}
    />
  );
}

function EditTools({ saveLabel, onCancel, ...save }: ComponentProps<'button'> & { saveLabel: string; onCancel: () => void }) {
  const { t } = useI18n();
  return (
    <>
      <ToolButton label={saveLabel} accent {...save}>
        <Save size={16} aria-hidden />
      </ToolButton>
      <ToolButton label={t('common.cancel')} onClick={onCancel}>
        <X size={16} aria-hidden />
      </ToolButton>
    </>
  );
}

interface DetailCardProps {
  title: string;
  /** Replaces the title in the top row, pushing it to its own line. */
  lead?: ReactNode;
  tools?: ReactNode;
  children: ReactNode;
}

function DetailCard({ title, lead, tools, children }: DetailCardProps) {
  const heading = <h3 className="detail-card__title">{title}</h3>;
  return (
    <div className="detail-card">
      <div className="detail-card__header">
        {lead ?? heading}
        <div className="detail-card__tools">{tools}</div>
      </div>
      {lead ? heading : null}
      {children}
    </div>
  );
}

interface SectionProps {
  task: Task;
  actions: TaskDetailActions;
}

function SummaryCard({ task, actions }: SectionProps) {
  const { t } = useI18n();
  const formId = useId();
  const [editing, setEditing] = useState(false);
  const pencil = useFocusWhenDone(editing);
  const cancel = () => setEditing(false);

  if (editing) {
    return (
      <div onKeyDown={cancelOnEscape(cancel)}>
        <DetailCard
          title={t('task.summary')}
          tools={<EditTools saveLabel={t('task.saveSummary')} type="submit" form={formId} onCancel={cancel} />}
        >
          <TaskForm
            formId={formId}
            initial={task}
            showDescription={false}
            autoFocus
            onSubmit={(input) => {
              // The description has its own card and may have been saved meanwhile.
              actions.save(task.id, { ...input, description: task.description });
              setEditing(false);
            }}
          />
        </DetailCard>
      </div>
    );
  }

  return (
    <DetailCard
      title={t('task.summary')}
      lead={<TagChip task={task} />}
      tools={
        <ToolButton ref={pencil} label={t('task.editSummary')} accent onClick={() => setEditing(true)}>
          <Pencil size={16} aria-hidden />
        </ToolButton>
      }
    >
      <p className="detail-summary">
        <span>{task.title}</span>
        <PriorityPill priority={task.priority} />
      </p>
      {task.reference ? (
        <p className="detail-reference">{t('task.referenceValue', { reference: task.reference })}</p>
      ) : null}
    </DetailCard>
  );
}

function DescriptionCard({ task, actions }: SectionProps) {
  const { t } = useI18n();
  const [draft, setDraft] = useState<string | null>(null);
  const pencil = useFocusWhenDone(draft !== null);
  const cancel = () => setDraft(null);

  if (draft !== null) {
    const save = () => {
      if (draft !== task.description) actions.save(task.id, { description: draft });
      setDraft(null);
    };
    return (
      <div onKeyDown={cancelOnEscape(cancel)}>
        <DetailCard
          title={t('task.description')}
          tools={<EditTools saveLabel={t('task.saveDescription')} onClick={save} onCancel={cancel} />}
        >
          <label className="field">
            <span className="field__label">{t('task.description')}</span>
            <textarea
              className="input"
              rows={4}
              value={draft}
              autoFocus
              onChange={(event) => setDraft(event.target.value)}
            />
          </label>
        </DetailCard>
      </div>
    );
  }

  return (
    <DetailCard
      title={t('task.description')}
      tools={
        <ToolButton ref={pencil} label={t('task.editDescription')} accent onClick={() => setDraft(task.description)}>
          <Pencil size={16} aria-hidden />
        </ToolButton>
      }
    >
      {task.description ? (
        <p className="detail-text">{task.description}</p>
      ) : (
        <p className="detail-text detail-text--empty">{t('task.noDescription')}</p>
      )}
    </DetailCard>
  );
}

function NextStepCard({ task, actions }: SectionProps) {
  const { t } = useI18n();
  const [draft, setDraft] = useState<string | null>(null);
  const editing = draft !== null;
  const pencil = useFocusWhenDone(editing);
  const cancel = () => setDraft(null);
  const current = task.nextStep ?? '';

  const save = () => {
    if (draft !== null && draft.trim() !== current) actions.setNextStep(task.id, draft);
    setDraft(null);
  };

  const card = (
    <DetailCard
      title={t('nextStep.label')}
      tools={
        <>
          {editing ? (
            <EditTools saveLabel={t('nextStep.save')} onClick={save} onCancel={cancel} />
          ) : (
            <ToolButton ref={pencil} label={t('nextStep.edit')} accent onClick={() => setDraft(current)}>
              <Pencil size={16} aria-hidden />
            </ToolButton>
          )}
          <ToolButton
            label={t('nextStep.complete')}
            accent
            disabled={editing || !task.nextStep}
            onClick={() => {
              actions.completeNextStep(task);
              // This button disables itself, which would otherwise drop keyboard focus.
              pencil.current?.focus();
            }}
          >
            <CircleCheck size={17} aria-hidden />
          </ToolButton>
        </>
      }
    >
      {editing ? (
        <label className="field">
          <span className="field__label">{t('nextStep.label')}</span>
          <textarea
            className="input"
            rows={3}
            value={draft}
            autoFocus
            onChange={(event) => setDraft(event.target.value)}
          />
        </label>
      ) : current ? (
        <p className="detail-text">{current}</p>
      ) : (
        <p className="detail-text detail-text--empty">{t('nextStep.empty')}</p>
      )}
    </DetailCard>
  );

  return editing ? <div onKeyDown={cancelOnEscape(cancel)}>{card}</div> : card;
}

function CommentItem({ comment, taskId, actions }: { comment: Comment; taskId: string; actions: TaskDetailActions }) {
  const { t, language } = useI18n();
  const [draft, setDraft] = useState<string | null>(null);
  const pencil = useFocusWhenDone(draft !== null);
  const cancel = () => setDraft(null);

  if (draft !== null) {
    return (
      <li className="comment" onKeyDown={cancelOnEscape(cancel)}>
        <div className="comment__body">
          <textarea
            className="input"
            rows={2}
            aria-label={t('comments.editText')}
            value={draft}
            autoFocus
            onChange={(event) => setDraft(event.target.value)}
          />
        </div>
        <div className="detail-card__tools">
          <EditTools
            saveLabel={t('comments.save')}
            disabled={!draft.trim()}
            onClick={() => {
              actions.updateComment(taskId, comment.id, draft.trim());
              setDraft(null);
            }}
            onCancel={cancel}
          />
        </div>
      </li>
    );
  }

  return (
    <li className="comment">
      <div className="comment__body">
        <p className="comment__text">{comment.text}</p>
        <time className="comment__date" dateTime={comment.createdAt}>
          {t('comments.created', { date: formatDateTime(comment.createdAt, language) })}
        </time>
      </div>
      <div className="detail-card__tools">
        <ToolButton ref={pencil} label={t('comments.edit')} accent onClick={() => setDraft(comment.text)}>
          <Pencil size={15} aria-hidden />
        </ToolButton>
        <ToolButton label={t('comments.delete')} onClick={() => actions.deleteComment(taskId, comment.id)}>
          <Trash2 size={15} aria-hidden />
        </ToolButton>
      </div>
    </li>
  );
}

function CommentsCard({ task, actions }: SectionProps) {
  const { t } = useI18n();
  const [draft, setDraft] = useState('');
  const textarea = useRef<HTMLTextAreaElement>(null);
  const [newestFirst, setNewestFirst] = useState(true);
  const newestToOldest = latestComments(task, task.comments?.length ?? 0);
  const comments = newestFirst ? newestToOldest : newestToOldest.toReversed();

  return (
    <DetailCard
      title={t('comments.title')}
      tools={
        <ToolButton
          label={t(newestFirst ? 'comments.showOldestFirst' : 'comments.showNewestFirst')}
          accent
          onClick={() => setNewestFirst(!newestFirst)}
        >
          {newestFirst ? <ArrowDown size={16} aria-hidden /> : <ArrowUp size={16} aria-hidden />}
        </ToolButton>
      }
    >
      <label className="field">
        <span className="field__label">{t('comments.new')}</span>
        <textarea
          ref={textarea}
          className="input"
          rows={2}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
        />
      </label>
      <div className="detail-card__actions">
        <button
          type="button"
          className="btn"
          disabled={!draft.trim()}
          onClick={() => {
            actions.addComment(task.id, draft.trim());
            setDraft('');
            // This button disables itself, which would otherwise drop keyboard focus.
            textarea.current?.focus();
          }}
        >
          {t('comments.add')}
        </button>
      </div>
      {comments.length > 0 ? (
        <ul className="comments">
          {comments.map((comment) => (
            <CommentItem key={comment.id} comment={comment} taskId={task.id} actions={actions} />
          ))}
        </ul>
      ) : null}
    </DetailCard>
  );
}

interface TaskDetailDialogProps {
  task: Task;
  isArchived: boolean;
  actions: TaskDetailActions;
  onClose: () => void;
}

export function TaskDetailDialog({ task, isArchived, actions, onClose }: TaskDetailDialogProps) {
  const { t, language } = useI18n();
  const titleId = useId();

  return (
    <Modal labelledBy={titleId} onClose={onClose} className="modal--detail">
      <div className="detail-header">
        <h2 id={titleId} className="modal__title">
          {task.title}
        </h2>
      </div>

      <div className="detail-body">
        <SummaryCard task={task} actions={actions} />
        <DescriptionCard task={task} actions={actions} />
        <NextStepCard task={task} actions={actions} />
        <p className="detail-dates">
          <span>{t('task.created', { date: formatDateTime(task.createdAt, language) })}</span>
          <span>{t('task.updated', { date: formatDateTime(task.updatedAt, language) })}</span>
        </p>
        <CommentsCard task={task} actions={actions} />
      </div>

      <div className="detail-footer">
        <button type="button" className="btn" onClick={() => actions.setHidden(task.id, !task.hidden)}>
          {task.hidden ? <Eye size={15} aria-hidden /> : <EyeOff size={15} aria-hidden />}
          {task.hidden ? t('task.show') : t('task.hide')}
        </button>
        {isArchived ? (
          <button type="button" className="btn" onClick={() => actions.restore(task.id)}>
            <ArchiveRestore size={15} aria-hidden />
            {t('task.restore')}
          </button>
        ) : (
          <button type="button" className="btn" onClick={() => actions.archive(task.id)}>
            <Archive size={15} aria-hidden />
            {t('task.archive')}
          </button>
        )}
        <button type="button" className="btn btn--danger-ghost" onClick={() => actions.remove(task)}>
          <Trash2 size={15} aria-hidden />
          {t('task.delete')}
        </button>
        <button type="button" className="btn detail-footer__close" onClick={onClose}>
          {t('common.close')}
        </button>
      </div>
    </Modal>
  );
}
