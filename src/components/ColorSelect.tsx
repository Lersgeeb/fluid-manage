import { ChevronDown } from 'lucide-react';
import { useCallback, useEffect, useId, useRef, useState, type KeyboardEvent } from 'react';
import { useOutsidePointerDown } from './useOutsidePointerDown';

export interface ColorSelectOption {
  value: string;
  label: string;
  /** Must already be safe to render. */
  color?: string;
}

interface ColorSelectProps {
  label: string;
  value: string;
  options: readonly ColorSelectOption[];
  onChange: (value: string) => void;
}

const TYPEAHEAD_RESET_MS = 700;

function OptionContent({ option }: { option: ColorSelectOption }) {
  return (
    <>
      {option.color ? (
        <span data-testid="option-dot" className="select__dot" style={{ backgroundColor: option.color }} />
      ) : null}
      <span className="select__label">{option.label}</span>
    </>
  );
}

/**
 * Select-only combobox. A native <select> cannot render anything but plain
 * text in its options, so it can't show the colors.
 */
export function ColorSelect({ label, value, options, onChange }: ColorSelectProps) {
  const id = useId();
  const labelId = `${id}-label`;
  const listId = `${id}-list`;
  const optionId = (index: number) => `${id}-option-${index}`;

  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const container = useRef<HTMLDivElement>(null);
  const list = useRef<HTMLUListElement>(null);
  const typeahead = useRef({ text: '', time: 0 });

  const selectedIndex = Math.max(
    0,
    options.findIndex((option) => option.value === value),
  );
  const lastIndex = options.length - 1;

  const close = useCallback(() => setOpen(false), []);
  useOutsidePointerDown(container, open, close);

  useEffect(() => {
    if (open) list.current?.children[activeIndex]?.scrollIntoView?.({ block: 'nearest' });
  }, [open, activeIndex]);

  const openList = () => {
    setActiveIndex(selectedIndex);
    setOpen(true);
  };

  const choose = (index: number) => {
    const option = options[index];
    if (option) onChange(option.value);
    setOpen(false);
  };

  const jumpByTyping = (key: string) => {
    const now = Date.now();
    const state = typeahead.current;
    state.text = now - state.time > TYPEAHEAD_RESET_MS ? key : state.text + key;
    state.time = now;
    const query = state.text.toLowerCase();
    const match = options.findIndex((option) => option.label.toLowerCase().startsWith(query));
    if (match >= 0) setActiveIndex(match);
  };

  const handleKeyDown = (event: KeyboardEvent) => {
    const { key } = event;
    if (!open) {
      if (key === 'ArrowDown' || key === 'ArrowUp' || key === 'Enter' || key === ' ') {
        event.preventDefault();
        openList();
      }
      return;
    }

    if (key === 'Tab') {
      close();
      return;
    }

    const moves: Record<string, number> = {
      ArrowDown: Math.min(activeIndex + 1, lastIndex),
      ArrowUp: Math.max(activeIndex - 1, 0),
      Home: 0,
      End: lastIndex,
    };
    const target = moves[key];
    if (target !== undefined) {
      event.preventDefault();
      setActiveIndex(target);
    } else if (key === 'Enter' || key === ' ') {
      event.preventDefault();
      choose(activeIndex);
    } else if (key === 'Escape') {
      event.preventDefault();
      close();
    } else if (key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) {
      jumpByTyping(key);
    }
  };

  return (
    <div className="field select" ref={container}>
      <span id={labelId} className="field__label">
        {label}
      </span>
      <button
        type="button"
        role="combobox"
        className="input select__trigger"
        aria-labelledby={labelId}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-activedescendant={open ? optionId(activeIndex) : undefined}
        onClick={() => (open ? close() : openList())}
        onKeyDown={handleKeyDown}
        // Space activates a button on key release, which would reopen the list.
        onKeyUp={(event) => {
          if (event.key === ' ') event.preventDefault();
        }}
      >
        <span className="select__value">
          <OptionContent option={options[selectedIndex]!} />
        </span>
        <ChevronDown size={15} aria-hidden />
      </button>
      {open ? (
        <ul
          ref={list}
          id={listId}
          role="listbox"
          aria-labelledby={labelId}
          className="select__list"
          // Focus has to stay on the trigger, which owns the keyboard handling.
          onMouseDown={(event) => event.preventDefault()}
        >
          {options.map((option, index) => (
            <li
              key={option.value}
              id={optionId(index)}
              role="option"
              aria-selected={index === selectedIndex}
              className={`select__option${index === activeIndex ? ' select__option--active' : ''}`}
              onMouseMove={() => setActiveIndex(index)}
              onClick={() => choose(index)}
            >
              <OptionContent option={option} />
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
