import type { HealthCheckResult, HealthStatus } from '@/lib/infrastructure/health';
import { isRecord } from './common';

/**
 * Response of `GET /api/health`. Reports safe, non-secret operational status only
 * (never keys or connection strings). Consumed by uptime monitors and, later, by
 * mobile clients to gate features on backend availability.
 */
export type HealthResponse = {
  ok: boolean;
  status: HealthStatus;
  checkedAt: string;
  runtime: string;
  observability: {
    sentryConfigured: boolean;
    sentryEnvironment: string;
  };
  rateLimiting: {
    provider: string;
    distributed: boolean;
    configured: boolean;
    reason?: string;
  };
  database: {
    mode: 'local' | 'supabase';
  };
  auth: {
    enforcement: 'enforced' | 'open-local';
    supabaseAuthConfigured: boolean;
  };
  optionalServices: {
    aiModerationConfigured: boolean;
    analyticsProvider: string;
    adsEnabled: boolean;
  };
  checks: HealthCheckResult[];
};

const HEALTH_STATUSES: HealthStatus[] = ['ok', 'degraded', 'down'];

/** Runtime guard validating the health response shape (used by smoke tests). */
export function isHealthResponse(value: unknown): value is HealthResponse {
  if (!isRecord(value)) return false;
  if (typeof value.ok !== 'boolean') return false;
  if (typeof value.status !== 'string' || !HEALTH_STATUSES.includes(value.status as HealthStatus)) return false;
  if (typeof value.checkedAt !== 'string') return false;
  if (!isRecord(value.database) || (value.database.mode !== 'local' && value.database.mode !== 'supabase')) return false;
  if (!isRecord(value.auth) || typeof value.auth.supabaseAuthConfigured !== 'boolean') return false;
  return Array.isArray(value.checks);
}
