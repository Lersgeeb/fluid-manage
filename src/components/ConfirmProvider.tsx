import { createContext, use, useCallback, useId, useState, type ReactNode } from 'react';
import { useI18n } from '../i18n/I18nProvider';
import { Modal } from './Modal';

interface ConfirmOptions {
  title: string;
  message: string;
  confirmLabel: string;
}

type Confirm = (options: ConfirmOptions) => Promise<boolean>;

const ConfirmContext = createContext<Confirm | null>(null);

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const { t } = useI18n();
  const titleId = useId();
  const [request, setRequest] = useState<(ConfirmOptions & { resolve: (answer: boolean) => void }) | null>(null);

  const confirm = useCallback<Confirm>(
    (options) => new Promise((resolve) => setRequest({ ...options, resolve })),
    [],
  );

  const settle = (answer: boolean) => {
    request?.resolve(answer);
    setRequest(null);
  };

  return (
    <ConfirmContext value={confirm}>
      {children}
      {request ? (
        <Modal role="alertdialog" labelledBy={titleId} onClose={() => settle(false)} className="modal--confirm">
          <h2 id={titleId} className="modal__title">
            {request.title}
          </h2>
          <p className="confirm__message">{request.message}</p>
          <div className="modal__actions">
            <button type="button" className="btn" onClick={() => settle(false)} autoFocus>
              {t('common.cancel')}
            </button>
            <button type="button" className="btn btn--danger" onClick={() => settle(true)}>
              {request.confirmLabel}
            </button>
          </div>
        </Modal>
      ) : null}
    </ConfirmContext>
  );
}

export function useConfirm(): Confirm {
  const value = use(ConfirmContext);
  if (!value) throw new Error('useConfirm must be used within ConfirmProvider');
  return value;
}
