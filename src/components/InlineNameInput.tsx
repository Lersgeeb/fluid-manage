import { useRef, useState } from 'react';
import { useI18n } from '../i18n/I18nProvider';

interface InlineNameInputProps {
  initialValue?: string;
  onCommit: (value: string) => void;
  onCancel: () => void;
}

export function InlineNameInput({ initialValue = '', onCommit, onCancel }: InlineNameInputProps) {
  const { t } = useI18n();
  const [value, setValue] = useState(initialValue);
  const finished = useRef(false);

  // Enter unmounts the input, which also fires blur; only the first one counts.
  const finish = (commit: boolean) => {
    if (finished.current) return;
    finished.current = true;
    const trimmed = value.trim();
    if (commit && trimmed) onCommit(trimmed);
    else onCancel();
  };

  return (
    <input
      className="input input--inline"
      aria-label={t('column.name')}
      value={value}
      autoFocus
      onChange={(event) => setValue(event.target.value)}
      onBlur={() => finish(true)}
      onKeyDown={(event) => {
        if (event.key === 'Enter') finish(true);
        if (event.key === 'Escape') finish(false);
      }}
    />
  );
}
