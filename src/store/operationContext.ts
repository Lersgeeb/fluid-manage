import type { OperationContext } from '../domain/types';

function randomId(): string {
  // randomUUID only exists in secure contexts; plain-HTTP LAN hosting lacks it.
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

export const createOperationContext = (): OperationContext => ({
  id: randomId,
  now: () => new Date().toISOString(),
});
