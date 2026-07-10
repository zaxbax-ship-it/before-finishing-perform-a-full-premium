import 'server-only';
import { getAuthUser } from '@/lib/auth/session';

/**
 * Resolves the server-authoritative player key for a rewards request.
 *
 * Authenticated users are ALWAYS keyed by their verified auth id — a client can
 * never spoof another account by supplying a different key. Anonymous players use
 * a device id they generated locally, validated to a safe opaque format.
 */
const ANON_KEY_PATTERN = /^[a-zA-Z0-9_-]{8,64}$/;

export function sanitizeAnonKey(value: unknown): string | null {
  return typeof value === 'string' && ANON_KEY_PATTERN.test(value) ? value : null;
}

export type ResolvedPlayer = { playerKey: string; authenticated: boolean; displayName?: string };

export async function resolvePlayerKey(anonKey: unknown): Promise<ResolvedPlayer | null> {
  const user = await getAuthUser();
  if (user) {
    const displayName = user.email ? user.email.split('@')[0] : undefined;
    return { playerKey: user.id, authenticated: true, displayName };
  }
  const anon = sanitizeAnonKey(anonKey);
  if (anon) return { playerKey: anon, authenticated: false };
  return null;
}
