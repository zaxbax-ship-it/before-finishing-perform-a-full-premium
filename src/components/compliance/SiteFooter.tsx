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
        </div>
        <nav aria-label="Compliance links">
          {footerLinks.map(link => (
            // File routes like /sitemap.xml are served outside the App Router,
            // so they must be plain document links — client-side <Link>
            // navigation would land on the app's 404 page.
            link.href.endsWith('.xml') ? (
              <a key={link.href} href={link.href}>
                {link.label}
              </a>
            ) : (
              <Link key={link.href} href={link.href}>
                {link.label}
              </Link>
            )
          ))}
        </nav>
      </div>
    </footer>
  );
}
