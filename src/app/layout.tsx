import type { Metadata, Viewport } from 'next';
import { IntegrationScripts } from '@/components/compliance/IntegrationScripts';
import { SiteFooter } from '@/components/compliance/SiteFooter';
import { StructuredData } from '@/components/compliance/StructuredData';
import { readEnv } from '@/lib/infrastructure/environment';
import { getAbsoluteUrl, getSiteOrigin, SITE_DESCRIPTION, SITE_NAME, SITE_TAGLINE } from '@/lib/site/config';
import './globals.css';
import './language-menu.css';
import './ads.css';
import './auth.css';
import './compliance.css';

const googleSiteVerification = readEnv('NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION');
const bingSiteVerification = readEnv('NEXT_PUBLIC_BING_SITE_VERIFICATION');

export const metadata: Metadata = {
  metadataBase: new URL(getSiteOrigin()),
  applicationName: SITE_NAME,
  title: {
    default: `${SITE_NAME} | ${SITE_TAGLINE}`,
    template: `%s | ${SITE_NAME}`
  },
  description: SITE_DESCRIPTION,
  category: 'game',
  keywords: [
    'trivia',
    'quiz show',
    'Hebrew trivia',
    'multilingual trivia',
    'online game',
    'leaderboard'
  ],
  alternates: {
    canonical: '/'
  },
  openGraph: {
    title: SITE_NAME,
    description: SITE_DESCRIPTION,
    url: getAbsoluteUrl('/'),
    siteName: SITE_NAME,
    locale: 'he_IL',
    type: 'website',
    images: [
      {
        url: '/icon.svg',
        width: 512,
        height: 512,
        alt: `${SITE_NAME} logo`
      }
    ]
  },
  twitter: {
    card: 'summary',
    title: SITE_NAME,
    description: SITE_DESCRIPTION,
    images: ['/icon.svg']
  },
  icons: {
    icon: '/icon.svg',
    shortcut: '/icon.svg',
    apple: '/icon.svg'
  },
  manifest: '/manifest.webmanifest',
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-snippet': -1,
      'max-image-preview': 'large',
      'max-video-preview': -1
    }
  },
  verification: {
    google: googleSiteVerification,
    other: bingSiteVerification ? { 'msvalidate.01': bingSiteVerification } : undefined
  }
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#06122b',
  colorScheme: 'dark'
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="he" dir="rtl" suppressHydrationWarning>
      <body>
        <IntegrationScripts />
        {children}
        <SiteFooter />
        <StructuredData />
      </body>
    </html>
  );
}
