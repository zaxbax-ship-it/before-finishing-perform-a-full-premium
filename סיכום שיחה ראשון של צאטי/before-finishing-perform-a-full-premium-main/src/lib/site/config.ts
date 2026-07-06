import { readEnv } from '@/lib/infrastructure/environment';

export const SITE_NAME = 'The Quiz Show';
export const SITE_TAGLINE = 'Premium multilingual trivia platform';
export const SITE_DESCRIPTION =
  'A premium quiz-show trivia platform with multilingual gameplay, public leaderboards, community question submissions, and protected editorial tools.';
export const DEFAULT_SITE_ORIGIN = 'http://localhost:3000';
export const LEGAL_LAST_UPDATED = 'July 5, 2026';

export const SUPPORTED_PUBLIC_LOCALES = ['he', 'en', 'ar', 'ru', 'am'] as const;

function normalizeOrigin(value: string): string {
  const withProtocol = /^https?:\/\//i.test(value) ? value : `https://${value}`;
  try {
    const url = new URL(withProtocol);
    return url.origin;
  } catch {
    return DEFAULT_SITE_ORIGIN;
  }
}

export function getSiteOrigin(): string {
  return normalizeOrigin(readEnv('NEXT_PUBLIC_SITE_URL') || DEFAULT_SITE_ORIGIN);
}

export function getAbsoluteUrl(path = '/'): string {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return new URL(normalizedPath, getSiteOrigin()).toString();
}

export function getPublicContactEmail(): string | undefined {
  return readEnv('NEXT_PUBLIC_CONTACT_EMAIL');
}
