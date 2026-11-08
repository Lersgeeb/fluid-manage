import type { Priority } from './types';

export const PRIORITIES: readonly Priority[] = ['low', 'medium', 'high', 'critical'];

export const PRIORITY_COLORS: Record<Priority, string> = {
  low: '#23C0DF',
  medium: '#FBC833',
  high: '#E77009',
  critical: '#FF5A50',
};

export const DEFAULT_PRIORITY: Priority = 'low';
export const DEFAULT_TAG_COLOR = '#6B7280';

export const TAG_COLOR_PRESETS = [
  { id: 'red', color: '#f87171' },
  { id: 'orange', color: '#fb923c' },
  { id: 'amber', color: '#fbbf24' },
  { id: 'lime', color: '#a3e635' },
  { id: 'emerald', color: '#34d399' },
  { id: 'cyan', color: '#22d3ee' },
  { id: 'blue', color: '#60a5fa' },
  { id: 'indigo', color: '#818cf8' },
  { id: 'violet', color: '#a78bfa' },
  { id: 'fuchsia', color: '#e879f9' },
] as const;

export const isPriority =(value: unknown): value is Priority => PRIORITIES.includes(value as Priority);

const HEX_COLOR = /^#(?:[0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i;

/**
 * Tag colors come from imported files and end up in inline styles. Only plain
 * hex survives, so a crafted value such as url(...) cannot trigger a request.
 * The stored value is left as is; this only guards what gets rendered.
 */
export const safeColor = (color: string, fallback = DEFAULT_TAG_COLOR): string =>
  HEX_COLOR.test(color) ? color : fallback;
