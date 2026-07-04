import { readEnv } from '@/lib/infrastructure/environment';

/**
 * Central, side-effect-free view of the authentication configuration.
 *
 * Enforcement model (see plan / README): the app only *enforces* auth once a
 * Supabase Auth project is wired. Until then it runs in "open local mode" so
 * the existing gameplay and admin dashboard keep working unchanged. Setting
 * `AUTH_ENFORCED=false` allows a configured-but-not-enforced staging setup.
 */

export function getSupabaseUrl(): string | undefined {
  return readEnv('NEXT_PUBLIC_SUPABASE_URL');
}

export function getSupabaseAnonKey(): string | undefined {
  return readEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY');
}

/** Supabase Auth can operate only when both the URL and anon key are present. */
export function isSupabaseAuthConfigured(): boolean {
  return Boolean(getSupabaseUrl() && getSupabaseAnonKey());
}

/**
 * Auth is enforced when Supabase Auth is configured and enforcement has not
 * been explicitly disabled. Enforcement can never be turned on without a real
 * auth backend, so an unconfigured project stays in open local mode.
 */
export function isAuthEnforced(): boolean {
  if (!isSupabaseAuthConfigured()) return false;
  return readEnv('AUTH_ENFORCED') !== 'false';
}

/** True when email/password sign-in should be offered in the UI. */
export function isEmailPasswordEnabled(): boolean {
  return readEnv('AUTH_EMAIL_PASSWORD_ENABLED') !== 'false';
}

/** Comma-separated, normalized (lowercased, trimmed) bootstrap admin emails. */
export function getAdminAllowlist(): string[] {
  const raw = readEnv('ADMIN_EMAILS');
  if (!raw) return [];
  return raw
    .split(',')
    .map(value => value.trim().toLowerCase())
    .filter(value => value.length > 0);
}

export function isAdminAllowlisted(email: string | undefined): boolean {
  if (!email) return false;
  return getAdminAllowlist().includes(email.trim().toLowerCase());
}

/** Absolute site origin used to build OAuth / email redirect URLs. */
export function getSiteUrl(): string {
  const explicit = readEnv('NEXT_PUBLIC_SITE_URL');
  if (explicit) return explicit.replace(/\/$/, '');
  if (typeof window !== 'undefined') return window.location.origin;
  const vercelUrl = readEnv('VERCEL_URL');
  if (vercelUrl) return `https://${vercelUrl}`;
  return 'http://localhost:3000';
}

export function getAuthCallbackUrl(): string {
  return `${getSiteUrl()}/auth/callback`;
}

export function getPasswordResetRedirectUrl(): string {
  return `${getSiteUrl()}/reset-password`;
}
