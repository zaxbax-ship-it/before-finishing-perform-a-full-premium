import * as Sentry from '@sentry/nextjs';

export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    await import('./sentry.server.config');
    // Log the startup validation report (active provider, database mode,
    // expected migration version, missing env) once per server boot.
    const { runStartupValidation } = await import('@/lib/infrastructure/startupValidation');
    runStartupValidation();
  }

  if (process.env.NEXT_RUNTIME === 'edge') {
    await import('./sentry.edge.config');
  }
}

export const onRequestError = Sentry.captureRequestError;
