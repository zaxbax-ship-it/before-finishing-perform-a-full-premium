import { redirect } from 'next/navigation';
import type { ReactNode } from 'react';
import { adminAccessMode, requireAdmin, warnLockedAdminAccess, warnOpenAdminAccess } from '@/lib/auth/guards';
import { AuthorizationError, type AdminContext } from '@/lib/auth/types';
import AdminAuthBar from './AdminAuthBar';
import { AdminNav } from './_components/AdminNav';

/**
 * Admin console shell. The single authorization gate for every /admin page:
 * locked production deployments redirect everyone to /forbidden, open
 * development mode is loudly logged, and enforced mode requires a real
 * administrator (fine-grained permissions are re-checked by each admin API).
 */
export default async function AdminLayout({ children }: { children: ReactNode }) {
  const mode = adminAccessMode();
  let context: AdminContext | undefined;

  if (mode === 'locked') {
    warnLockedAdminAccess('layout:/admin');
    redirect('/forbidden');
  }

  if (mode === 'open-dev') {
    warnOpenAdminAccess('layout:/admin');
  }

  if (mode === 'enforced') {
    try {
      context = await requireAdmin();
    } catch (error) {
      if (error instanceof AuthorizationError) {
        redirect(error.status === 401 ? '/login?redirect=/admin' : '/forbidden');
      }
      throw error;
    }
  }

  return (
    <div className="admin-shell font-hebrew" dir="rtl">
      {context ? <AdminAuthBar context={context} /> : (
        <div className="admin-auth-bar" dir="rtl">
          <div className="admin-auth-bar-identity">
            <span className="admin-auth-bar-badge admin-open-badge">מצב פיתוח פתוח</span>
            <span className="admin-auth-bar-email">אימות מנהלים אינו פעיל בסביבה זו</span>
          </div>
        </div>
      )}
      <div className="admin-body">
        <AdminNav />
        <main className="admin-main" id="admin-main">{children}</main>
      </div>
    </div>
  );
}
