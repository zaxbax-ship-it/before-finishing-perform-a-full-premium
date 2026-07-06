import type { AdminRoleSlug, PermissionSlug } from '@/lib/domain/models';

/**
 * A validated authenticated identity coming from Supabase Auth.
 * `id` is the Supabase `auth.users` id (used as `authUserId` across the domain).
 */
export type AuthUser = {
  id: string;
  email?: string;
  emailVerified: boolean;
};

/**
 * The authorization context for an administrator. Resolved entirely on the
 * server from the authenticated identity plus the repository / allowlist.
 * Never construct this on the client.
 */
export type AdminContext = {
  authUserId?: string;
  email: string;
  displayName: string;
  roleSlugs: AdminRoleSlug[];
  permissionSlugs: PermissionSlug[];
  /** How this context was resolved. */
  source: 'db' | 'bootstrap' | 'local-open';
};

export type AuthResultStatus = 'ok' | 'error' | 'verification_sent' | 'reset_sent';

/**
 * Result contract returned by the browser {@link AuthService}. The UI layer
 * consumes this instead of catching raw Supabase errors.
 */
export type AuthResult = {
  status: AuthResultStatus;
  message?: string;
};

/**
 * Thrown by server guards. `status` maps directly to the HTTP response:
 * 401 when there is no authenticated user, 403 when the user lacks access.
 */
export class AuthorizationError extends Error {
  readonly status: 401 | 403;

  constructor(message: string, status: 401 | 403) {
    super(message);
    this.name = 'AuthorizationError';
    this.status = status;
  }
}
