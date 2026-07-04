import { getRepositoryProvider } from '@/lib/repositories/providerFactory';
import type { RepositoryProvider } from '@/lib/repositories/interfaces';
import type { AdminRoleSlug, PermissionSlug } from '@/lib/domain/models';
import { isAdminAllowlisted } from './config';
import { getAuthUser } from './session';
import type { AdminContext, AuthUser } from './types';

async function allPermissionSlugs(repositories: RepositoryProvider): Promise<PermissionSlug[]> {
  const permissions = await repositories.permissions.list();
  return permissions.map(permission => permission.slug);
}

/**
 * Resolves the administrator authorization context for an already-authenticated
 * user. Resolution order:
 *   1. `admins` table by email (an active record wins). Emails are the stable
 *      link to Supabase auth identities across Google and email/password.
 *   2. Bootstrap allowlist (`ADMIN_EMAILS`) — grants `super_admin` with every
 *      seeded permission so the very first login works before the table is
 *      populated (and in local mode, where the table is empty).
 * Returns `null` when the user is authenticated but not an administrator.
 */
export async function resolveAdminContextForUser(user: AuthUser): Promise<AdminContext | null> {
  const repositories = getRepositoryProvider();

  const admin = user.email ? await repositories.admins.findByEmail(user.email) : undefined;

  if (admin && admin.isActive) {
    return {
      authUserId: user.id,
      email: admin.email ?? user.email ?? '',
      displayName: admin.displayName,
      roleSlugs: admin.roleSlugs,
      permissionSlugs: admin.permissionSlugs,
      source: 'db'
    };
  }

  if (isAdminAllowlisted(user.email)) {
    return {
      authUserId: user.id,
      email: user.email as string,
      displayName: user.email as string,
      roleSlugs: ['super_admin'],
      permissionSlugs: await allPermissionSlugs(repositories),
      source: 'bootstrap'
    };
  }

  return null;
}

/** Resolves the admin context for the current request, or `null`. */
export async function resolveAdminContext(): Promise<AdminContext | null> {
  const user = await getAuthUser();
  if (!user) return null;
  return resolveAdminContextForUser(user);
}

export function hasPermission(context: AdminContext, slug: PermissionSlug): boolean {
  return context.permissionSlugs.includes(slug);
}

export function hasRole(context: AdminContext, slug: AdminRoleSlug): boolean {
  return context.roleSlugs.includes(slug);
}

/**
 * The synthetic context used in open local mode (no Supabase Auth configured).
 * Preserves today's behavior: local development and the existing deployment can
 * exercise every admin action, while audit logs still attribute a stable actor.
 */
export async function openLocalAdminContext(): Promise<AdminContext> {
  const repositories = getRepositoryProvider();
  return {
    email: 'local-admin',
    displayName: 'Local Admin (open mode)',
    roleSlugs: ['super_admin'],
    permissionSlugs: await allPermissionSlugs(repositories),
    source: 'local-open'
  };
}
