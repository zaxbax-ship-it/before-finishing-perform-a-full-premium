import Link from 'next/link';
import { SITE_NAME } from '@/lib/site/config';

const footerLinks = [
  { href: '/about', label: 'About' },
  { href: '/contact', label: 'Contact' },
  { href: '/privacy-policy', label: 'Privacy Policy' },
  { href: '/terms-of-service', label: 'Terms of Service' },
  { href: '/cookie-policy', label: 'Cookie Policy' },
  { href: '/sitemap.xml', label: 'Sitemap' }
];

export function SiteFooter() {
  return (
    <footer className="site-footer" dir="ltr" aria-label="Site footer">
      <div className="site-footer-inner">
        <div>
          <strong>{SITE_NAME}</strong>
          <p>Premium trivia, responsible publishing, and protected editorial operations.</p>
        </div>
        <nav aria-label="Compliance links">
          {footerLinks.map(link => (
            <Link key={link.href} href={link.href}>
              {link.label}
            </Link>
          ))}
        </nav>
      </div>
    </footer>
  );
}
