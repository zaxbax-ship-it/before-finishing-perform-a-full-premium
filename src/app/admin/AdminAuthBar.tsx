import type { AdminContext } from '@/lib/auth/types';

/**
 * Thin identity bar shown above the admin dashboard. Display only — every
 * privileged action is validated on the server. Rendered only in enforced mode.
 */
export default function AdminAuthBar({ context }: { context: AdminContext }) {
  return (
    <div className="admin-auth-bar" dir="rtl">
      <div className="admin-auth-bar-identity">
        <span className="admin-auth-bar-badge">מנהל</span>
        <span className="admin-auth-bar-email">{context.email}</span>
        <span className="admin-auth-bar-roles">{context.roleSlugs.join(' · ')}</span>
      </div>
      <form action="/auth/signout" method="post">
        <button className="ghost-button focus-ring" type="submit">התנתקות</button>
      </form>
    </div>
  );
}
