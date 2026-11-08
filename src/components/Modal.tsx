import { useLayoutEffect, useRef, type ReactNode } from 'react';

interface ModalProps {
  labelledBy: string;
  onClose: () => void;
  children: ReactNode;
  role?: 'alertdialog';
  className?: string;
}

/** Native modal <dialog>: focus trapping, Escape and inert background for free. */
export function Modal({ labelledBy, onClose, children, role, className = '' }: ModalProps) {
  const ref = useRef<HTMLDialogElement>(null);

  // Layout effect so close() runs while the node is attached, which is what
  // makes the browser hand focus back to the element that opened the modal.
  useLayoutEffect(() => {
    const dialog = ref.current;
    if (dialog && !dialog.open) dialog.showModal();
    return () => dialog?.close();
  }, []);

  return (
    <dialog
      ref={ref}
      role={role}
      aria-labelledby={labelledBy}
      className={`modal ${className}`}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
    >
      {children}
    </dialog>
  );
}
