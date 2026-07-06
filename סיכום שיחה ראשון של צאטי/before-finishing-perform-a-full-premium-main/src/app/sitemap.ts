import type { MetadataRoute } from 'next';
import { getAbsoluteUrl } from '@/lib/site/config';

const publicRoutes = [
  { path: '/', priority: 1 },
  { path: '/about', priority: 0.8 },
  { path: '/contact', priority: 0.8 },
  { path: '/privacy-policy', priority: 0.7 },
  { path: '/terms-of-service', priority: 0.7 },
  { path: '/cookie-policy', priority: 0.7 }
];

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date('2026-07-05T00:00:00.000Z');

  return publicRoutes.map(route => ({
    url: getAbsoluteUrl(route.path),
    lastModified,
    changeFrequency: route.path === '/' ? 'weekly' : 'monthly',
    priority: route.priority
  }));
}
