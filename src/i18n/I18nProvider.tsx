import { createContext, use, useEffect, useMemo, useState, type ReactNode } from 'react';
import { readPreference, writePreference } from '../storage/preferences';
import { createTranslator, LANGUAGES, type Language, type Translate } from './messages';

export const LANGUAGE_KEY = 'fluidmanage_lang';

interface I18nValue {
  language: Language;
  setLanguage: (language: Language) => void;
  t: Translate;
}

const I18nContext = createContext<I18nValue | null>(null);

function initialLanguage(): Language {
  return readPreference(LANGUAGE_KEY, LANGUAGES) ?? (navigator.language.startsWith('en') ? 'en' : 'es');
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [language, setLanguage] = useState(initialLanguage);

  useEffect(() => {
    document.documentElement.lang = language;
    writePreference(LANGUAGE_KEY, language);
  }, [language]);

  const value = useMemo(() => ({ language, setLanguage, t: createTranslator(language) }), [language]);
  return <I18nContext value={value}>{children}</I18nContext>;
}

export function useI18n(): I18nValue {
  const value = use(I18nContext);
  if (!value) throw new Error('useI18n must be used within I18nProvider');
  return value;
}
