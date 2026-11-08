import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { ColorSelect, type ColorSelectOption } from './ColorSelect';

const OPTIONS: ColorSelectOption[] = [
  { value: '', label: 'Todas' },
  { value: 'atl', label: 'ATL', color: '#f87171' },
  { value: 'bdf', label: 'BDF', color: '#34d399' },
  { value: 'gfi', label: 'GFI', color: '#60a5fa' },
];

function Harness({ onChange }: { onChange?: (value: string) => void }) {
  const [value, setValue] = useState('');
  return (
    <>
      <ColorSelect
        label="Etiqueta"
        value={value}
        options={OPTIONS}
        onChange={(next) => {
          setValue(next);
          onChange?.(next);
        }}
      />
      <button type="button">Fuera</button>
    </>
  );
}

function setup() {
  const onChange = vi.fn();
  render(<Harness onChange={onChange} />);
  return { user: userEvent.setup(), onChange, trigger: screen.getByRole('combobox', { name: 'Etiqueta' }) };
}

const activeOption = (trigger: HTMLElement) =>
  document.getElementById(trigger.getAttribute('aria-activedescendant')!)?.textContent;

describe('ColorSelect', () => {
  it('shows the selected option and stays closed initially', () => {
    const { trigger } = setup();
    expect(trigger).toHaveTextContent('Todas');
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });

  it('shows a color dot only on options that have a color', async () => {
    const { user, trigger } = setup();
    await user.click(trigger);
    const dot = (name: string) =>
      screen.getByRole('option', { name }).querySelector<HTMLElement>('[data-testid="option-dot"]');
    expect(dot('Todas')).toBeNull();
    expect(dot('BDF')!.style.backgroundColor).toBe('rgb(52, 211, 153)');
  });

  it('selects with the mouse and repeats the color on the trigger', async () => {
    const { user, trigger, onChange } = setup();
    await user.click(trigger);
    await user.click(screen.getByRole('option', { name: 'GFI' }));
    expect(onChange).toHaveBeenCalledWith('gfi');
    expect(trigger).toHaveTextContent('GFI');
    expect(trigger.querySelector('[data-testid="option-dot"]')).not.toBeNull();
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });

  it('marks the selected option', async () => {
    const { user, trigger } = setup();
    await user.click(trigger);
    await user.click(screen.getByRole('option', { name: 'BDF' }));
    await user.click(trigger);
    expect(screen.getByRole('option', { name: 'BDF' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('option', { name: 'Todas' })).toHaveAttribute('aria-selected', 'false');
  });

  it('works entirely from the keyboard, keeping focus on the trigger', async () => {
    const { user, trigger, onChange } = setup();
    trigger.focus();
    await user.keyboard('{ArrowDown}');
    expect(screen.getByRole('listbox')).toBeInTheDocument();
    expect(activeOption(trigger)).toBe('Todas');
    await user.keyboard('{ArrowDown}{ArrowDown}');
    expect(activeOption(trigger)).toBe('BDF');
    await user.keyboard('{ArrowUp}');
    expect(activeOption(trigger)).toBe('ATL');
    await user.keyboard('{Enter}');
    expect(onChange).toHaveBeenCalledWith('atl');
    expect(trigger).toHaveFocus();
  });

  it('jumps to the ends and stops at them', async () => {
    const { user, trigger } = setup();
    trigger.focus();
    await user.keyboard('{Enter}{End}');
    expect(activeOption(trigger)).toBe('GFI');
    await user.keyboard('{ArrowDown}');
    expect(activeOption(trigger)).toBe('GFI');
    await user.keyboard('{Home}{ArrowUp}');
    expect(activeOption(trigger)).toBe('Todas');
  });

  it('selects with Space without reopening', async () => {
    const { user, trigger, onChange } = setup();
    trigger.focus();
    await user.keyboard(' {ArrowDown} ');
    expect(onChange).toHaveBeenCalledWith('atl');
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });

  it('jumps by typing the start of a label', async () => {
    const { user, trigger } = setup();
    trigger.focus();
    await user.keyboard('{Enter}g');
    expect(activeOption(trigger)).toBe('GFI');
  });

  it('closes on Escape without changing the value', async () => {
    const { user, trigger, onChange } = setup();
    trigger.focus();
    await user.keyboard('{Enter}{ArrowDown}{Escape}');
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    expect(onChange).not.toHaveBeenCalled();
    expect(trigger).toHaveFocus();
  });

  it('closes when clicking elsewhere', async () => {
    const { user, trigger } = setup();
    await user.click(trigger);
    await user.click(screen.getByRole('button', { name: 'Fuera' }));
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });
});
