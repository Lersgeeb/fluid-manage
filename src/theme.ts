import { readPreference, writePreference } from './storage/preferences';

export type Theme = 'light' | 'dark';

const THEME_KEY = 'fluidmanage_theme';
const THEMES: readonly Theme[] = ['light', 'dark'];

export function initialTheme(): Theme {
  const stored = readPreference(THEME_KEY, THEMES);
  if (stored) return stored;
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export function applyTheme(theme: Theme): void {
  document.documentElement.dataset.theme = theme;
}

export function persistTheme(theme: Theme): void {
  applyTheme(theme);
  writePreference(THEME_KEY, theme);
}
