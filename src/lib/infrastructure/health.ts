import 'server-only';
import { getProductionConfig } from './config';
import { validateEnvironment } from './environment';

export type HealthStatus = 'ok' | 'degraded' | 'down';

export type HealthCheckResult = {
  name: string;
  status: HealthStatus;
  message: string;
  checkedAt: string;
};

export type HealthCheck = {
  name: string;
  run(): Promise<HealthCheckResult>;
};

const result = (name: string, status: HealthStatus, message: string): HealthCheckResult => ({
  name,
  status,
  message,
  checkedAt: new Date().toISOString()
});

export function createHealthChecks(): HealthCheck[] {
  return [
    {
      name: 'environment',
      async run() {
        const issues = validateEnvironment();
        const errors = issues.filter(issue => issue.severity === 'error');
        if (errors.length) return result('environment', 'down', `${errors.length} environment errors found.`);
        if (issues.length) return result('environment', 'degraded', `${issues.length} environment warnings found.`);
        return result('environment', 'ok', 'Environment validation passed.');
      }
    },
    {
      name: 'local-fallback',
      async run() {
        const config = getProductionConfig();
        return config.database.mode === 'local'
          ? result('local-fallback', 'ok', 'Local repository mode is active.')
          : result('local-fallback', 'degraded', 'External database mode requested; verify provider health before launch.');
      }
    },
    {
      name: 'optional-services',
      async run() {
        const config = getProductionConfig();
        const enabled = [
          config.ai.openAiConfigured,
          config.auth.googleOAuthConfigured,
          config.payments.stripeConfigured,
          config.email.resendConfigured,
          config.captcha.turnstileConfigured,
          config.analytics.provider !== 'none',
          config.ads.enabled
        ].filter(Boolean).length;
        return result('optional-services', 'ok', `${enabled} optional external services configured.`);
      }
    },
    {
      name: 'rate-limiting',
      async run() {
        const config = getProductionConfig();
        if (config.environment.runtime === 'production' && !config.rateLimiting.distributed) {
          return result('rate-limiting', 'degraded', 'Distributed rate limiting is not configured; in-memory fallback is active.');
        }
        return result(
          'rate-limiting',
          'ok',
          config.rateLimiting.distributed
            ? `Distributed ${config.rateLimiting.provider} rate limiting is active.`
            : 'Local in-memory rate limiting is active.'
        );
      }
    }
  ];
}

export async function runHealthChecks(): Promise<HealthCheckResult[]> {
  return Promise.all(createHealthChecks().map(check => check.run()));
}
