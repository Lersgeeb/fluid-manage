import { BoardPage } from './components/BoardPage';
import { ConfirmProvider } from './components/ConfirmProvider';
import { NoticeProvider } from './components/NoticeProvider';
import { I18nProvider } from './i18n/I18nProvider';

export default function App() {
  return (
    <I18nProvider>
      <NoticeProvider>
        <ConfirmProvider>
          <BoardPage />
        </ConfirmProvider>
      </NoticeProvider>
    </I18nProvider>
  );
}
