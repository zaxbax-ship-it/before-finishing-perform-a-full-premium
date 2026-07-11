import { getAbsoluteUrl, SITE_DESCRIPTION, SITE_NAME } from '@/lib/site/config';

export function StructuredData() {
  const graph = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'WebSite',
        '@id': `${getAbsoluteUrl('/')}#website`,
        name: SITE_NAME,
        url: getAbsoluteUrl('/'),
        description: SITE_DESCRIPTION,
        inLanguage: ['he', 'en', 'ar', 'ru']
      },
      {
        '@type': 'WebApplication',
        '@id': `${getAbsoluteUrl('/')}#app`,
        name: SITE_NAME,
        url: getAbsoluteUrl('/'),
        applicationCategory: 'GameApplication',
        operatingSystem: 'Web',
        description: SITE_DESCRIPTION,
        isAccessibleForFree: true
      },
      {
        '@type': 'Organization',
        '@id': `${getAbsoluteUrl('/')}#organization`,
        name: SITE_NAME,
        url: getAbsoluteUrl('/')
      }
    ]
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(graph) }}
    />
  );
}
