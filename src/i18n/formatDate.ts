import type { Language } from './messages';

const formatters = new Map<Language, Intl.DateTimeFormat>();

function formatterFor(language: Language): Intl.DateTimeFormat {
  let formatter = formatters.get(language);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat(language, { dateStyle: 'medium', timeStyle: 'short' });
    formatters.set(language, formatter);
  }
  return formatter;
}

export function formatDateTime(value: string, language: Language): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : formatterFor(language).format(date);
}
