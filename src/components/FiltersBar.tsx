import { memo, useMemo } from 'react';
import { PRIORITIES, PRIORITY_COLORS, safeColor } from '../domain/constants';
import type { Priority } from '../domain/types';
import type { CardTextMode, SortBy, SortDirection, TagOption, ViewOptions } from '../domain/view';
import { useI18n } from '../i18n/I18nProvider';
import { ColorSelect, type ColorSelectOption } from './ColorSelect';

const SORT_OPTIONS: readonly SortBy[] = ['manual', 'priority', 'createdAt', 'updatedAt'];
const TEXT_MODES: readonly CardTextMode[] = ['description', 'nextStep', 'lastComment'];

interface FiltersBarProps {
  view: ViewOptions;
  tags: TagOption[];
  textMode: CardTextMode;
  onViewChange: (patch: Partial<ViewOptions>) => void;
  onTextModeChange: (mode: CardTextMode) => void;
}

export const FiltersBar = memo(function FiltersBar({
  view,
  tags,
  textMode,
  onViewChange,
  onTextModeChange,
}: FiltersBarProps) {
  const { t } = useI18n();
  const isManual = view.sortBy === 'manual';

  const tagOptions = useMemo<ColorSelectOption[]>(
    () => [
      { value: '', label: t('filters.all') },
      // An empty value already means "all", so an untagged entry can't be listed.
      ...tags.filter(({ tag }) => tag).map(({ tag, color }) => ({ value: tag, label: tag, color: safeColor(color) })),
    ],
    [tags, t],
  );

  const priorityOptions = useMemo<ColorSelectOption[]>(
    () => [
      { value: '', label: t('filters.all') },
      ...PRIORITIES.map((priority) => ({
        value: priority,
        label: t(`priority.${priority}`),
        color: PRIORITY_COLORS[priority],
      })),
    ],
    [t],
  );

  return (
    <div className="filters">
      <ColorSelect
        label={t('filters.tag')}
        value={view.tag ?? ''}
        options={tagOptions}
        onChange={(value) => onViewChange({ tag: value || null })}
      />

      <ColorSelect
        label={t('filters.priority')}
        value={view.priority ?? ''}
        options={priorityOptions}
        onChange={(value) => onViewChange({ priority: (value || null) as Priority | null })}
      />

      <label className="field">
        <span className="field__label">{t('filters.cardText')}</span>
        <select
          className="input"
          value={textMode}
          onChange={(event) => onTextModeChange(event.target.value as CardTextMode)}
        >
          {TEXT_MODES.map((mode) => (
            <option key={mode} value={mode}>
              {t(`cardText.${mode}`)}
            </option>
          ))}
        </select>
      </label>

      <label className="field">
        <span className="field__label">{t('filters.sortBy')}</span>
        <select
          className="input"
          value={view.sortBy}
          onChange={(event) => onViewChange({ sortBy: event.target.value as SortBy })}
        >
          {SORT_OPTIONS.map((option) => (
            <option key={option} value={option}>
              {t(`sort.${option}`)}
            </option>
          ))}
        </select>
      </label>

      <label className="field">
        <span className="field__label">{t('filters.direction')}</span>
        <select
          className="input"
          value={view.sortDirection}
          disabled={isManual}
          onChange={(event) => onViewChange({ sortDirection: event.target.value as SortDirection })}
        >
          <option value="asc">{t('filters.asc')}</option>
          <option value="desc">{t('filters.desc')}</option>
        </select>
      </label>
    </div>
  );
});
