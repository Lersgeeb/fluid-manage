import { ChevronDown, LayoutPanelLeft, Moon, Plus, Sun } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { ViewOptions } from '../domain/view';
import { useI18n } from '../i18n/I18nProvider';
import { LANGUAGES, type Language, type MessageKey } from '../i18n/messages';
import type { ReportScope } from '../reports/reportRows';
import { applyTheme, initialTheme, persistTheme, type Theme } from '../theme';
import { Dropdown } from './Dropdown';

export interface DataActions {
  importFile: (file: File) => void;
  exportJson: () => void;
  exportCsv: (scope: ReportScope) => void;
  exportExcel: (scope: ReportScope) => void;
  clearBoard: () => void;
}

const LANGUAGE_NAMES: Record<Language, string> = { es: 'Español', en: 'English' };

function ThemeToggle() {
  const { t } = useI18n();
  const [theme, setTheme] = useState<Theme>(initialTheme);

  useEffect(() => applyTheme(theme), [theme]);

  const next: Theme = theme === 'dark' ? 'light' : 'dark';
  return (
    <button
      type="button"
      className="icon-btn"
      aria-label={t(theme === 'dark' ? 'app.themeToLight' : 'app.themeToDark')}
      onClick={() => {
        persistTheme(next);
        setTheme(next);
      }}
    >
      {theme === 'dark' ? <Sun size={18} aria-hidden /> : <Moon size={18} aria-hidden />}
    </button>
  );
}

function DataMenu({ actions }: { actions: DataActions }) {
  const { t } = useI18n();
  const [fileInput, setFileInput] = useState<HTMLInputElement | null>(null);

  const items: { label: MessageKey; run: () => void; danger?: boolean }[] = [
    { label: 'data.importJson', run: () => fileInput?.click() },
    { label: 'data.exportJson', run: actions.exportJson },
    { label: 'data.csvAll', run: () => actions.exportCsv('all') },
    { label: 'data.csvVisible', run: () => actions.exportCsv('visible') },
    { label: 'data.excelAll', run: () => actions.exportExcel('all') },
    { label: 'data.excelVisible', run: () => actions.exportExcel('visible') },
    { label: 'data.clear', run: actions.clearBoard, danger: true },
  ];

  return (
    <>
      {/* Stays mounted: picking a file outlives the menu that opened the picker. */}
      <input
        ref={setFileInput}
        type="file"
        accept=".json,application/json"
        className="visually-hidden"
        tabIndex={-1}
        aria-label={t('data.file')}
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = '';
          if (file) actions.importFile(file);
        }}
      />
      <Dropdown
        trigger={
          <>
            {t('data.menu')}
            <ChevronDown size={15} aria-hidden />
          </>
        }
      >
        {items.map((item) => (
          <button
            key={item.label}
            type="button"
            role="menuitem"
            className={`menu__item${item.danger ? ' menu__item--danger' : ''}`}
            onClick={item.run}
          >
            {t(item.label)}
          </button>
        ))}
      </Dropdown>
    </>
  );
}

interface ViewMenuProps {
  view: ViewOptions;
  onViewChange: (patch: Partial<ViewOptions>) => void;
}

function ViewMenu({ view, onViewChange }: ViewMenuProps) {
  const { t } = useI18n();
  // The toggles live behind a button, so it has to show when one is in effect.
  const active = view.showHidden || view.showArchive;

  return (
    <Dropdown
      popup="group"
      triggerClassName={`btn${active ? ' btn--active' : ''}`}
      trigger={
        <>
          <LayoutPanelLeft size={15} aria-hidden />
          {t('filters.view')}
        </>
      }
    >
      <label className="check">
        <input
          type="checkbox"
          checked={view.showHidden}
          onChange={(event) => onViewChange({ showHidden: event.target.checked })}
        />
        {t('filters.showHidden')}
      </label>
      <label className="check">
        <input
          type="checkbox"
          checked={view.showArchive}
          onChange={(event) => onViewChange({ showArchive: event.target.checked })}
        />
        {t('filters.showArchive')}
      </label>
    </Dropdown>
  );
}

interface AppHeaderProps extends ViewMenuProps {
  actions: DataActions;
  onAddColumn: () => void;
}

export function AppHeader({ actions, view, onViewChange, onAddColumn }: AppHeaderProps) {
  const { t, language, setLanguage } = useI18n();

  return (
    <header className="app-header">
      <h1 className="app-header__brand">
        <img src="/favicon.svg" alt="" width={26} height={26} />
        {t('app.name')}
      </h1>
      <div className="app-header__tools">
        <select
          className="input input--compact"
          aria-label={t('app.language')}
          value={language}
          onChange={(event) => setLanguage(event.target.value as Language)}
        >
          {LANGUAGES.map((option) => (
            <option key={option} value={option}>
              {LANGUAGE_NAMES[option]}
            </option>
          ))}
        </select>
        <ThemeToggle />
        <DataMenu actions={actions} />
        <ViewMenu view={view} onViewChange={onViewChange} />
        <button type="button" className="btn btn--primary" onClick={onAddColumn}>
          <Plus size={16} aria-hidden />
          {t('column.add')}
        </button>
      </div>
    </header>
  );
}
