import { createBrowserClient } from '@supabase/ssr';
import type { SupabaseClient } from '@supabase/supabase-js';
import { getSupabaseAnonKey, getSupabaseUrl, isSupabaseAuthConfigured } from './config';

/**
 * Browser-side Supabase client (cookie-backed via @supabase/ssr). Safe to use
 * inside client components. Returns `null` when Supabase Auth is not configured
 * so the UI can render a disabled/informational state instead of crashing.
 */
export function createBrowserSupabaseClient(): SupabaseClient | null {
  if (!isSupabaseAuthConfigured()) return null;
  return createBrowserClient(getSupabaseUrl() as string, getSupabaseAnonKey() as string);
}
