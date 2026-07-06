import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import type { SupabaseClient } from '@supabase/supabase-js';
import { getSupabaseAnonKey, getSupabaseUrl, isSupabaseAuthConfigured } from './config';

/**
 * Server-side Supabase client bound to the request cookie store. Use inside
 * Server Components, Route Handlers and Server Actions. Returns `null` when
 * Supabase Auth is not configured.
 *
 * Cookie writes are wrapped in try/catch because Server Components are not
 * allowed to mutate cookies; the middleware is responsible for refreshing the
 * session cookie, so ignoring the write there is safe.
 */
export async function createServerSupabaseClient(): Promise<SupabaseClient | null> {
  if (!isSupabaseAuthConfigured()) return null;

  const cookieStore = await cookies();

  return createServerClient(getSupabaseUrl() as string, getSupabaseAnonKey() as string, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        } catch {
          // Called from a Server Component render pass. The middleware refreshes
          // the session cookie, so this is safe to ignore.
        }
      }
    }
  });
}
