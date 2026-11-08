import { useEffect, useState } from 'react';
import { useNotify } from '../components/NoticeProvider';
import { createDefaultBoard } from '../domain/board';
import type { Board } from '../domain/types';
import { useI18n } from '../i18n/I18nProvider';
import type { Translate } from '../i18n/messages';
import { browserStorage, loadBoard, saveBoard, STORAGE_KEY, type LoadResult } from '../storage/boardStorage';
import { createBoardStore, type BoardStore } from './boardStore';
import { createOperationContext } from './operationContext';

export function defaultBoard(t: Translate): Board {
  return createDefaultBoard([t('column.todo'), t('column.inProgress'), t('column.done')], createOperationContext());
}

/** Creates the store for this page load and wires it to the browser lifecycle. */
export function useBoardSession(): BoardStore {
  const { t } = useI18n();
  const notify = useNotify();

  const [{ store, status }] = useState(() => {
    const storage = browserStorage();
    const loaded: LoadResult = loadBoard(storage);
    return {
      status: loaded.status,
      store: createBoardStore({
        initial: loaded.status === 'ok' ? loaded.board : defaultBoard(t),
        save: (board) => saveBoard(board, storage),
        onSaveError: () => notify('error', 'notice.saveFailed'),
      }),
    };
  });

  useEffect(() => {
    if (status === 'corrupt') notify('error', 'notice.loadCorrupt');
    if (status === 'unavailable') notify('error', 'notice.loadUnavailable');
  }, [status, notify]);

  useEffect(() => {
    const flushWhenHidden = () => {
      if (document.visibilityState === 'hidden') store.flush();
    };
    window.addEventListener('pagehide', store.flush);
    document.addEventListener('visibilitychange', flushWhenHidden);
    return () => {
      window.removeEventListener('pagehide', store.flush);
      document.removeEventListener('visibilitychange', flushWhenHidden);
    };
  }, [store]);

  // Without this, two open tabs would silently overwrite each other's work.
  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key !== STORAGE_KEY) return;
      const loaded = loadBoard(browserStorage());
      if (loaded.status === 'ok') store.applyExternal(loaded.board);
      if (loaded.status === 'empty') store.applyExternal(defaultBoard(t));
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [store, t]);

  return store;
}
