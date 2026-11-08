import { describe, expect, it } from 'vitest';
import { createTranslator, messages } from './messages';

describe('messages', () => {
  it('defines the same keys in both languages', () => {
    expect(Object.keys(messages.en).toSorted()).toEqual(Object.keys(messages.es).toSorted());
  });

  it('uses the same placeholders in both languages', () => {
    const placeholders = (text: string) => (text.match(/\{\w+\}/g) ?? []).toSorted();
    for (const key of Object.keys(messages.es) as (keyof typeof messages.es)[]) {
      expect(placeholders(messages.en[key]), key).toEqual(placeholders(messages.es[key]));
    }
  });

  it('interpolates values literally', () => {
    const t = createTranslator('en');
    expect(t('column.moveLeft', { name: '$& {name}' })).toContain('$& {name}');
  });
});
