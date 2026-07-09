import 'server-only';
import { getDatabaseConfig, isSupabaseConfigured } from '@/lib/database/config';
import { validateEnvironment } from './environment';
import { createLogger } from './logger';

/**
 * Startup validation — one clear, structured report of what this deployment
 * is actually running, logged once when the Node server boots (wired through
 * `instrumentation.ts`). It answers, without spelunking:
 *   - which repository provider is active (local-json vs database)
 *   - which database mode was requested and whether its config is valid
 *   - which migration version the code expects
 *   - which declared environment variables are missing/invalid
 *
 * In production, requesting database mode with an invalid configuration is a
 * hard failure: the provider factory throws on first use, and this module
 * logs the same condition at error level up front so the boot log names the
 * root cause. Validation itself never throws — it must not take down a
 * deployment that the factory would allow.
 */

/** The migration files under database/ this build of the code expects. */
export const EXPECTED_MIGRATION_VERSION = '009';

export type StartupValidationReport = {
  activeProvider: 'local-json' | 'database';
  databaseMode: 'local' | 'supabase';
  databaseConfigValid: boolean;
  expectedMigrationVersion: string;
  missingEnv: string[];
  invalidEnv: string[];
  productionMisconfigured: boolean;
};

export function buildStartupValidationReport(): StartupValidationReport {
  const database = getDatabaseConfig();
  const supabaseReady = isSupabaseConfigured(database);
  const issues = validateEnvironment();

  const activeProvider = database.mode === 'supabase' && supabaseReady ? 'database' : 'local-json';
  const productionMisconfigured =
    process.env.NODE_ENV === 'production' && database.mode === 'supabase' && !supabaseReady;

  return {
    activeProvider,
    databaseMode: database.mode,
    databaseConfigValid: database.mode !== 'supabase' || supabaseReady,
    expectedMigrationVersion: EXPECTED_MIGRATION_VERSION,
    missingEnv: issues.filter(issue => issue.message.includes('required')).map(issue => issue.name),
    invalidEnv: issues.filter(issue => !issue.message.includes('required')).map(issue => issue.name),
    productionMisconfigured
  };
}

let startupValidationRan = false;

export function runStartupValidation(): StartupValidationReport {
  const report = buildStartupValidationReport();
  const logger = createLogger('startup');

  if (startupValidationRan) return report;
  startupValidationRan = true;

  logger.info('Startup validation.', {
    activeProvider: report.activeProvider,
    databaseMode: report.databaseMode,
    databaseConfigValid: report.databaseConfigValid,
    expectedMigrationVersion: report.expectedMigrationVersion,
    missingEnvCount: report.missingEnv.length,
    missingEnv: report.missingEnv.join(', ') || undefined,
    invalidEnv: report.invalidEnv.join(', ') || undefined
  });

  if (report.productionMisconfigured) {
    logger.error('FATAL CONFIGURATION: database mode is selected in production but Supabase is not fully configured. Repository access will fail loudly.', {
      hint: 'Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY, or remove NEXT_PUBLIC_DATABASE_MODE.'
    });
  } else if (process.env.NODE_ENV === 'production' && report.activeProvider === 'local-json') {
    logger.warn('Production is running on the local JSON provider: data is ephemeral and per-instance.', {
      hint: 'Set NEXT_PUBLIC_DATABASE_MODE=supabase with Supabase credentials for persistent storage.'
    });
  }

  return report;
}
