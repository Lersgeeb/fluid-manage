import { X } from 'lucide-react';
import { createContext, use, useCallback, useEffect, useState, type ReactNode } from 'react';
import { useI18n } from '../i18n/I18nProvider';
import type { MessageKey } from '../i18n/messages';

type NoticeKind = 'error' | 'success';
type Notify = (kind: NoticeKind, message: MessageKey) => void;

interface Notice {
  kind: NoticeKind;
  message: MessageKey;
}

const SUCCESS_TIMEOUT_MS = 4000;

const NotifyContext = createContext<Notify | null>(null);

function NoticeItem({ notice, onDismiss }: { notice: Notice; onDismiss: (message: MessageKey) => void }) {
  const { t } = useI18n();
  const { kind, message } = notice;

  // Errors stay until dismissed: they usually mean data is at risk.
  useEffect(() => {
    if (kind !== 'success') return;
    const timer = setTimeout(() => onDismiss(message), SUCCESS_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, [kind, message, onDismiss]);

  return (
    <div role={kind === 'error' ? 'alert' : 'status'} className={`notice notice--${kind}`}>
      <span>{t(message)}</span>
      <button type="button" className="icon-btn" aria-label={t('notice.dismiss')} onClick={() => onDismiss(message)}>
        <X size={16} aria-hidden />
      </button>
    </div>
  );
}

export function NoticeProvider({ children }: { children: ReactNode }) {
  const [notices, setNotices] = useState<Notice[]>([]);

  // Keyed by message: a repeatedly failing autosave shows a single notice.
  const notify = useCallback<Notify>((kind, message) => {
    setNotices((current) =>
      current.some((notice) => notice.message === message) ? current : [...current, { kind, message }],
    );
  }, []);

  const dismiss = useCallback((message: MessageKey) => {
    setNotices((current) => current.filter((notice) => notice.message !== message));
  }, []);

  return (
    <NotifyContext value={notify}>
      {children}
      <div className="notices">
        {notices.map((notice) => (
          <NoticeItem key={notice.message} notice={notice} onDismiss={dismiss} />
        ))}
      </div>
    </NotifyContext>
  );
}

export function useNotify(): Notify {
  const value = use(NotifyContext);
  if (!value) throw new Error('useNotify must be used within NoticeProvider');
  return value;
}
