import { createServerSupabaseClient } from './supabaseServerClient';
import type { AuthUser } from './types';

/**
 * Returns the current authenticated user, validated on the server.
 *
 * Always uses `auth.getUser()` (which verifies the JWT against Supabase) rather
 * than `auth.getSession()` (which trusts the cookie payload) so authorization
 * decisions cannot be forged by tampering with cookies.
 */
export async function getAuthUser(): Promise<AuthUser | null> {
  const supabase = await createServerSupabaseClient();
  if (!supabase) return null;

  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return null;

  return {
    id: data.user.id,
    email: data.user.email ?? undefined,
    emailVerified: Boolean(data.user.email_confirmed_at)
  };
}
