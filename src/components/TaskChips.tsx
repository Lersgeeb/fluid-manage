import { safeColor } from '../domain/constants';
import type { Priority, Task } from '../domain/types';
import { useI18n } from '../i18n/I18nProvider';

export function TagChip({ task }: { task: Pick<Task, 'tag' | 'tagColor'> }) {
  return (
    <span className="tag">
      <span data-testid="tag-dot" className="tag__dot" style={{ backgroundColor: safeColor(task.tagColor) }} />
      <span className="tag__label">{task.tag}</span>
    </span>
  );
}

export function PriorityPill({ priority }: { priority: Priority }) {
  const { t } = useI18n();
  return <span className={`priority priority--${priority}`}>{t(`priority.${priority}`)}</span>;
}
