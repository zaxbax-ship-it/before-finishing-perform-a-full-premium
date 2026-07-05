import type { MetadataRoute } from 'next';
import { getSiteOrigin } from '@/lib/site/config';

export default function robots(): MetadataRoute.Robots {
  const origin = getSiteOrigin();

  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/admin', '/api/', '/auth/', '/forbidden']
      }
    ],
    sitemap: `${origin}/sitemap.xml`,
    host: origin
  };
}
