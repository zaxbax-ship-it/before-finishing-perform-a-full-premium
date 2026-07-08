import { isRecord } from './common';

/**
 * Response shape for `POST /api/contact`. Contact messages are persisted
 * through the repository layer (notifications + audit log) — success is only
 * returned after the message is actually stored.
 */
export type ContactSubmitResponse =
  | { ok: true; id: string }
  | { ok: false; error: string };

/** Runtime guard validating contact submission responses. */
export function isContactSubmitResponse(value: unknown): value is ContactSubmitResponse {
  if (!isRecord(value) || typeof value.ok !== 'boolean') return false;
  return value.ok ? typeof value.id === 'string' : typeof value.error === 'string';
}
