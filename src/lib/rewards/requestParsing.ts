/**
 * Small, pure request-value coercers shared by the rewards route handlers.
 * Server validates every input — the client is never trusted for numbers,
 * flags or the timezone offset.
 */

export function toNum(value: unknown, min = 0): number {
  return typeof value === 'number' && Number.isFinite(value) ? Math.max(min, Math.floor(value)) : min;
}

export function toBool(value: unknown): boolean {
  return value === true;
}

export function toStr(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

/** UTC offset in minutes, clamped to the real-world range [-720, 840]. */
export function toOffsetMinutes(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 0;
  return Math.max(-720, Math.min(840, Math.trunc(value)));
}
