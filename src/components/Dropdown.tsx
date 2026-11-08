import { useCallback, useEffect, useRef, useState, type MouseEvent, type ReactNode } from 'react';
import { useOutsidePointerDown } from './useOutsidePointerDown';

interface DropdownProps {
  /** Button content. */
  trigger: ReactNode;
  /** Accessible name, for triggers that only show an icon. */
  label?: string;
  triggerClassName?: string;
  /** 'menu' holds actions and closes when one runs; 'group' holds form controls and stays open. */
  popup?: 'menu' | 'group';
  children: ReactNode;
}

export function Dropdown({ trigger, label, triggerClassName = 'btn', popup = 'menu', children }: DropdownProps) {
  const [open, setOpen] = useState(false);
  const container = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);

  const close = useCallback(() => setOpen(false), []);
  useOutsidePointerDown(container, open, close);

  useEffect(() => {
    if (!open) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      button.current?.focus();
      setOpen(false);
    };
    document.addEventListener('keydown', closeOnEscape);
    return () => document.removeEventListener('keydown', closeOnEscape);
  }, [open]);

  const closeAfterAction = (event: MouseEvent<HTMLDivElement>) => {
    if (!(event.target as Element).closest('[role="menuitem"]')) return;
    // Focus moves first, so a dialog opened by the action returns here when it closes.
    button.current?.focus();
    setOpen(false);
  };

  return (
    <div className="menu" ref={container}>
      <button
        ref={button}
        type="button"
        className={triggerClassName}
        aria-label={label}
        aria-haspopup={popup === 'menu' ? 'menu' : undefined}
        aria-expanded={open}
        onClick={() => setOpen(!open)}
      >
        {trigger}
      </button>
      {open ? (
        <div role={popup} className={`menu__list menu__list--${popup}`} onClick={closeAfterAction}>
          {children}
        </div>
      ) : null}
    </div>
  );
}
