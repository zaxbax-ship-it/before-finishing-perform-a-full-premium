import { NextResponse } from 'next/server';
import type { PermissionSlug } from '@/lib/domain/models';
import { createLogger } from '@/lib/infrastructure/logger';
import { isAuthEnforced } from './config';
import { getAuthUser } from './session';
import { hasPermission, openLocalAdminContext, resolveAdminContextForUser } from './adminAccess';
import { AuthorizationError, type AdminContext } from './types';

const authLogger = createLogger('auth');

/** Whether server-side authorization is currently enforced. */
export function enforcementActive(): boolean {
  return isAuthEnforced();
}

/**
 * The admin-surface access mode — the single rule every admin gate consults.
 *
 * - `enforced`  Supabase Auth is configured and enforcement is on: real
 *               authentication + ADMIN_EMAILS / admins-table authorization.
 * - `open-dev`  No enforcement, NON-production runtime: the local development
 *               fallback keeps the dashboard usable, loudly logged.
 * - `locked`    No enforcement in a PRODUCTION runtime: admin is denied for
 *               everyone. A misconfigured production deployment must fail
 *               closed, never fall open — this also means AUTH_ENFORCED=false
 *               locks production admin rather than opening it.
 */
export type AdminAccessMode = 'enforced' | 'open-dev' | 'locked';

export function adminAccessMode(): AdminAccessMode {
  if (isAuthEnforced()) return 'enforced';
  return process.env.NODE_ENV === 'production' ? 'locked' : 'open-dev';
}

/** Loud, per-access reminder that admin protection is off (development only). */
export function warnOpenAdminAccess(surface: string) {
  authLogger.warn('Admin protection is DISABLED — open development mode.', {
    surface,
    hint: 'Configure NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY and ADMIN_EMAILS to enforce authentication.'
  });
}

export function warnLockedAdminAccess(surface: string) {
  authLogger.warn('Admin access denied: production runtime without enforced auth.', {
    surface,
    hint: 'Set NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY and ADMIN_EMAILS (and do not set AUTH_ENFORCED=false) to enable admin access in production.'
  });
}

/** Requires an authenticated user. Throws {@link AuthorizationError} (401). */
export async function requireAuth() {
  const user = await getAuthUser();
  if (!user) throw new AuthorizationError('Authentication is required.', 401);
  return user;
}

/**
 * Requires an authenticated administrator. Throws 401 when unauthenticated and
 * 403 when the authenticated user is not an admin.
 */
export async function requireAdmin(): Promise<AdminContext> {
  const user = await getAuthUser();
  if (!user) throw new AuthorizationError('Authentication is required.', 401);

  const context = await resolveAdminContextForUser(user);
  if (!context) throw new AuthorizationError('Administrator access is required.', 403);

  return context;
}

/** Requires an admin holding a specific permission. */
export async function requirePermission(slug: PermissionSlug): Promise<AdminContext> {
  const context = await requireAdmin();
  if (!hasPermission(context, slug)) {
    throw new AuthorizationError(`Missing required permission: ${slug}.`, 403);
  }
  return context;
}

export type ApiGuardResult =
  | { ok: true; context: AdminContext }
  | { ok: false; response: NextResponse };

/**
 * One-line guard for Route Handlers. In enforced mode it returns the admin
 * context or a ready-to-return 401/403 JSON response. In open development
 * mode it returns a synthetic local-admin context (loudly logged); in a
 * production runtime without enforced auth it fails closed with a 403 for
 * every caller.
 *
 * Usage:
 *   const guard = await guardApiPermission('submissions.review');
 *   if (!guard.ok) return guard.response;
 *   // guard.context is the acting administrator
 */
export async function guardApiPermission(slug: PermissionSlug): Promise<ApiGuardResult> {
  const mode = adminAccessMode();

  if (mode === 'locked') {
    warnLockedAdminAccess(`api:${slug}`);
    return {
      ok: false,
      response: NextResponse.json(
        { ok: false, error: 'Admin access is disabled on this deployment.' },
        { status: 403, headers: { 'Cache-Control': 'no-store' } }
      )
    };
  }

  if (mode === 'open-dev') {
    warnOpenAdminAccess(`api:${slug}`);
    return { ok: true, context: await openLocalAdminContext() };
  }

  try {
    const context = await requirePermission(slug);
    return { ok: true, context };
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return {
        ok: false,
        response: NextResponse.json({ ok: false, error: error.message }, { status: error.status })
      };
    }
    throw error;
  }
}
