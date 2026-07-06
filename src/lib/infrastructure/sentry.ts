import * as Sentry from '@sentry/nextjs';

type SentryRuntime = 'client' | 'server' | 'edge';

type SentryContext = Record<string, unknown>;

function readPublicEnv(name: string): string | undefined {
  const value = process.env[name];
  return value && value.length > 0 ? value : undefined;
}

export function getSentryDsn() {
  return readPublicEnv('NEXT_PUBLIC_SENTRY_DSN');
}

export function isSentryConfigured() {
  return Boolean(getSentryDsn());
}

export function getSentryEnvironment() {
  return (
    readPublicEnv('NEXT_PUBLIC_SENTRY_ENVIRONMENT') ||
    readPublicEnv('VERCEL_ENV') ||
    process.env.NODE_ENV ||
    'development'
  );
}

export function getSentryRelease() {
  return readPublicEnv('NEXT_PUBLIC_SENTRY_RELEASE') || readPublicEnv('VERCEL_GIT_COMMIT_SHA');
}

export function getSentryTraceSampleRate() {
  const value = Number(readPublicEnv('NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE'));
  if (Number.isFinite(value) && value >= 0 && value <= 1) return value;
  return process.env.NODE_ENV === 'production' ? 0.05 : 0;
}

export function createSentryInitOptions(_runtime: SentryRuntime): Parameters<typeof Sentry.init>[0] {
  return {
    dsn: getSentryDsn(),
    enabled: isSentryConfigured(),
    environment: getSentryEnvironment(),
    release: getSentryRelease(),
    tracesSampleRate: getSentryTraceSampleRate(),
    sendDefaultPii: false,
    debug: false
  };
}

export function captureSentryException(error: unknown, context: SentryContext = {}) {
  if (!isSentryConfigured()) return;

  Sentry.withScope(scope => {
    for (const [key, value] of Object.entries(context)) {
      scope.setExtra(key, value);
    }
    Sentry.captureException(error);
  });
}
