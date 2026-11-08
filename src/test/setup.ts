import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

// Some suites run in the node environment, where none of this exists.
if (typeof document !== 'undefined') {
  // jsdom does not implement the modal methods of <dialog>.
  HTMLDialogElement.prototype.showModal = function showModal(this: HTMLDialogElement) {
    this.open = true;
  };
  HTMLDialogElement.prototype.close = function close(this: HTMLDialogElement) {
    this.open = false;
  };

  afterEach(() => {
    cleanup();
    localStorage.clear();
  });
}
