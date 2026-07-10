'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

/**
 * Console navigation. Items are added as console areas ship; the list is the
 * single source of truth for what the console exposes.
 */
const NAV_ITEMS: Array<{ href: string; label: string }> = [
  { href: '/admin', label: 'דשבורד' },
  { href: '/admin/users', label: 'ניהול משתמשים' },
  { href: '/admin/questions', label: 'ניהול שאלות' },
  { href: '/admin/multiplayer', label: 'מרובה משתתפים' },
  { href: '/admin/contact', label: 'מרכז פניות' },
  { href: '/admin/analytics', label: 'אנליטיקות' },
  { href: '/admin/health', label: 'בריאות המערכת' },
  { href: '/admin/audit', label: 'יומן ביקורת' },
  { href: '/admin/rewards', label: 'תגמולים' },
  { href: '/admin/settings', label: 'הגדרות מערכת' },
  { href: '/admin/moderation', label: 'מודרציית קהילה' }
];

export function AdminNav() {
  const pathname = usePathname();
  return (
    <nav className="admin-nav" aria-label="ניווט מנהלים">
      <ul>
        {NAV_ITEMS.map(item => {
          const active = item.href === '/admin' ? pathname === '/admin' : pathname.startsWith(item.href);
          return (
            <li key={item.href}>
              <Link className={`admin-nav-item focus-ring ${active ? 'is-active' : ''}`} href={item.href} aria-current={active ? 'page' : undefined}>
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
      <Link className="admin-nav-item admin-nav-exit focus-ring" href="/">חזרה לאתר</Link>
    </nav>
  );
}
