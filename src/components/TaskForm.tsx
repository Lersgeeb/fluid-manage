import { useState, type FormEvent } from 'react';
import { DEFAULT_PRIORITY, DEFAULT_TAG_COLOR, PRIORITIES, TAG_COLOR_PRESETS } from '../domain/constants';
import type { Priority, TaskInput } from '../domain/types';
import { useI18n } from '../i18n/I18nProvider';

const SIX_DIGIT_HEX = /^#[0-9a-f]{6}$/i;

const EMPTY_TASK: TaskInput = {
  title: '',
  description: '',
  tag: '',
  tagColor: DEFAULT_TAG_COLOR,
  priority: DEFAULT_PRIORITY,
  reference: '',
};

interface TaskFormProps {
  initial?: TaskInput;
  /** Label of the built-in submit button. */
  submitLabel?: string;
  /** Set when an external button submits this form; hides the built-in one. */
  formId?: string;
  showDescription?: boolean;
  autoFocus?: boolean;
  onSubmit: (input: TaskInput) => void;
}

export function TaskForm({
  initial = EMPTY_TASK,
  submitLabel,
  formId,
  showDescription = true,
  autoFocus = false,
  onSubmit,
}: TaskFormProps) {
  const { t } = useI18n();
  const [draft, setDraft] = useState<TaskInput>({
    title: initial.title,
    description: initial.description,
    tag: initial.tag,
    tagColor: initial.tagColor,
    priority: initial.priority,
    reference: initial.reference,
  });
  const [submitted, setSubmitted] = useState(false);

  const set = <K extends keyof TaskInput>(field: K, value: TaskInput[K]) =>
    setDraft((current) => ({ ...current, [field]: value }));

  const title = draft.title.trim();
  const tag = draft.tag.trim();
  const titleError = submitted && !title;
  const tagError = submitted && !tag;

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    setSubmitted(true);
    if (title && tag) onSubmit({ ...draft, title, tag });
  };

  return (
    <form id={formId} className="form" onSubmit={handleSubmit} noValidate>
      <label className="field">
        <span className="field__label">
          {t('task.title')} <span aria-hidden>*</span>
        </span>
        <input
          className="input"
          value={draft.title}
          autoFocus={autoFocus}
          aria-required
          aria-invalid={titleError}
          onChange={(event) => set('title', event.target.value)}
        />
        {titleError ? <span className="field__error">{t('task.titleRequired')}</span> : null}
      </label>

      {showDescription ? (
        <label className="field">
          <span className="field__label">{t('task.description')}</span>
          <textarea
            className="input"
            rows={3}
            value={draft.description}
            onChange={(event) => set('description', event.target.value)}
          />
        </label>
      ) : null}

      <div className="form__row">
        <label className="field field--grow">
          <span className="field__label">
            {t('task.tag')} <span aria-hidden>*</span>
          </span>
          <input
            className="input"
            value={draft.tag}
            aria-required
            aria-invalid={tagError}
            onChange={(event) => set('tag', event.target.value)}
          />
          {tagError ? <span className="field__error">{t('task.tagRequired')}</span> : null}
        </label>
        <label className="field">
          <span className="field__label">{t('task.tagColor')}</span>
          <input
            type="color"
            className="input input--color"
            // A color picker only accepts #rrggbb; other imported values stay untouched unless changed here.
            value={SIX_DIGIT_HEX.test(draft.tagColor) ? draft.tagColor : DEFAULT_TAG_COLOR}
            onChange={(event) => set('tagColor', event.target.value)}
          />
        </label>
      </div>

      <div className="swatches" role="group" aria-label={t('task.tagColorPresets')}>
        {TAG_COLOR_PRESETS.map(({ id, color }) => (
          <button
            key={id}
            type="button"
            className="swatch"
            style={{ backgroundColor: color }}
            aria-label={t(`tagColor.${id}`)}
            title={t(`tagColor.${id}`)}
            aria-pressed={draft.tagColor.toLowerCase() === color}
            onClick={() => set('tagColor', color)}
          />
        ))}
      </div>

      <div className="form__row">
        <label className="field field--grow">
          <span className="field__label">{t('task.priority')}</span>
          <select
            className="input"
            value={draft.priority}
            onChange={(event) => set('priority', event.target.value as Priority)}
          >
            {PRIORITIES.map((priority) => (
              <option key={priority} value={priority}>
                {t(`priority.${priority}`)}
              </option>
            ))}
          </select>
        </label>
        <label className="field field--grow">
          <span className="field__label">{t('task.reference')}</span>
          <input className="input" value={draft.reference} onChange={(event) => set('reference', event.target.value)} />
        </label>
      </div>

      {formId ? null : (
        <div className="modal__actions">
          <button type="submit" className="btn btn--primary">
            {submitLabel}
          </button>
        </div>
      )}
    </form>
  );
}
