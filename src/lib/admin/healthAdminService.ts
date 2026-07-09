import 'server-only';
import { getProductionConfig } from '@/lib/infrastructure/config';
import { runHealthChecks, type HealthCheckResult } from '@/lib/infrastructure/health';
import { buildStartupValidationReport } from '@/lib/infrastructure/startupValidation';
import { describeEmailConfig } from '@/lib/email';
import { getRepositoryProvider } from '@/lib/repositories/providerFactory';

/**
 * System health for the admin console: the shared platform health checks plus
 * live dependency probes with measured latency. Every row is a real check —
 * services that are not configured say so instead of pretending to be green.
 */

export type HealthProbe = {
  name: string;
  status: 'ok' | 'degraded' | 'down' | 'not_configured';
  message: string;
  latencyMs?: number;
};

export type AdminHealthReport = {
  generatedAt: string;
  overall: 'ok' | 'degraded' | 'down';
  uptimeSeconds: number;
  startup: ReturnType<typeof buildStartupValidationReport>;
  checks: HealthCheckResult[];
  probes: HealthProbe[];
};

export async function buildAdminHealthReport(): Promise<AdminHealthReport> {
  const config = getProductionConfig();
  const checks = await runHealthChecks();
  const startup = buildStartupValidationReport();
  const email = describeEmailConfig();

  const probes: HealthProbe[] = [];

  // Repository probe with measured latency — exercises the active provider.
  const repoStart = Date.now();
  try {
    await getRepositoryProvider().approvedQuestions.list({ limit: 1, activeOnly: false });
    probes.push({
      name: startup.activeProvider === 'database' ? 'database (Supabase REST)' : 'database (local JSON)',
      status: 'ok',
      message: 'Repository query succeeded.',
      latencyMs: Date.now() - repoStart
    });
  } catch (error) {
    probes.push({
      name: 'database',
      status: 'down',
      message: error instanceof Error ? error.message : 'Repository query failed.',
      latencyMs: Date.now() - repoStart
    });
  }

  probes.push(config.rateLimiting.distributed
    ? { name: 'redis (rate limiting)', status: 'ok', message: `Distributed rate limiting via ${config.rateLimiting.provider}.` }
    : { name: 'redis (rate limiting)', status: 'not_configured', message: config.rateLimiting.reason || 'In-memory rate limiting; configure Upstash for multi-instance deployments.' });

  probes.push(email.provider === 'resend'
    ? { name: 'resend (email)', status: email.notifyEmailConfigured ? 'ok' : 'degraded', message: email.notifyEmailConfigured ? 'Resend configured with a notify inbox.' : 'RESEND_API_KEY is set but CONTACT_NOTIFY_EMAIL is missing.' }
    : { name: 'resend (email)', status: 'not_configured', message: 'RESEND_API_KEY is not set; contact emails are skipped (visibly logged).' });

  probes.push(config.auth.supabaseAuthConfigured
    ? { name: 'auth (Supabase)', status: 'ok', message: `Supabase Auth configured; enforcement: ${config.auth.enforcement}.` }
    : { name: 'auth (Supabase)', status: 'not_configured', message: 'Supabase Auth env is missing; admin fails closed in production.' });

  probes.push({
    name: 'migrations',
    status: startup.databaseConfigValid ? 'ok' : 'down',
    message: `Code expects migrations up to ${startup.expectedMigrationVersion} (apply database/00*.sql in order).`
  });

  probes.push({
    name: 'storage (object storage)',
    status: 'not_configured',
    message: 'No object storage is integrated; the question model has no media fields.'
  });

  const hasDown = checks.some(check => check.status === 'down') || probes.some(probe => probe.status === 'down');
  const hasDegraded = checks.some(check => check.status === 'degraded') || probes.some(probe => probe.status === 'degraded');

  return {
    generatedAt: new Date().toISOString(),
    overall: hasDown ? 'down' : hasDegraded ? 'degraded' : 'ok',
    uptimeSeconds: Math.round(process.uptime()),
    startup,
    checks,
    probes
  };
}
