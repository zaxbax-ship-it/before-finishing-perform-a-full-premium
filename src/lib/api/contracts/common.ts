/**
 * Shared API envelope contracts.
 *
 * Every public JSON endpoint returns a discriminated envelope: `{ ok: true, ... }`
 * on success or `{ ok: false, ... }` on failure. These types + runtime guards are
 * the single source of truth shared by the web client today and by the future
 * native iOS / Android clients (see docs/api-contracts-and-mobile-readiness.md).
 *
 * Runtime guards are intentionally dependency-free (no schema library) to keep the
 * contract layer light and portable.
 */

/**
 * Contract version. Date-based, bumped only on a breaking response change.
 * Clients may read it from responses that choose to expose it; it is documented
 * as the versioning anchor for mobile clients.
 */
export const API_CONTRACT_VERSION = '2026-07-06';

/** Successful envelope: the `ok: true` discriminant plus the payload fields. */
export type ApiOk<TPayload> = { ok: true } & TPayload;

/** Failure envelope. `error` is a human-safe message; `status` is a stable code. */
export type ApiError = {
  ok: false;
  error?: string;
  status?: string;
};

/** Any endpoint response: success payload or a safe error. */
export type ApiEnvelope<TPayload> = ApiOk<TPayload> | ApiError;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

/** True when the value is a well-formed success envelope. */
export function isApiOk(value: unknown): value is ApiOk<Record<string, unknown>> {
  return isRecord(value) && value.ok === true;
}

/** True when the value is a well-formed error envelope. */
export function isApiError(value: unknown): value is ApiError {
  return isRecord(value) && value.ok === false;
}

/** True when the value is any valid envelope (success or error). */
export function isApiEnvelope(value: unknown): value is ApiEnvelope<Record<string, unknown>> {
  return isApiOk(value) || isApiError(value);
}

export { isRecord };
