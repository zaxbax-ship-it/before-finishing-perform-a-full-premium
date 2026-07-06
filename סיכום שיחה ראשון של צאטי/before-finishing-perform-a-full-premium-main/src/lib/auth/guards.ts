import { NextResponse } from 'next/server';
import type { PermissionSlug } from '@/lib/domain/models';
import { isAuthEnforced } from './config';
import { getAuthUser } from './session';
import { hasPermission, openLocalAdminContext, resolveAdminContextForUser } from './adminAccess';
import { AuthorizationError, type AdminContext } from './types';

/** Whether server-side authorization is currently enforced. */
export function enforcementActive(): boolean {
  return isAuthEnforced();
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
 * context or a ready-to-return 401/403 JSON response. In open local mode it
 * returns a synthetic local-admin context so existing behavior is preserved.
 *
 * Usage:
 *   const guard = await guardApiPermission('submissions.review');
 *   if (!guard.ok) return guard.response;
 *   // guard.context is the acting administrator
 */
export async function guardApiPermission(slug: PermissionSlug): Promise<ApiGuardResult> {
  if (!enforcementActive()) {
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
