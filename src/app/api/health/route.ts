import { NextResponse } from 'next/server';
import { getProductionConfig } from '@/lib/infrastructure/config';
import { runHealthChecks } from '@/lib/infrastructure/health';
import { getSentryEnvironment, isSentryConfigured } from '@/lib/infrastructure/sentry';

export const dynamic = 'force-dynamic';

export async function GET() {
  const config = getProductionConfig();
  const checks = await runHealthChecks();
  const hasDown = checks.some(check => check.status === 'down');
  const hasDegraded = checks.some(check => check.status === 'degraded');
  const status = hasDown ? 'down' : hasDegraded ? 'degraded' : 'ok';

  return NextResponse.json(
    {
      ok: !hasDown,
      status,
      checkedAt: new Date().toISOString(),
      runtime: config.environment.runtime,
      observability: {
        sentryConfigured: isSentryConfigured(),
        sentryEnvironment: getSentryEnvironment()
      },
      database: {
        mode: config.database.mode
      },
      auth: {
        enforcement: config.auth.enforcement,
        supabaseAuthConfigured: config.auth.supabaseAuthConfigured
      },
      optionalServices: {
        aiModerationConfigured: config.ai.openAiConfigured && config.ai.moderationEnabled,
        analyticsProvider: config.analytics.provider,
        adsEnabled: config.ads.enabled
      },
      checks
    },
    {
      status: hasDown ? 503 : 200,
      headers: { 'Cache-Control': 'no-store' }
    }
  );
}
