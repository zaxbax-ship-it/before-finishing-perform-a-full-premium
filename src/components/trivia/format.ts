/**
 * Pure presentation helpers shared by the trivia screens and the orchestrator.
 *
 * Extracted verbatim from `TriviaPlatform.tsx` so both the orchestrator and the
 * per-screen components can reuse a single implementation (no duplicated
 * formatting or validation logic).
 */

const RESERVED_NICKNAMES = new Set([
  'admin',
  'administrator',
  'moderator',
  'owner',
  'support',
  'official',
  'system',
  'staff',
  'team',
  'google',
  'supabase',
  'root',
  'null',
  'undefined'
]);

/** Interpolates `{token}` placeholders in a localized template string. */
export function fmt(template: string, vars: Record<string, string | number>) {
  return template.replace(/\{(\w+)\}/g, (_, key) => String(vars[key] ?? ''));
}

/** Formats a prize amount. Global audience: all prizes are shown in US dollars. */
export function money(value: number) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0
  }).format(value);
}

export function initialsFor(value: string) {
  return value
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(item => item[0])
    .join('')
    .toUpperCase() || 'U';
}

export function validateNickname(value: string, ui: Record<string, string>) {
  const cleaned = value.trim().replace(/\s+/g, ' ');
  if (cleaned.length < 3) return { ok: false, message: ui.nicknameShort };
  if (cleaned.length > 20) return { ok: false, message: ui.nicknameLong };
  if (!/^[\p{L}\p{N} _.-]+$/u.test(cleaned)) return { ok: false, message: ui.nicknameChars };
  if (RESERVED_NICKNAMES.has(cleaned.toLowerCase())) return { ok: false, message: ui.nicknameReserved };
  return { ok: true, message: ui.nicknameValid };
}
